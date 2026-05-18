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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // Best-effort: unsubscribe page from webhook
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("instagram_access_token, instagram_page_id")
      .eq("id", profile.company_id).single();

    if (company?.instagram_page_id && company?.instagram_access_token) {
      try {
        await fetch(
          `https://graph.facebook.com/v21.0/${company.instagram_page_id}/subscribed_apps?access_token=${company.instagram_access_token}`,
          { method: "DELETE" }
        );
      } catch (e) { console.warn("unsubscribe warn", e); }
    }

    await supabaseAdmin.from("companies").update({
      instagram_access_token: "",
      instagram_business_id: "",
      instagram_page_id: "",
      instagram_username: "",
      instagram_profile_pic_url: "",
      instagram_connected_at: null,
      instagram_token_expires_at: null,
      instagram_enabled: false,
    }).eq("id", profile.company_id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("disconnect error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
