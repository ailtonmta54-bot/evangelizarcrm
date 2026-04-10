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
    const { flow_id, lead_id, company_id } = await req.json();

    if (!flow_id || !lead_id || !company_id) {
      return new Response(JSON.stringify({ error: "flow_id, lead_id and company_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get flow
    const { data: flow } = await supabase.from("flows").select("*").eq("id", flow_id).single();
    if (!flow || !flow.active) {
      return new Response(JSON.stringify({ skipped: true, reason: "Flow inactive or not found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get nodes and edges
    const { data: nodes } = await supabase.from("flow_nodes").select("*").eq("flow_id", flow_id);
    const { data: edges } = await supabase.from("flow_edges").select("*").eq("flow_id", flow_id);

    if (!nodes || nodes.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "No nodes" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get lead
    const { data: lead } = await supabase.from("leads").select("*").eq("id", lead_id).single();
    if (!lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find trigger node (entry point)
    const triggerNode = nodes.find((n: any) => n.node_type === "trigger");
    if (!triggerNode) {
      return new Response(JSON.stringify({ error: "No trigger node" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the agent linked to this lead (for WhatsApp credentials)
    let agent: any = null;
    if (lead.agent_id) {
      const { data } = await supabase.from("agents").select("*").eq("id", lead.agent_id).single();
      agent = data;
    }
    if (!agent) {
      // Fallback: get default agent
      const { data } = await supabase.from("agents").select("*")
        .eq("company_id", company_id).eq("is_default", true).limit(1).single();
      agent = data;
    }

    // Build adjacency map from edges
    const adjacencyMap: Record<string, string[]> = {};
    const edgeMap: Record<string, any> = {};
    for (const edge of (edges || [])) {
      const key = edge.source_handle ? `${edge.source_node_id}:${edge.source_handle}` : edge.source_node_id;
      if (!adjacencyMap[edge.source_node_id]) adjacencyMap[edge.source_node_id] = [];
      adjacencyMap[edge.source_node_id].push(edge.target_node_id);
      edgeMap[key] = edge;
    }

    const nodeMap: Record<string, any> = {};
    for (const n of nodes) nodeMap[n.id] = n;

    // Determine WhatsApp provider
    const provider = agent?.whatsapp_provider || "official";

    // Helper to send WhatsApp message (supports Official API and Z-API)
    async function sendWhatsApp(phone: string, message: string) {
      if (provider === "zapi") {
        return await sendViaZapi(phone, { type: "text", text: message });
      }
      return await sendViaOfficial(phone, {
        messaging_product: "whatsapp", to: phone, type: "text", text: { body: message },
      });
    }

    // Helper to send media via WhatsApp
    async function sendWhatsAppMedia(phone: string, mediaType: string, mediaUrl: string, caption?: string) {
      if (provider === "zapi") {
        return await sendViaZapi(phone, { type: mediaType, url: mediaUrl, caption });
      }
      const mediaPayload: any = {
        messaging_product: "whatsapp", to: phone, type: mediaType,
        [mediaType]: { link: mediaUrl, ...(caption ? { caption } : {}) },
      };
      return await sendViaOfficial(phone, mediaPayload);
    }

    // Helper to send interactive buttons
    async function sendWhatsAppButtons(phone: string, bodyText: string, buttons: string[]) {
      const buttonPayload = buttons.filter(Boolean).slice(0, 3).map((text, i) => ({
        type: "reply", reply: { id: `btn_${i}`, title: text.substring(0, 20) },
      }));
      if (provider === "zapi") {
        return await sendViaZapi(phone, { type: "buttons", text: bodyText, buttons: buttonPayload });
      }
      return await sendViaOfficial(phone, {
        messaging_product: "whatsapp", to: phone, type: "interactive",
        interactive: {
          type: "button", body: { text: bodyText },
          action: { buttons: buttonPayload },
        },
      });
    }

    // Official WhatsApp API sender
    async function sendViaOfficial(phone: string, payload: any) {
      const token = agent?.whatsapp_token;
      const phoneId = agent?.whatsapp_phone_id;
      if (!token || !phoneId) { console.error("No Official WhatsApp credentials"); return false; }
      const resp = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (resp.ok) {
        await supabase.from("messages").insert({
          lead_id, content: payload.text?.body || payload.interactive?.body?.text || "[mídia]", type: "enviada", company_id,
        });
        return true;
      }
      console.error("Official WA send failed:", await resp.text());
      return false;
    }

    // Z-API sender
    async function sendViaZapi(phone: string, payload: any) {
      const instanceId = agent?.zapi_instance_id;
      const zapiToken = agent?.zapi_token;
      if (!instanceId || !zapiToken) { console.error("No Z-API credentials"); return false; }
      
      let endpoint = "send-text";
      let body: any = { phone, message: payload.text || "" };
      
      if (payload.type === "image") {
        endpoint = "send-image"; body = { phone, image: payload.url, caption: payload.caption || "" };
      } else if (payload.type === "video") {
        endpoint = "send-video"; body = { phone, video: payload.url, caption: payload.caption || "" };
      } else if (payload.type === "audio") {
        endpoint = "send-audio"; body = { phone, audio: payload.url };
      } else if (payload.type === "document") {
        endpoint = "send-document"; body = { phone, document: payload.url, caption: payload.caption || "" };
      } else if (payload.type === "buttons") {
        endpoint = "send-button-list"; body = { phone, message: payload.text, buttons: payload.buttons };
      }

      const resp = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (resp.ok) {
        await supabase.from("messages").insert({
          lead_id, content: payload.text || payload.message || "[mídia]", type: "enviada", company_id,
        });
        return true;
      }
      console.error("Z-API send failed:", await resp.text());
      return false;
    }

    // Replace placeholders in message
    function replacePlaceholders(text: string) {
      return text
        .replace(/\{nome\}/gi, lead.name || "")
        .replace(/\{telefone\}/gi, lead.phone || "");
    }

    // Execute flow: walk the graph from trigger
    const executionLog: string[] = [];
    let currentNodeId = triggerNode.id;
    let steps = 0;
    const maxSteps = 50;

    while (currentNodeId && steps < maxSteps) {
      steps++;
      const node = nodeMap[currentNodeId];
      if (!node) break;

      const data = node.data || {};
      executionLog.push(`Step ${steps}: ${node.node_type} - ${node.label}`);

      switch (node.node_type) {
        case "trigger":
          // Just pass through
          break;

        case "message": {
          const msg = replacePlaceholders((data as any).message || "");
          if (msg) {
            await sendWhatsApp(lead.phone, msg);
            executionLog.push(`  → Sent WhatsApp: "${msg.substring(0, 50)}..."`);
          }
          break;
        }

        case "send_media": {
          const mediaType = (data as any).mediaType || "image";
          const mediaUrl = (data as any).mediaUrl || "";
          const caption = replacePlaceholders((data as any).mediaCaption || "");
          if (mediaUrl) {
            await sendWhatsAppMedia(lead.phone, mediaType, mediaUrl, caption);
            executionLog.push(`  → Sent ${mediaType}: ${mediaUrl.substring(0, 40)}...`);
          }
          break;
        }

        case "buttons": {
          const bodyText = replacePlaceholders((data as any).buttonText || "Escolha:");
          const buttons = ((data as any).buttonOptions || []).filter(Boolean);
          if (buttons.length > 0) {
            await sendWhatsAppButtons(lead.phone, bodyText, buttons);
            executionLog.push(`  → Sent buttons: ${buttons.join(", ")}`);
          }
          break;
        }

        case "webhook": {
          const webhookUrl = (data as any).webhookUrl;
          const method = (data as any).webhookMethod || "POST";
          if (webhookUrl) {
            let headers: Record<string, string> = { "Content-Type": "application/json" };
            try {
              const custom = JSON.parse((data as any).webhookHeaders || "{}");
              headers = { ...headers, ...custom };
            } catch {}
            const webhookBody = JSON.stringify({
              lead_id, lead_name: lead.name, lead_phone: lead.phone,
              lead_status: lead.status, company_id,
              timestamp: new Date().toISOString(),
            });
            try {
              await fetch(webhookUrl, {
                method, headers, ...(method === "POST" ? { body: webhookBody } : {}),
              });
              executionLog.push(`  → Webhook ${method}: ${webhookUrl.substring(0, 40)}...`);
            } catch (err) {
              executionLog.push(`  → Webhook failed: ${err}`);
            }
          }
          break;
        }

        case "delay": {
          const value = parseInt((data as any).delayValue || "1");
          const unit = (data as any).delayUnit || "hours";
          const delayMs = unit === "minutes" ? value * 60000 : unit === "days" ? value * 86400000 : value * 3600000;
          // For now, log the delay (real implementation would schedule a continuation)
          executionLog.push(`  → Delay: ${value} ${unit} (${delayMs}ms)`);
          // In production, you'd schedule and stop here, resuming later
          break;
        }

        case "condition": {
          const condType = (data as any).conditionType || "response_contains";
          const condValue = (data as any).conditionValue || "";
          // Get last received message
          const { data: lastMsg } = await supabase.from("messages")
            .select("content").eq("lead_id", lead_id).eq("type", "recebida")
            .order("created_at", { ascending: false }).limit(1).single();

          let conditionMet = false;
          if (condType === "response_contains" && lastMsg) {
            conditionMet = lastMsg.content.toLowerCase().includes(condValue.toLowerCase());
          } else if (condType === "no_response") {
            conditionMet = !lastMsg;
          } else if (condType === "status_is") {
            conditionMet = lead.status === condValue;
          }

          executionLog.push(`  → Condition ${conditionMet ? "TRUE" : "FALSE"}`);

          // If condition is false, follow the "false" handle
          if (!conditionMet) {
            const falseEdge = edgeMap[`${currentNodeId}:false`];
            if (falseEdge) {
              currentNodeId = falseEdge.target_node_id;
              continue;
            }
          }
          break;
        }

        case "router": {
          const routes = (data as any).routes || [];
          const { data: lastMsg } = await supabase.from("messages")
            .select("content").eq("lead_id", lead_id).eq("type", "recebida")
            .order("created_at", { ascending: false }).limit(1).single();

          const responseText = (lastMsg?.content || "").toLowerCase();
          let matchedRouteId: string | null = null;

          for (const route of routes) {
            if (route.keyword && responseText.includes(route.keyword.toLowerCase())) {
              matchedRouteId = route.id;
              executionLog.push(`  → Router matched: "${route.label || route.keyword}"`);
              break;
            }
          }

          if (matchedRouteId) {
            const routeEdge = edgeMap[`${currentNodeId}:${matchedRouteId}`];
            if (routeEdge) {
              currentNodeId = routeEdge.target_node_id;
              continue;
            }
          } else {
            // Follow default output
            const defaultEdge = edgeMap[`${currentNodeId}:default`];
            if (defaultEdge) {
              currentNodeId = defaultEdge.target_node_id;
              continue;
            }
          }
          executionLog.push(`  → Router: no match, ending`);
          break;
        }

        case "assign_agent": {
          const agentId = (data as any).agentId;
          if (agentId) {
            await supabase.from("leads").update({ agent_id: agentId }).eq("id", lead_id);
            executionLog.push(`  → Assigned agent: ${agentId}`);
          }
          break;
        }

        case "add_tag": {
          executionLog.push(`  → Tag: ${(data as any).tagValue || ""}`);
          break;
        }

        case "move_crm": {
          const newStatus = (data as any).newStatus;
          if (newStatus) {
            await supabase.from("leads").update({ status: newStatus }).eq("id", lead_id);
            executionLog.push(`  → Moved to: ${newStatus}`);
          }
          break;
        }
      }

      // Move to next node
      const nextNodes = adjacencyMap[currentNodeId];
      if (nextNodes && nextNodes.length > 0) {
        currentNodeId = nextNodes[0]; // Follow first connection
      } else {
        break;
      }
    }

    return new Response(
      JSON.stringify({ success: true, steps, log: executionLog }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Flow execution error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
