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
  const responseText = await res.text();
  let result: any = responseText;
  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch (_) {
    result = responseText;
  }
  if (!res.ok) console.error("IG send error:", result);
  return { ok: res.ok, result, responseText: responseText || JSON.stringify(result) };
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

function matchesKeywords(agent: any, messageText: string): boolean {
  if (!agent?.keywords || String(agent.keywords).trim() === "") return false;
  const keywords = String(agent.keywords)
    .split(",")
    .map((k: string) => k.trim().toLowerCase())
    .filter(Boolean);
  const text = messageText.toLowerCase();
  return keywords.some((kw: string) => text.includes(kw));
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
}

async function saveInstagramBotDebug(supabase: any, tenantId: string | undefined, debug: Record<string, unknown>) {
  if (!tenantId) return;
  await supabase
    .from("companies")
    .update({
      instagram_bot_debug: debug,
      instagram_bot_debug_updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);
}

function diagnosticLog(event: string, payload: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, ...payload }));
}

async function processIncomingMessageBotReply({
  tenant_id,
  channel,
  lead_id,
  conversation_id,
  message_id,
  sender_id,
  message_text,
}: {
  tenant_id?: string;
  channel: "instagram_direct";
  lead_id?: string;
  conversation_id?: string;
  message_id?: string;
  sender_id?: string;
  message_text?: string;
}) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const debug: Record<string, unknown> = {
    last_received_direct_message: message_text || "",
    tenant_id: tenant_id || "",
    conversation_id: conversation_id || "",
    lead_id: lead_id || "",
    message_id: message_id || "",
    sender_id: sender_id || "",
    channel,
    bot_enabled: null,
    human_takeover: null,
    trigger_found: null,
    openai_called: false,
    ai_response_generated: "",
    meta_send_api_response: "",
    blocked_reason: "",
    final_status: "blocked",
    updated_at: new Date().toISOString(),
  };

  diagnosticLog("bot_processor_called", { tenant_id, channel, lead_id, conversation_id, message_id, sender_id });

  const finish = async (finalStatus: "replied" | "blocked" | "failed", blockedReason = "") => {
    debug.final_status = finalStatus;
    debug.blocked_reason = blockedReason;
    debug.updated_at = new Date().toISOString();
    diagnosticLog("final_status", { value: finalStatus, blocked_reason: blockedReason || null });
    await saveInstagramBotDebug(supabase, tenant_id, debug);
    return { finalStatus, blockedReason };
  };

  if (!tenant_id) return await finish("blocked", "missing_tenant_id");
  if (!conversation_id) return await finish("blocked", "missing_conversation_id");
  if (!sender_id) return await finish("blocked", "missing_sender_id");
  if (!message_text) return await finish("blocked", "missing_message_text");

  try {
    const { data: company } = await supabase
      .from("companies")
      .select("id, instagram_access_token, instagram_business_id, instagram_bot_enabled")
      .eq("id", tenant_id)
      .maybeSingle();

    const { data: lead } = await supabase
      .from("leads")
      .select("id, ai_enabled, agent_id")
      .eq("id", lead_id)
      .eq("company_id", tenant_id)
      .maybeSingle();

    diagnosticLog("bot_settings_loaded", {
      tenant_id,
      lead_id,
      has_company: Boolean(company),
      has_lead: Boolean(lead),
    });

    const botEnabledForInstagramDirect = company?.instagram_bot_enabled !== false;
    const humanTakeover = lead?.ai_enabled === false;
    debug.bot_enabled = botEnabledForInstagramDirect;
    debug.human_takeover = humanTakeover;

    diagnosticLog("bot_enabled_for_instagram_direct", { value: botEnabledForInstagramDirect });
    diagnosticLog("human_takeover", { value: humanTakeover });

    if (!botEnabledForInstagramDirect) {
      diagnosticLog("trigger_match", { value: "not_found" });
      diagnosticLog("openai_called", { value: false });
      diagnosticLog("ai_response_text", { value: "" });
      diagnosticLog("instagram_send_api_called", { value: false });
      diagnosticLog("instagram_send_api_response", { value: "" });
      debug.trigger_found = false;
      return await finish("blocked", "bot_disabled_for_instagram_direct");
    }

    if (humanTakeover) {
      diagnosticLog("trigger_match", { value: "not_found" });
      diagnosticLog("openai_called", { value: false });
      diagnosticLog("ai_response_text", { value: "" });
      diagnosticLog("instagram_send_api_called", { value: false });
      diagnosticLog("instagram_send_api_response", { value: "" });
      debug.trigger_found = false;
      return await finish("blocked", "human_takeover_active");
    }

    if (!company?.instagram_access_token) {
      diagnosticLog("trigger_match", { value: "not_found" });
      diagnosticLog("openai_called", { value: false });
      diagnosticLog("ai_response_text", { value: "" });
      diagnosticLog("instagram_send_api_called", { value: false });
      diagnosticLog("instagram_send_api_response", { value: "" });
      debug.trigger_found = false;
      return await finish("blocked", "missing_page_access_token");
    }

    const { data: allAgents } = await supabase
      .from("agents")
      .select("*")
      .eq("company_id", tenant_id)
      .eq("active", true);

    const instagramAgents = (allAgents || []).filter((agent: any) =>
      ["instagram", "instagram_direct", "both"].includes(agent.channel)
    );
    const pool = instagramAgents.length > 0 ? instagramAgents : (allAgents || []);
    const assignedAgent = lead?.agent_id ? pool.find((agent: any) => agent.id === lead.agent_id) : null;
    const triggerAgent = pool.find((agent: any) => matchesKeywords(agent, message_text));
    const triggerFound = Boolean(triggerAgent);
    const agent = assignedAgent || triggerAgent || pool.find((agent: any) => agent.is_default) || pool[0];

    debug.trigger_found = triggerFound;
    diagnosticLog("trigger_match", { value: triggerFound ? "found" : "not_found", agent_id: triggerAgent?.id || null });

    if (!agent) {
      diagnosticLog("openai_called", { value: false });
      diagnosticLog("ai_response_text", { value: "" });
      diagnosticLog("instagram_send_api_called", { value: false });
      diagnosticLog("instagram_send_api_response", { value: "" });
      return await finish("failed", "openai_error");
    }

    if (!lead?.agent_id) {
      await supabase.from("leads").update({ agent_id: agent.id }).eq("id", lead_id);
    }

    diagnosticLog("openai_called", { value: true });
    debug.openai_called = true;

    const sdrResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/sdr-ai-respond`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lead_id,
        company_id: tenant_id,
        agent_id: agent.id,
      }),
    });

    const sdrRaw = await sdrResponse.text();
    let sdrResult: any = {};
    try {
      sdrResult = sdrRaw ? JSON.parse(sdrRaw) : {};
    } catch (_) {
      sdrResult = { error: sdrRaw };
    }

    if (!sdrResponse.ok || sdrResult.error) {
      diagnosticLog("ai_response_text", { value: "" });
      diagnosticLog("instagram_send_api_called", { value: false });
      diagnosticLog("instagram_send_api_response", { value: "" });
      return await finish("failed", "openai_error");
    }

    const aiMessage = String(sdrResult.message || "").trim();
    diagnosticLog("ai_response_text", { value: aiMessage });
    debug.ai_response_generated = aiMessage;

    if (!aiMessage) {
      diagnosticLog("instagram_send_api_called", { value: false });
      diagnosticLog("instagram_send_api_response", { value: "" });
      return await finish("failed", "empty_ai_response");
    }

    diagnosticLog("instagram_send_api_called", { value: true });
    const sendResult = await sendIgMessage(
      company.instagram_access_token,
      company.instagram_business_id,
      sender_id,
      aiMessage
    );
    const sendResponseText = sendResult.responseText || asText(sendResult.result);
    diagnosticLog("instagram_send_api_response", { value: sendResponseText });
    debug.meta_send_api_response = sendResponseText;

    if (!sendResult.ok) {
      return await finish("failed", "meta_send_api_error");
    }

    await supabase.from("messages").insert({
      lead_id,
      content: aiMessage,
      type: "enviada",
      company_id: tenant_id,
      channel: "instagram_direct",
    });

    return await finish("replied");
  } catch (error) {
    diagnosticLog("ai_response_text", { value: "" });
    diagnosticLog("instagram_send_api_called", { value: false });
    diagnosticLog("instagram_send_api_response", { value: asText(error) });
    debug.meta_send_api_response = asText(error);
    return await finish("failed", "openai_error");
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

      // Track last webhook received for UI health indicator
      await supabase
        .from("companies")
        .update({ instagram_last_webhook_at: new Date().toISOString() })
        .eq("id", companyId);



      for (const evt of messagingEvents) {
        diagnosticLog("instagram_webhook_received", { tenant_id: companyId, entry_id: entryId });

        // Ignore echoes (messages we sent ourselves)
        if (evt.message?.is_echo) {
          diagnosticLog("instagram_bot_blocked_reason", { reason: "message_detected_as_echo", tenant_id: companyId });
          await saveInstagramBotDebug(supabase, companyId, {
            tenant_id: companyId,
            conversation_id: "",
            sender_id: evt.sender?.id || "",
            last_received_direct_message: "",
            bot_enabled: null,
            human_takeover: null,
            trigger_found: null,
            openai_called: false,
            ai_response_generated: "",
            meta_send_api_response: "",
            blocked_reason: "message_detected_as_echo",
            final_status: "blocked",
            updated_at: new Date().toISOString(),
          });
          diagnosticLog("final_status", { value: "blocked", blocked_reason: "message_detected_as_echo" });
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
        const { data: savedMessage, error: msgErr } = await supabase.from("messages").insert({
          lead_id: lead.id,
          content: messageText,
          type: "recebida",
          company_id: companyId,
          channel: "instagram_direct",
        }).select("id").single();
        if (msgErr) {
          console.error("[ig-webhook] save message error:", msgErr);
          continue;
        }

        const messageId = savedMessage?.id;
        diagnosticLog("instagram_message_saved", {
          tenant_id: companyId,
          lead_id: lead.id,
          conversation_id: lead.id,
          message_id: messageId,
          sender_id: senderId,
        });

        // Auto-tag
        const newTags = autoTagsFor(messageText);
        if (newTags.length > 0) {
          const existing = lead.tags || [];
          const merged = Array.from(new Set([...existing, ...newTags]));
          await supabase.from("leads").update({ tags: merged, updated_at: new Date().toISOString() }).eq("id", lead.id);
        } else {
          await supabase.from("leads").update({ updated_at: new Date().toISOString() }).eq("id", lead.id);
        }

        await processIncomingMessageBotReply({
          tenant_id: companyId,
          channel: "instagram_direct",
          lead_id: lead.id,
          conversation_id: lead.id,
          message_id: messageId,
          sender_id: senderId,
          message_text: messageText,
        });

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
