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

      // Try to find company by either instagram_business_id OR instagram_page_id
      const { data: companies } = await supabase
        .from("companies")
        .select("id, instagram_access_token, instagram_business_id, instagram_page_id")
        .eq("instagram_enabled", true)
        .or(`instagram_business_id.eq.${entryId},instagram_page_id.eq.${entryId}`);

      const company = companies?.[0];
      if (!company) {
        console.error("[ig-webhook] no company for entry.id:", entryId);
        continue;
      }

      const companyId = company.id;
      const accessToken = company.instagram_access_token;

      // Track last webhook received for UI health indicator
      await supabase
        .from("companies")
        .update({ instagram_last_webhook_at: new Date().toISOString() })
        .eq("id", companyId);


      for (const evt of messagingEvents) {
        // Ignore echoes (messages we sent ourselves)
        if (evt.message?.is_echo) {
          console.log("[ig-webhook] skip echo");
          continue;
        }

        const senderId = evt.sender?.id;
        if (!senderId || senderId === company.instagram_business_id || senderId === company.instagram_page_id) {
          console.log("[ig-webhook] skip self/empty sender");
          continue;
        }

        const messageText: string = evt.message?.text || (evt.message?.attachments ? "[mídia]" : "");
        if (!messageText) {
          console.log("[ig-webhook] skip empty message");
          continue;
        }
        console.log(`[ig-webhook] message from ${senderId}: ${messageText.slice(0, 80)}`);


        // Find or create lead by instagram_user_id
        let { data: lead } = await supabase
          .from("leads")
          .select("id, ai_enabled, agent_id, tags, instagram_username")
          .eq("instagram_user_id", senderId)
          .eq("company_id", companyId)
          .maybeSingle();

        if (!lead) {
          // Try to fetch profile info
          const profile = await fetchIgProfile(accessToken, senderId, igBusinessId);
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
            console.error("Error creating IG lead:", leadError);
            continue;
          }
          lead = newLead;
          console.log("New IG lead:", lead.id, displayName);
        }

        // Save incoming message
        const { error: msgErr } = await supabase.from("messages").insert({
          lead_id: lead.id,
          content: messageText,
          type: "recebida",
          company_id: companyId,
        });
        if (msgErr) console.error("[ig-webhook] save message error:", msgErr);
        else console.log("[ig-webhook] message stored for lead", lead.id);


        // Auto-tag
        const newTags = autoTagsFor(messageText);
        if (newTags.length > 0) {
          const existing = lead.tags || [];
          const merged = Array.from(new Set([...existing, ...newTags]));
          await supabase.from("leads").update({ tags: merged, updated_at: new Date().toISOString() }).eq("id", lead.id);
        } else {
          await supabase.from("leads").update({ updated_at: new Date().toISOString() }).eq("id", lead.id);
        }

        // AI auto-reply
        if (lead.ai_enabled) {
          try {
            // Find best agent: prefer Instagram/both, fallback to any active agent
            const { data: allAgents } = await supabase
              .from("agents")
              .select("*")
              .eq("company_id", companyId)
              .eq("active", true);

            const igAgents = (allAgents || []).filter((a: any) =>
              ["instagram", "both"].includes(a.channel)
            );
            const pool = igAgents.length > 0 ? igAgents : (allAgents || []);

            const agent =
              (lead.agent_id && pool.find((a: any) => a.id === lead.agent_id)) ||
              pool.find((a: any) => a.is_default) ||
              pool[0];

            if (!agent) {
              console.log("No active agent for company:", companyId);
              continue;
            }
            console.log(`IG using agent "${agent.name}" (channel=${agent.channel})`);

            if (!lead.agent_id) {
              await supabase.from("leads").update({ agent_id: agent.id }).eq("id", lead.id);
            }

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

            if (sdrResult.success && sdrResult.message) {
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
                });
                console.log("IG AI reply sent to:", senderId);
              }
            }
          } catch (aiErr) {
            console.error("IG AI error:", aiErr);
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
