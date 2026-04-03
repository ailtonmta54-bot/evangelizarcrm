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

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // GET: Meta webhook verification
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token && challenge) {
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

      // Find company
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("id, whatsapp_token, whatsapp_phone_id")
        .eq("whatsapp_phone_id", phoneNumberId)
        .single();

      if (companyError || !company) {
        console.error("Company not found for phone_number_id:", phoneNumberId);
        return new Response(JSON.stringify({ error: "Company not found" }), {
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
          .select("id, ai_enabled")
          .eq("phone", fromNumber)
          .eq("company_id", company.id)
          .single();

        if (!lead) {
          const { data: newLead, error: leadError } = await supabase
            .from("leads")
            .insert({
              name: contactName,
              phone: fromNumber,
              status: "novo",
              company_id: company.id,
              ai_enabled: true,
            })
            .select("id, ai_enabled")
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
              .eq("company_id", company.id)
              .eq("trigger_type", "novo_lead")
              .eq("active", true);

            if (novoLeadAutomations && novoLeadAutomations.length > 0 && company.whatsapp_token && company.whatsapp_phone_id) {
              for (const automation of novoLeadAutomations) {
                const autoMessage = automation.message
                  .replace(/\{nome\}/g, contactName)
                  .replace(/\{telefone\}/g, fromNumber);

                const autoSend = await sendWhatsAppMessage(
                  company.whatsapp_token,
                  company.whatsapp_phone_id,
                  fromNumber,
                  autoMessage
                );

                if (autoSend.ok) {
                  await supabase.from("messages").insert({
                    lead_id: lead.id,
                    content: autoMessage,
                    type: "enviada",
                    company_id: company.id,
                  });
                  console.log("Novo lead automation sent:", automation.name);
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
          company_id: company.id,
        });

        // Update lead timestamp
        await supabase
          .from("leads")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", lead.id);

        console.log("Message saved from:", fromNumber);

        // --- AI SDR Auto-Reply ---
        if (lead.ai_enabled) {
          try {
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
                  company_id: company.id,
                }),
              }
            );

            const sdrResult = await sdrResponse.json();

            if (sdrResult.success && sdrResult.message) {
              console.log("AI response generated:", sdrResult.message);

              // Send via WhatsApp
              if (company.whatsapp_token && company.whatsapp_phone_id) {
                const sendResult = await sendWhatsAppMessage(
                  company.whatsapp_token,
                  company.whatsapp_phone_id,
                  fromNumber,
                  sdrResult.message
                );

                if (sendResult.ok) {
                  // Save AI response to messages
                  await supabase.from("messages").insert({
                    lead_id: lead.id,
                    content: sdrResult.message,
                    type: "enviada",
                    company_id: company.id,
                  });
                  console.log("AI reply sent to:", fromNumber);
                } else {
                  console.error("Failed to send AI reply via WhatsApp");
                }
              }
            } else if (sdrResult.skipped) {
              console.log("AI skipped:", sdrResult.reason);
            } else {
              console.error("AI SDR error:", sdrResult.error);
            }
          } catch (aiError) {
            console.error("AI SDR call failed:", aiError);
            // Don't fail the webhook — message was saved
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
