import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function redirect(url: string) {
  return new Response(null, { status: 302, headers: { Location: url, ...corsHeaders } });
}

function popupResponse(status: "connected" | "error", reason?: string) {
  const title = status === "connected" ? "Instagram conectado!" : "Falha na conexão";
  const msg = status === "connected" ? "Pode fechar esta janela." : (reason || "Erro desconhecido");
  const fallbackUrl = status === "connected"
    ? "/settings?instagram=connected"
    : `/settings?instagram=error&reason=${encodeURIComponent(reason || "unknown")}`;
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<title>Instagram</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#fff;text-align:center;padding:24px}</style>
</head>
<body>
<div>
<h2>${title}</h2>
<p>${msg}</p>
</div>
<script>
(function(){
  var payload = { type: "instagram-oauth", status: ${JSON.stringify(status)}, reason: ${JSON.stringify(reason || "")} };
  var notified = false;
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, "*");
      notified = true;
    }
  } catch(e) {}
  setTimeout(function(){
    try { window.close(); } catch(e) {}
    setTimeout(function(){
      if (!window.closed) {
        window.location.replace(${JSON.stringify(fallbackUrl)});
      }
    }, 400);
  }, 500);
})();
</script>
</body>
</html>`;
  const bytes = new TextEncoder().encode(html);
  return new Response(bytes, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const rawState = url.searchParams.get("state") || "";
  const errorParam = url.searchParams.get("error");

  // Parse return_to from state ("uuid.uuid|<returnTo or 'popup'>")
  const [stateId, returnTo] = rawState.split("|");
  const isPopup = returnTo === "popup";
  const fallbackRedirect = returnTo || "/settings";

  const fail = (reason: string) =>
    isPopup ? popupResponse("error", reason) : redirect(`${fallbackRedirect}?instagram=error&reason=${encodeURIComponent(reason)}`);
  const ok = () =>
    isPopup ? popupResponse("connected") : redirect(`${fallbackRedirect}?instagram=connected`);

  if (errorParam) return fail(errorParam);
  if (!code || !stateId) return fail("missing_code");

  const META_APP_ID = Deno.env.get("META_APP_ID");
  const META_APP_SECRET = Deno.env.get("META_APP_SECRET");
  if (!META_APP_ID || !META_APP_SECRET) return fail("platform_not_configured");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // 1. Validate state
    const { data: stateRow } = await supabase
      .from("oauth_states")
      .select("id, company_id, expires_at")
      .eq("state", stateId)
      .eq("provider", "instagram")
      .maybeSingle();

    if (!stateRow || new Date(stateRow.expires_at).getTime() < Date.now()) {
      return fail("invalid_state");
    }
    await supabase.from("oauth_states").delete().eq("id", stateRow.id);
    const companyId = stateRow.company_id;

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/instagram-oauth-callback`;

    // 2. Exchange code for short-lived token
    const shortRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token` +
        `?client_id=${META_APP_ID}` +
        `&client_secret=${META_APP_SECRET}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&code=${encodeURIComponent(code)}`
    );
    const shortData = await shortRes.json();
    if (!shortRes.ok || !shortData.access_token) {
      console.error("short token error", shortData);
      return fail("token_exchange");
    }

    // 3. Exchange to long-lived (60 days)
    const longRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token` +
        `?grant_type=fb_exchange_token` +
        `&client_id=${META_APP_ID}` +
        `&client_secret=${META_APP_SECRET}` +
        `&fb_exchange_token=${shortData.access_token}`
    );
    const longData = await longRes.json();
    if (!longRes.ok || !longData.access_token) {
      console.error("long token error", longData);
      return fail("long_token");
    }
    const userAccessToken: string = longData.access_token;
    const expiresIn: number = longData.expires_in || 60 * 24 * 3600;

    // 4. Get pages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userAccessToken}`
    );
    const pagesData = await pagesRes.json();
    const pages: any[] = pagesData.data || [];
    const pageWithIg = pages.find((p) => p.instagram_business_account?.id);
    if (!pageWithIg) {
      return fail("no_instagram_business_account");
    }

    const pageId: string = pageWithIg.id;
    const pageAccessToken: string = pageWithIg.access_token;
    const igBusinessId: string = pageWithIg.instagram_business_account.id;

    // 5. Get IG profile
    const profRes = await fetch(
      `https://graph.facebook.com/v21.0/${igBusinessId}?fields=username,profile_picture_url&access_token=${pageAccessToken}`
    );
    const profData = await profRes.json();

    // 6. Subscribe Page to messaging webhook (Messenger-style routing)
    const subPageRes = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${pageAccessToken}`,
      { method: "POST" }
    );
    const subPageData = await subPageRes.json();
    console.log("[oauth] page subscribed_apps result:", JSON.stringify(subPageData));
    if (!subPageRes.ok) console.error("[oauth] page subscribe FAILED:", subPageData);

    // 6b. Subscribe Instagram Business Account directly (required for IG DM webhooks)
    const subIgRes = await fetch(
      `https://graph.facebook.com/v21.0/${igBusinessId}/subscribed_apps?subscribed_fields=messages&access_token=${pageAccessToken}`,
      { method: "POST" }
    );
    const subIgData = await subIgRes.json();
    console.log("[oauth] IG subscribed_apps result:", JSON.stringify(subIgData));
    if (!subIgRes.ok) console.error("[oauth] IG subscribe FAILED:", subIgData);

    console.log("[oauth] saved company", { companyId, pageId, igBusinessId, username: profData?.username });

        instagram_access_token: pageAccessToken,
        instagram_business_id: igBusinessId,
        instagram_page_id: pageId,
        instagram_username: profData?.username || "",
        instagram_profile_pic_url: profData?.profile_picture_url || "",
        instagram_connected_at: new Date().toISOString(),
        instagram_token_expires_at: expiresAt,
        instagram_enabled: true,
      })
      .eq("id", companyId);

    if (upErr) {
      console.error("save company error", upErr);
      return fail("save_failed");
    }

    return ok();
  } catch (e) {
    console.error("oauth-callback error", e);
    return fail("unexpected");
  }
});
