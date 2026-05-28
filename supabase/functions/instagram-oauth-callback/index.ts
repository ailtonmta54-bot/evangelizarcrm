import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function redirect(url: string) {
  return new Response(null, { status: 302, headers: { Location: url, ...corsHeaders } });
}

function popupResponse(status: "connected" | "error", reason?: string) {
  const ok = status === "connected";
  const title = ok ? "Conexão bem-sucedida!" : "Não foi possível conectar";
  const subtitle = ok
    ? "Seu Instagram foi conectado ao CRM."
    : "Verifique sua conta e tente novamente.";
  const fallbackUrl = ok
    ? "/settings?instagram=connected"
    : `/settings?instagram=error&reason=${encodeURIComponent(reason || "unknown")}`;
  const accent = ok ? "#10b981" : "#ef4444";
  const icon = ok
    ? `<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    : `<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${ok ? "Instagram conectado" : "Erro ao conectar"}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#f1f5f9;padding:24px}
  .card{background:rgba(255,255,255,.04);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:40px 32px;max-width:420px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)}
  .icon{width:80px;height:80px;border-radius:50%;background:${accent};display:flex;align-items:center;justify-content:center;margin:0 auto 24px;animation:pop .5s cubic-bezier(.34,1.56,.64,1)}
  @keyframes pop{0%{transform:scale(0)}100%{transform:scale(1)}}
  h1{margin:0 0 8px;font-size:24px;font-weight:600}
  p{margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.5}
  .btn{display:inline-block;padding:12px 24px;border-radius:10px;font-weight:500;text-decoration:none;cursor:pointer;border:none;font-size:14px;transition:opacity .2s;margin:4px}
  .btn-primary{background:linear-gradient(135deg,#ec4899,#a855f7,#f97316);color:white}
  .btn-secondary{background:rgba(255,255,255,.08);color:#f1f5f9;border:1px solid rgba(255,255,255,.12)}
  .btn:hover{opacity:.9}
  .countdown{font-size:12px;color:#64748b;margin-top:16px}
</style>
</head>
<body>
<div class="card">
  <div class="icon">${icon}</div>
  <h1>${title}</h1>
  <p>${subtitle}</p>
  ${ok
    ? `<a class="btn btn-primary" href="${fallbackUrl}" id="goto">Ir para o CRM</a>
       <div class="countdown" id="cd">Redirecionando em 2s...</div>`
    : `<a class="btn btn-primary" href="${fallbackUrl}">Tentar novamente</a>
       <a class="btn btn-secondary" href="/settings">Voltar para integrações</a>`}
</div>
<script>
(function(){
  var payload = { type: "instagram-oauth", status: ${JSON.stringify(status)}, reason: ${JSON.stringify(reason || "")} };
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, "*");
    }
  } catch(e) {}
  ${ok ? `
  var seconds = 2;
  var cd = document.getElementById("cd");
  var timer = setInterval(function(){
    seconds--;
    if (cd) cd.textContent = "Redirecionando em " + seconds + "s...";
    if (seconds <= 0) {
      clearInterval(timer);
      try { window.close(); } catch(e) {}
      setTimeout(function(){
        if (!window.closed) window.location.replace(${JSON.stringify(fallbackUrl)});
      }, 300);
    }
  }, 1000);
  ` : ""}
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

    console.log("[oauth] saving company", { companyId, pageId, igBusinessId, username: profData?.username });

    // 7. Save to company
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const { error: upErr } = await supabase
      .from("companies")
      .update({
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
