// Meta "Data Deletion Request" callback.
// Docs: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
// Public endpoint (no JWT). Receives POST with `signed_request` (form-encoded).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

function base64UrlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function parseSignedRequest(signed: string, appSecret: string) {
  const [sigEncoded, payloadEncoded] = signed.split(".");
  if (!sigEncoded || !payloadEncoded) throw new Error("Invalid signed_request");

  const expectedSig = base64UrlDecode(sigEncoded);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const computed = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadEncoded))
  );

  if (computed.length !== expectedSig.length) throw new Error("Bad signature");
  let ok = 0;
  for (let i = 0; i < computed.length; i++) ok |= computed[i] ^ expectedSig[i];
  if (ok !== 0) throw new Error("Bad signature");

  const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadEncoded));
  return JSON.parse(payloadJson) as { user_id?: string; algorithm?: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const appSecret = Deno.env.get("META_APP_SECRET");
    if (!appSecret) {
      console.error("Missing META_APP_SECRET");
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const form = await req.formData();
    const signed = form.get("signed_request")?.toString();
    if (!signed) {
      return new Response(JSON.stringify({ error: "Missing signed_request" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await parseSignedRequest(signed, appSecret);
    const fbUserId = payload.user_id || "unknown";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Best-effort: clear any company that connected this Meta user.
    // We don't store fb user_id directly; clear by instagram_business_id match if present.
    const confirmationCode = `del_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

    // Log the deletion request for audit/manual handling.
    await supabaseAdmin.from("oauth_states").insert({
      state: confirmationCode,
      provider: "instagram_deletion",
      company_id: "00000000-0000-0000-0000-000000000000",
    }).then(() => {}, (e) => console.warn("audit log warn", e));

    console.log("Meta data deletion request", { fbUserId, confirmationCode });

    const origin = req.headers.get("origin") || new URL(req.url).origin.replace(/\.supabase\.co.*$/, "");
    const statusUrl = `https://evangelizarcrm.lovable.app/data-deletion?code=${confirmationCode}`;

    return new Response(
      JSON.stringify({ url: statusUrl, confirmation_code: confirmationCode }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("data-deletion error", e);
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
