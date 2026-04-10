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

    // 1. Extract metadata (title, description, og tags) - works even for SPAs
    const metaParts: string[] = [];

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch?.[1]?.trim()) {
      metaParts.push(`Título: ${titleMatch[1].trim()}`);
    }

    // Extract all meta tags content (description, og:*, twitter:*)
    const metaRegex = /<meta[^>]+(?:name|property)\s*=\s*["']([^"']+)["'][^>]+content\s*=\s*["']([^"']+)["'][^>]*>|<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+(?:name|property)\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let metaMatch;
    while ((metaMatch = metaRegex.exec(html)) !== null) {
      const name = (metaMatch[1] || metaMatch[4] || "").toLowerCase();
      const content = (metaMatch[2] || metaMatch[3] || "").trim();
      if (content && (name === "description" || name.startsWith("og:") || name === "keywords")) {
        metaParts.push(`${name}: ${content}`);
      }
    }

    // 2. Extract visible text content (standard approach)
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

    // 3. Extract text from JSON-LD structured data (common in modern sites)
    const jsonLdRegex = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let jsonLdMatch;
    while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
      try {
        const jsonData = JSON.parse(jsonLdMatch[1]);
        const extractText = (obj: unknown): string => {
          if (typeof obj === "string") return obj;
          if (Array.isArray(obj)) return obj.map(extractText).join(" ");
          if (obj && typeof obj === "object") {
            return Object.entries(obj as Record<string, unknown>)
              .filter(([k]) => ["name", "description", "text", "headline", "articleBody", "about"].includes(k))
              .map(([, v]) => extractText(v))
              .join(" ");
          }
          return "";
        };
        const ldText = extractText(jsonData).trim();
        if (ldText.length > 10) {
          metaParts.push(`Dados estruturados: ${ldText}`);
        }
      } catch {
        // ignore invalid JSON-LD
      }
    }

    // 4. Combine metadata + body text
    const metaContent = metaParts.join("\n");
    let finalContent = "";

    if (text.length >= 20) {
      finalContent = metaContent ? `${metaContent}\n\n---\n\n${text}` : text;
    } else if (metaContent.length >= 20) {
      // SPA site - we got metadata but no body text
      finalContent = `${metaContent}\n\n(Nota: Este site usa renderização JavaScript. O conteúdo principal pode não ter sido totalmente extraído. As informações acima foram obtidas dos metadados do site.)`;
    } else {
      return respond(false, {
        error: "Não foi possível extrair conteúdo deste site. Ele pode usar renderização JavaScript (SPA). Tente colar o conteúdo manualmente na aba 'Texto'.",
      });
    }

    if (finalContent.length > 8000) {
      finalContent = finalContent.substring(0, 8000) + "...";
    }

    console.log(`Extracted ${finalContent.length} characters from ${formattedUrl}`);

    return respond(true, { content: finalContent, url: formattedUrl });
  } catch (error) {
    console.error("Scrape error:", error);
    return respond(false, { error: "Erro interno ao processar o site. Tente novamente." });
  }
});
