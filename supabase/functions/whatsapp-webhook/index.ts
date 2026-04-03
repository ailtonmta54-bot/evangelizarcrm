import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendWhatsAppMessage(token: string, phoneId: string, to: string, message: string) {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      }),
    }
  );
  const result = await response.json();
  if (!response.ok) {
    console.error("WhatsApp send error:", result);
  }
  return { ok: response.ok, result };
}

function isAgentInSchedule(agent: any): boolean {
  if (!agent.schedule_enabled) return true;

  const now = new Date();
  const dayMap: Record<number, string> = {
    0: "dom", 1: "seg", 2: "ter", 3: "qua", 4: "qui", 5: "sex", 6: "sab",
  };
  const today = dayMap[now.getDay()];
  const allowedDays = (agent.schedule_days || "").split(",").map((d: string) => d.trim().toLowerCase());

  if (!allowedDays.includes(today)) return false;

  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const start = agent.schedule_start || "00:00";
  const end = agent.schedule_end || "23:59";

  return currentTime >= start && currentTime <= end;
}

function matchesKeywords(agent: any, messageText: string): boolean {
  if (!agent.keywords || agent.keywords.trim() === "") return false;
  const keywords = agent.keywords.split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean);
  const text = messageText.toLowerCase();
  return keywords.some((kw: string) => text.includes(kw));
}

