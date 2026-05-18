import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCOPES = [
  "instagram_basic",
  "instagram_manage_messages",
  "pages_messaging",
  "pages_show_list",
  "pages_manage_metadata",
  "business_management",
].join(",");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const META_APP_ID = Deno.env.get("META_APP_ID");
    if (!META_APP_ID) {
      return new Response(
        JSON.stringify({ error: "Integração Meta ainda não configurada pelo administrador da plataforma." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    const body = await req.json().catch(() => ({}));
    const returnTo: string = body?.return_to || "";

    const state = crypto.randomUUID() + "." + crypto.randomUUID();
    await supabaseAdmin.from("oauth_states").insert({
      state,
      company_id: profile.company_id,
      provider: "instagram",
    });

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/instagram-oauth-callback`;
    const authUrl =
      `https://www.facebook.com/v21.0/dialog/oauth` +
      `?client_id=${encodeURIComponent(META_APP_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state + (returnTo ? "|" + returnTo : ""))}` +
      `&scope=${encodeURIComponent(SCOPES)}` +
      `&response_type=code`;

    return new Response(JSON.stringify({ url: authUrl }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("oauth-start error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
