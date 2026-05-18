import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("company_id").eq("user_id", userId).single();
    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lead_id, message } = await req.json();
    if (!lead_id || !message) {
      return new Response(JSON.stringify({ error: "lead_id e message são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, instagram_user_id, company_id")
      .eq("id", lead_id).single();

    if (!lead || lead.company_id !== profile.company_id) {
      return new Response(JSON.stringify({ error: "Lead não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!lead.instagram_user_id) {
      return new Response(JSON.stringify({ error: "Lead não tem instagram_user_id (IGSID)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("instagram_access_token, instagram_business_id, instagram_enabled")
      .eq("id", profile.company_id).single();

    if (!company?.instagram_enabled || !company.instagram_access_token || !company.instagram_business_id) {
      return new Response(
        JSON.stringify({ error: "Instagram não configurado. Vá em Configurações → Instagram." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const igResponse = await fetch(
      `https://graph.facebook.com/v21.0/${company.instagram_business_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${company.instagram_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: { id: lead.instagram_user_id },
          message: { text: message },
          messaging_type: "RESPONSE",
        }),
      }
    );

    const igResult = await igResponse.json();
    if (!igResponse.ok) {
      console.error("Instagram API error:", igResult);
      return new Response(JSON.stringify({ error: igResult?.error?.message || "Erro ao enviar" }), {
        status: igResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin.from("messages").insert({
      lead_id,
      content: message,
      type: "enviada",
      company_id: profile.company_id,
    });

    return new Response(JSON.stringify({ success: true, ig_message_id: igResult.message_id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("instagram-send error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
