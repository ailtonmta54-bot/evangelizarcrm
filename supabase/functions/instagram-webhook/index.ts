import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HOT_KEYWORDS = ["preço", "preco", "valor", "quanto custa", "comprar", "quero", "agendar", "proposta", "orçamento", "orcamento"];
const HUMAN_KEYWORDS = ["atendente", "humano", "falar com alguém", "pessoa"];

function autoTagsFor(text: string): string[] {
  const lower = text.toLowerCase();
  const tags: string[] = [];
  if (HOT_KEYWORDS.some((k) => lower.includes(k))) tags.push("Hot Lead");
  if (HUMAN_KEYWORDS.some((k) => lower.includes(k))) tags.push("Solicitou Humano");
  return tags;
}

async function sendIgMessage(token: string, businessId: string, recipientId: string, text: string) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${businessId}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
        messaging_type: "RESPONSE",
      }),
    }
  );
  const result = await res.json();
  if (!res.ok) console.error("IG send error:", result);
  return { ok: res.ok, result };
}

async function fetchIgProfile(token: string, igsid: string, businessId: string) {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${igsid}?fields=name,username,profile_pic&access_token=${encodeURIComponent(token)}`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error("IG profile fetch error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // GET: Meta webhook handshake (uses platform-wide verify token)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expected = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");

    if (mode === "subscribe" && token && challenge && expected && token === expected) {
      console.log("IG webhook handshake ok");
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const body = await req.json();
    console.log("[ig-webhook] payload:", JSON.stringify(body));

    const object = body?.object;
    const entries = body?.entry || [];
    console.log(`[ig-webhook] object=${object} entries=${entries.length}`);

    for (const entry of entries) {
      const entryId = entry.id; // Could be IG Business Account ID OR Page ID
      const messagingEvents = entry.messaging || entry.changes || [];
      console.log(`[ig-webhook] entry.id=${entryId} events=${messagingEvents.length}`);

      // Find company by either instagram_business_id OR instagram_page_id
      // (don't require instagram_enabled — that's used as connection flag; bot toggle is separate)
      const { data: companies } = await supabase
        .from("companies")
        .select("id, instagram_access_token, instagram_business_id, instagram_page_id, instagram_bot_enabled")
        .or(`instagram_business_id.eq.${entryId},instagram_page_id.eq.${entryId}`);

      const company = companies?.[0];
      if (!company) {
        console.log(JSON.stringify({ event: "instagram_bot_blocked_reason", reason: "no_company_for_entry", entryId }));
        continue;
      }

      const companyId = company.id;
      const accessToken = company.instagram_access_token;
      const botEnabled = company.instagram_bot_enabled !== false;

      // Track last webhook received for UI health indicator
      await supabase
        .from("companies")
        .update({ instagram_last_webhook_at: new Date().toISOString() })
        .eq("id", companyId);



      for (const evt of messagingEvents) {
        // Ignore echoes (messages we sent ourselves)
        if (evt.message?.is_echo) {
          console.log(JSON.stringify({ event: "instagram_bot_blocked_reason", reason: "echo", companyId }));
          continue;
        }

        const senderId = evt.sender?.id;
        if (!senderId || senderId === company.instagram_business_id || senderId === company.instagram_page_id) {
          console.log(JSON.stringify({ event: "instagram_bot_blocked_reason", reason: "self_or_empty_sender", companyId }));
          continue;
        }

        const messageText: string = evt.message?.text || (evt.message?.attachments ? "[mídia]" : "");
        if (!messageText) {
          console.log(JSON.stringify({ event: "instagram_bot_blocked_reason", reason: "empty_message", companyId, senderId }));
          continue;
        }
        console.log(JSON.stringify({ event: "instagram_message_received", companyId, senderId, preview: messageText.slice(0, 80) }));

        // Find or create lead by instagram_user_id
        let { data: lead } = await supabase
          .from("leads")
          .select("id, ai_enabled, agent_id, tags, instagram_username")
          .eq("instagram_user_id", senderId)
          .eq("company_id", companyId)
          .maybeSingle();

        if (!lead) {
          const profile = await fetchIgProfile(accessToken, senderId, company.instagram_business_id);
          const displayName = profile?.name || profile?.username || `IG ${senderId.slice(-6)}`;
          const username = profile?.username || "";
          const picUrl = profile?.profile_pic || "";

          const { data: newLead, error: leadError } = await supabase
            .from("leads")
            .insert({
              name: displayName,
              phone: "",
              status: "novo",
              company_id: companyId,
              ai_enabled: true,
              source: "instagram",
              instagram_user_id: senderId,
              instagram_username: username,
              profile_pic_url: picUrl,
            })
            .select("id, ai_enabled, agent_id, tags, instagram_username")
            .single();

          if (leadError) {
            console.error(JSON.stringify({ event: "instagram_bot_blocked_reason", reason: "lead_create_failed", error: leadError.message }));
            continue;
          }
          lead = newLead;
          console.log(JSON.stringify({ event: "instagram_lead_created", leadId: lead.id, displayName, companyId }));
        }

        // Save incoming message (channel = instagram_direct)
        const { error: msgErr } = await supabase.from("messages").insert({
          lead_id: lead.id,
          content: messageText,
          type: "recebida",
          company_id: companyId,
          channel: "instagram_direct",
        });
        if (msgErr) console.error("[ig-webhook] save message error:", msgErr);

        // Auto-tag
        const newTags = autoTagsFor(messageText);
        if (newTags.length > 0) {
          const existing = lead.tags || [];
          const merged = Array.from(new Set([...existing, ...newTags]));
          await supabase.from("leads").update({ tags: merged, updated_at: new Date().toISOString() }).eq("id", lead.id);
        } else {
          await supabase.from("leads").update({ updated_at: new Date().toISOString() }).eq("id", lead.id);
        }

        // Bot activation checks
        console.log(JSON.stringify({ event: "instagram_bot_enabled_checked", companyId, leadId: lead.id, botEnabled, leadAiEnabled: lead.ai_enabled }));

        if (!botEnabled) {
          console.log(JSON.stringify({ event: "instagram_bot_blocked_reason", reason: "company_bot_disabled", companyId, leadId: lead.id }));
          continue;
        }
        if (!lead.ai_enabled) {
          console.log(JSON.stringify({ event: "instagram_bot_blocked_reason", reason: "human_takeover", companyId, leadId: lead.id }));
          continue;
        }

        try {
          // Find best agent: prefer Instagram/both, fallback to any active agent
          const { data: allAgents } = await supabase
            .from("agents")
            .select("*")
            .eq("company_id", companyId)
            .eq("active", true);

          const igAgents = (allAgents || []).filter((a: any) =>
            ["instagram", "instagram_direct", "both"].includes(a.channel)
          );
          const pool = igAgents.length > 0 ? igAgents : (allAgents || []);

          const agent =
            (lead.agent_id && pool.find((a: any) => a.id === lead.agent_id)) ||
            pool.find((a: any) => a.is_default) ||
            pool[0];

          if (!agent) {
            console.log(JSON.stringify({ event: "instagram_bot_blocked_reason", reason: "no_active_agent", companyId, leadId: lead.id }));
            continue;
          }

          if (!lead.agent_id) {
            await supabase.from("leads").update({ agent_id: agent.id }).eq("id", lead.id);
          }

          console.log(JSON.stringify({ event: "instagram_bot_triggered", companyId, leadId: lead.id, agentId: agent.id, agentName: agent.name }));

          const sdrResponse = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/sdr-ai-respond`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                lead_id: lead.id,
                company_id: companyId,
                agent_id: agent.id,
              }),
            }
          );
          const sdrResult = await sdrResponse.json();

          if (!sdrResult.success || !sdrResult.message) {
            console.error(JSON.stringify({ event: "instagram_bot_blocked_reason", reason: "ai_no_response", companyId, leadId: lead.id, sdrResult }));
            continue;
          }
          console.log(JSON.stringify({ event: "instagram_ai_response_generated", leadId: lead.id, preview: sdrResult.message.slice(0, 80) }));

          const sendResult = await sendIgMessage(
            accessToken,
            company.instagram_business_id,
            senderId,
            sdrResult.message
          );

          if (sendResult.ok) {
            await supabase.from("messages").insert({
              lead_id: lead.id,
              content: sdrResult.message,
              type: "enviada",
              company_id: companyId,
              channel: "instagram_direct",
            });
            console.log(JSON.stringify({ event: "instagram_reply_sent", leadId: lead.id, senderId }));
          } else {
            console.error(JSON.stringify({ event: "instagram_bot_blocked_reason", reason: "ig_send_failed", leadId: lead.id, result: sendResult.result }));
          }
        } catch (aiErr) {
          console.error(JSON.stringify({ event: "instagram_bot_blocked_reason", reason: "exception", error: String(aiErr) }));
        }

        }
      }
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("IG webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