async function findBestAgent(supabase: any, phoneNumberId: string, leadAgentId: string | null, messageText: string) {
  // 1. Get all active agents matching this phone_number_id
  const { data: agents } = await supabase
    .from("agents")
    .select("*")
    .eq("whatsapp_phone_id", phoneNumberId)
    .eq("active", true);

  if (!agents || agents.length === 0) return null;

  // 2. If lead has assigned agent, prefer it
  if (leadAgentId) {
    const assigned = agents.find((a: any) => a.id === leadAgentId);
    if (assigned) return assigned;
  }

  // 3. Match by keyword
  const keywordMatch = agents.find((a: any) => matchesKeywords(a, messageText));
  if (keywordMatch) return keywordMatch;

  // 4. Default agent
  const defaultAgent = agents.find((a: any) => a.is_default);
  if (defaultAgent) return defaultAgent;

  // 5. Any active agent
  return agents[0];
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // GET: Meta webhook verification - check agents for verify_token
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token && challenge) {
      // Check agents table for verify token
      const { data: agent } = await supabase
        .from("agents")
        .select("id")
        .eq("whatsapp_verify_token", token)
        .limit(1)
        .single();

      if (agent) {
        console.log("Webhook verified for agent:", agent.id);
        return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
      }

      // Fallback: check companies table (legacy)
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("whatsapp_verify_token", token)
        .single();

      if (company) {
        console.log("Webhook verified for company:", company.id);
        return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
      }
    }
    return new Response("Forbidden", { status: 403 });
  }

  // POST: Receive incoming messages
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("Webhook received:", JSON.stringify(body));

      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value?.messages || value.messages.length === 0) {
        return new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) {
        return new Response(JSON.stringify({ error: "Missing phone_number_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find company by agent's phone_id or company's phone_id
      let companyId: string | null = null;

      const { data: agentForCompany } = await supabase
        .from("agents")
        .select("company_id")
        .eq("whatsapp_phone_id", phoneNumberId)
        .limit(1)
        .single();

      if (agentForCompany) {
        companyId = agentForCompany.company_id;
      } else {
        // Fallback: legacy company-level config
        const { data: company } = await supabase
          .from("companies")
          .select("id")
          .eq("whatsapp_phone_id", phoneNumberId)
          .single();

        if (company) companyId = company.id;
      }

      if (!companyId) {
        console.error("No company/agent found for phone_number_id:", phoneNumberId);
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      for (const message of value.messages) {
        const fromNumber = message.from;
        const messageText = message.text?.body || message.caption || "[mídia]";
        const contactName = value.contacts?.[0]?.profile?.name || fromNumber;

        // Find or create lead
        let { data: lead } = await supabase
          .from("leads")
          .select("id, ai_enabled, agent_id")
          .eq("phone", fromNumber)
          .eq("company_id", companyId)
          .single();

        if (!lead) {
          const { data: newLead, error: leadError } = await supabase
            .from("leads")
            .insert({
              name: contactName,
              phone: fromNumber,
              status: "novo",
              company_id: companyId,
              ai_enabled: true,
            })
            .select("id, ai_enabled, agent_id")
            .single();

          if (leadError) {
            console.error("Error creating lead:", leadError);
            continue;
          }
          lead = newLead;
          console.log("New lead created:", lead.id, contactName);

          // Trigger "novo_lead" automations
          try {
            const { data: novoLeadAutomations } = await supabase
              .from("automations")
              .select("*")
              .eq("company_id", companyId)
              .eq("trigger_type", "novo_lead")
              .eq("active", true);

            if (novoLeadAutomations && novoLeadAutomations.length > 0) {
              // Find best agent to get WhatsApp credentials
              const autoAgent = await findBestAgent(supabase, phoneNumberId, null, messageText);
              const waToken = autoAgent?.whatsapp_token;
              const waPhoneId = autoAgent?.whatsapp_phone_id;

              if (waToken && waPhoneId) {
                for (const automation of novoLeadAutomations) {
                  const autoMessage = automation.message
                    .replace(/\{nome\}/g, contactName)
                    .replace(/\{telefone\}/g, fromNumber);

                  const autoSend = await sendWhatsAppMessage(waToken, waPhoneId, fromNumber, autoMessage);

                  if (autoSend.ok) {
                    await supabase.from("messages").insert({
                      lead_id: lead.id,
                      content: autoMessage,
                      type: "enviada",
                      company_id: companyId,
                    });
                    console.log("Novo lead automation sent:", automation.name);
                  }
                }
              }
            }
          } catch (autoError) {
            console.error("Novo lead automation error:", autoError);
          }
        }

        // Save incoming message
        await supabase.from("messages").insert({
          lead_id: lead.id,
          content: messageText,
          type: "recebida",
          company_id: companyId,
        });

        // Update lead timestamp
        await supabase
          .from("leads")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", lead.id);

        console.log("Message saved from:", fromNumber);

        // --- AI Agent Auto-Reply ---
        if (lead.ai_enabled) {
          try {
            const agent = await findBestAgent(supabase, phoneNumberId, lead.agent_id, messageText);

            if (!agent) {
              console.log("No active agent found for this phone");
              continue;
            }

            // Check schedule
            if (!isAgentInSchedule(agent)) {
              console.log(`Agent "${agent.name}" is outside schedule`);
              // Send away message if configured
              if (agent.away_message && agent.whatsapp_token && agent.whatsapp_phone_id) {
                const awaySend = await sendWhatsAppMessage(
                  agent.whatsapp_token, agent.whatsapp_phone_id, fromNumber, agent.away_message
                );
                if (awaySend.ok) {
                  await supabase.from("messages").insert({
                    lead_id: lead.id,
                    content: agent.away_message,
                    type: "enviada",
                    company_id: companyId,
                  });
                }
              }
              continue;
            }

            // Assign agent to lead if not already
            if (!lead.agent_id) {
              await supabase.from("leads").update({ agent_id: agent.id }).eq("id", lead.id);
            }

            // Call SDR AI function
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
              console.log("AI response generated:", sdrResult.message);

              if (agent.whatsapp_token && agent.whatsapp_phone_id) {
                const sendResult = await sendWhatsAppMessage(
                  agent.whatsapp_token, agent.whatsapp_phone_id, fromNumber, sdrResult.message
                );

                if (sendResult.ok) {
                  await supabase.from("messages").insert({
                    lead_id: lead.id,
                    content: sdrResult.message,
                    type: "enviada",
                    company_id: companyId,
                  });
                  console.log("AI reply sent to:", fromNumber);
                }
              }
            } else if (sdrResult.skipped) {
              console.log("AI skipped:", sdrResult.reason);
            } else {
              console.error("AI SDR error:", sdrResult.error);
            }
          } catch (aiError) {
            console.error("AI agent call failed:", aiError);
          }
        }
      }

      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
