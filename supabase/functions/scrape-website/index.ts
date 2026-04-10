const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function respond(ok: boolean, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ ok, ...payload }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return respond(false, { error: "URL é obrigatória" });
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log("Scraping URL:", formattedUrl);

    let response: Response;
    try {
      response = await fetch(formattedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
        redirect: "follow",
      });
    } catch (fetchErr) {
      console.error("Fetch error:", fetchErr);
      return respond(false, { error: `Não foi possível acessar o site: ${fetchErr.message}` });
    }

    if (!response.ok) {
      return respond(false, { error: `O site retornou erro ${response.status}. Verifique se a URL está correta.` });
    }

    const html = await response.text();

    // Remove script, style, nav, footer, header tags and their content
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<aside[\s\S]*?<\/aside>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length > 5000) {
      text = text.substring(0, 5000) + "...";
    }

    if (!text || text.length < 20) {
      return respond(false, { error: "Não foi possível extrair conteúdo significativo deste site. Tente outra URL." });
    }

    console.log(`Extracted ${text.length} characters from ${formattedUrl}`);

    return respond(true, { content: text, url: formattedUrl });
  } catch (error) {
    console.error("Scrape error:", error);
    return respond(false, { error: "Erro interno ao processar o site. Tente novamente." });
  }
});
