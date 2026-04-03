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
  return { ok: response.ok, result };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Process "novo_lead" automations — triggered directly from webhook, skip here

    // 2. Process "sem_resposta" automations — leads that haven't replied in X hours
    const { data: followUpAutomations } = await supabase
      .from("automations")
      .select("*")
      .eq("trigger_type", "sem_resposta")
      .eq("active", true);

    if (!followUpAutomations || followUpAutomations.length === 0) {
      return new Response(JSON.stringify({ processed: 0, reason: "No active follow-up automations" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;

    for (const automation of followUpAutomations) {
      const delayHours = automation.delay_hours || 24;
      const cutoffTime = new Date(Date.now() - delayHours * 60 * 60 * 1000).toISOString();

      // Get company WhatsApp config
      const { data: company } = await supabase
        .from("companies")
        .select("whatsapp_token, whatsapp_phone_id")
        .eq("id", automation.company_id)
        .single();

      if (!company?.whatsapp_token || !company?.whatsapp_phone_id) {
        console.log("Skipping automation", automation.id, "- no WhatsApp config");
        continue;
      }

      // Find leads from this company whose last message is "enviada" (we sent) and older than delay
      const { data: leads } = await supabase
        .from("leads")
        .select("id, phone, name")
        .eq("company_id", automation.company_id)
        .in("status", ["novo", "atendimento"]);

      if (!leads || leads.length === 0) continue;

      for (const lead of leads) {
        // Check if we already sent this automation to this lead
        const { data: existingLog } = await supabase
          .from("automation_logs")
          .select("id")
          .eq("automation_id", automation.id)
          .eq("lead_id", lead.id)
          .limit(1);

        if (existingLog && existingLog.length > 0) continue;

        // Get last message for this lead
        const { data: lastMessages } = await supabase
          .from("messages")
          .select("type, created_at")
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (!lastMessages || lastMessages.length === 0) continue;

        const lastMsg = lastMessages[0];

        // Only follow up if last message was sent by us and is older than delay
        if (lastMsg.type !== "enviada") continue;
        if (lastMsg.created_at > cutoffTime) continue;

        // Replace placeholders in message
        const finalMessage = automation.message
          .replace(/\{nome\}/g, lead.name)
          .replace(/\{telefone\}/g, lead.phone);

        // Send WhatsApp message
        const sendResult = await sendWhatsAppMessage(
          company.whatsapp_token,
          company.whatsapp_phone_id,
          lead.phone,
          finalMessage
        );

        if (sendResult.ok) {
          // Save message
          await supabase.from("messages").insert({
            lead_id: lead.id,
            content: finalMessage,
            type: "enviada",
            company_id: automation.company_id,
          });

          // Log automation execution
          await supabase.from("automation_logs").insert({
            automation_id: automation.id,
            lead_id: lead.id,
            company_id: automation.company_id,
            status: "sent",
          });

          totalSent++;
          console.log("Follow-up sent to", lead.phone, "for automation", automation.name);
        } else {
          console.error("Failed to send follow-up to", lead.phone);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: totalSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Process automations error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
