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
    const { lead_id, company_id, agent_id } = await req.json();

    if (!lead_id || !company_id) {
      return new Response(JSON.stringify({ error: "lead_id and company_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Get lead info
    const { data: lead } = await supabase
      .from("leads")
      .select("name, phone, ai_enabled, agent_id")
      .eq("id", lead_id)
      .single();

    if (!lead?.ai_enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "AI disabled for this lead" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get agent - use provided agent_id, then lead's agent, then default
    let agent = null;
    const targetAgentId = agent_id || lead.agent_id;

    if (targetAgentId) {
      const { data } = await supabase.from("agents").select("*").eq("id", targetAgentId).single();
      agent = data;
    }

    if (!agent) {
      const { data } = await supabase.from("agents").select("*")
        .eq("company_id", company_id)
        .eq("active", true)
        .eq("is_default", true)
        .limit(1)
        .single();
      agent = data;
    }

    if (!agent) {
      const { data } = await supabase.from("agents").select("*")
        .eq("company_id", company_id)
        .eq("active", true)
        .limit(1)
        .single();
      agent = data;
    }

    if (!agent || !agent.active) {
      return new Response(JSON.stringify({ skipped: true, reason: "No active agent found" }), {
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

    const toneMap: Record<string, string> = {
      formal: "Seja formal e profissional.",
      persuasivo: "Seja persuasivo e convincente, destaque benefícios.",
      amigavel: "Seja amigável, cordial e acolhedor.",
      tecnico: "Seja técnico e detalhista, use termos específicos da área.",
      casual: "Seja casual e descontraído, como um amigo.",
    };

    const goalMap: Record<string, string> = {
      fechar: "Seu objetivo é fechar a venda. Conduza o cliente para a decisão de compra.",
      qualificar: "Seu objetivo é qualificar o lead. Faça perguntas para entender as necessidades.",
      agendar: "Seu objetivo é agendar uma reunião ou demonstração com o cliente.",
      suporte: "Seu objetivo é resolver o problema do cliente de forma eficiente.",
      informar: "Seu objetivo é informar e educar o cliente sobre os produtos/serviços.",
    };

    const knowledgeBlock = agent.knowledge ? `\n\nBase de conhecimento:\n${agent.knowledge}` : "";

    const systemPrompt = `Você é "${agent.name}", um assistente virtual inteligente de uma empresa.

${agent.prompt}
${knowledgeBlock}

${toneMap[agent.tone] || toneMap.amigavel}
${goalMap[agent.goal] || goalMap.qualificar}

Regras importantes:
- Responda de forma concisa (máximo 2-3 frases)
- Não use markdown ou formatação especial (é WhatsApp)
- Não se identifique como IA ou robô
- Use o nome do cliente quando possível: ${lead.name}
- Sempre termine com uma pergunta ou call-to-action
- Respeite o contexto da conversa anterior`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((msg: any) => ({
        role: msg.type === "recebida" ? "user" : "assistant",
        content: msg.content,
      })),
    ];

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: aiMessages,
        temperature: Number(agent.temperature) || 0.7,
        max_tokens: 300,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("OpenAI API error:", aiResponse.status, errorText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: aiResponse.status === 429 ? 429 : 500,
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

    console.log(`Agent "${agent.name}" response for lead ${lead_id}:`, generatedMessage);

    return new Response(
      JSON.stringify({ success: true, message: generatedMessage, agent_name: agent.name }),
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
