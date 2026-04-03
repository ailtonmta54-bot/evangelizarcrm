import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_id, company_id } = await req.json();

    if (!lead_id || !company_id) {
      return new Response(JSON.stringify({ error: "lead_id and company_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use platform-level OpenAI key (reseller model)
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error("OPENAI_API_KEY secret not configured");
      return new Response(JSON.stringify({ error: "OpenAI API key not configured on platform" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get SDR config
    const { data: sdrConfig, error: sdrError } = await supabase
      .from("sdr_config")
      .select("*")
      .eq("company_id", company_id)
      .single();

    if (sdrError || !sdrConfig) {
      return new Response(JSON.stringify({ error: "SDR config not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!sdrConfig.active) {
      return new Response(JSON.stringify({ skipped: true, reason: "SDR IA is disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get lead info
    const { data: lead } = await supabase
      .from("leads")
      .select("name, phone, ai_enabled")
      .eq("id", lead_id)
      .single();

    if (!lead?.ai_enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "AI disabled for this lead" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get conversation history (last 20 messages)
    const { data: history } = await supabase
      .from("messages")
      .select("content, type, created_at")
      .eq("lead_id", lead_id)
      .order("created_at", { ascending: true })
      .limit(20);

    // Build tone description
    const toneMap: Record<string, string> = {
      formal: "Seja formal e profissional.",
      persuasivo: "Seja persuasivo e convincente, destaque benefícios.",
      amigavel: "Seja amigável, cordial e acolhedor.",
    };

    const goalMap: Record<string, string> = {
      fechar: "Seu objetivo é fechar a venda. Conduza o cliente para a decisão de compra.",
      qualificar: "Seu objetivo é qualificar o lead. Faça perguntas para entender as necessidades.",
      agendar: "Seu objetivo é agendar uma reunião ou demonstração com o cliente.",
    };

    const systemPrompt = `Você é um SDR (Sales Development Representative) inteligente de uma empresa.

${sdrConfig.prompt}

${toneMap[sdrConfig.tone] || toneMap.amigavel}
${goalMap[sdrConfig.goal] || goalMap.qualificar}

Regras importantes:
- Responda de forma concisa (máximo 2-3 frases)
- Não use markdown ou formatação especial (é WhatsApp)
- Não se identifique como IA ou robô
- Use o nome do cliente quando possível: ${lead.name}
- Sempre termine com uma pergunta ou call-to-action
- Respeite o contexto da conversa anterior`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((msg) => ({
        role: msg.type === "recebida" ? "user" : "assistant",
        content: msg.content,
      })),
    ];

    // Call OpenAI API using platform key
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: aiMessages,
        temperature: Number(sdrConfig.temperature) || 0.7,
        max_tokens: 300,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("OpenAI API error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "OpenAI rate limit exceeded. Try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 401) {
        return new Response(JSON.stringify({ error: "Invalid OpenAI API key." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    const generatedMessage = aiResult.choices?.[0]?.message?.content?.trim();

    if (!generatedMessage) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("AI generated response for lead:", lead_id, generatedMessage);

    return new Response(
      JSON.stringify({ success: true, message: generatedMessage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("SDR AI error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
