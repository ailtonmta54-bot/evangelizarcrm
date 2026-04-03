import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // CORS preflight
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
      // Find company with this verify token
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
        // Status update or other non-message event
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

      // Find company by phone number ID
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("id")
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
        const fromNumber = message.from; // sender phone number
        const messageText = message.text?.body || message.caption || "[mídia]";
        const contactName = value.contacts?.[0]?.profile?.name || fromNumber;

        // Find or create lead by phone number
        let { data: lead } = await supabase
          .from("leads")
          .select("id")
          .eq("phone", fromNumber)
          .eq("company_id", company.id)
          .single();

        if (!lead) {
          // Create new lead
          const { data: newLead, error: leadError } = await supabase
            .from("leads")
            .insert({
              name: contactName,
              phone: fromNumber,
              status: "novo",
              company_id: company.id,
            })
            .select("id")
            .single();

          if (leadError) {
            console.error("Error creating lead:", leadError);
            continue;
          }
          lead = newLead;
          console.log("New lead created:", lead.id, contactName);
        }

        // Save message
        const { error: msgError } = await supabase.from("messages").insert({
          lead_id: lead.id,
          content: messageText,
          type: "recebida",
          company_id: company.id,
        });

        if (msgError) {
          console.error("Error saving message:", msgError);
        } else {
          console.log("Message saved from:", fromNumber);
        }

        // Update lead's updated_at to bubble it up in inbox
        await supabase
          .from("leads")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", lead.id);
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
