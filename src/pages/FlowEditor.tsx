import { useState, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  MarkerType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, MessageSquare, Clock, GitBranch, UserCheck, Tag, ArrowRightLeft, Route } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";
import { nodeTypes } from "@/components/flow/FlowNodeTypes";
import { NodeConfigPanel } from "@/components/flow/NodeConfigPanel";

const blockTypes = [
  { type: "message", label: "Mensagem", icon: MessageSquare, color: "text-blue-600" },
  { type: "delay", label: "Aguardar", icon: Clock, color: "text-purple-600" },
  { type: "condition", label: "Condição", icon: GitBranch, color: "text-orange-600" },
  { type: "router", label: "Roteador", icon: Route, color: "text-indigo-600" },
  { type: "assign_agent", label: "Direcionar", icon: UserCheck, color: "text-green-600" },
  { type: "add_tag", label: "Tag", icon: Tag, color: "text-pink-600" },
  { type: "move_crm", label: "Mover CRM", icon: ArrowRightLeft, color: "text-cyan-600" },
];

let nodeId = 0;
const getNodeId = () => `node_${Date.now()}_${nodeId++}`;

export default function FlowEditor() {
  const { flowId } = useParams();
  const navigate = useNavigate();
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [flowName, setFlowName] = useState("");
  const [flowActive, setFlowActive] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load agents
  const { data: agents = [] } = useQuery({
    queryKey: ["agents", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("agents").select("id, name").eq("company_id", companyId!);
      return data || [];
    },
    enabled: !!companyId,
  });

  // Load flow data
  const { data: flowData } = useQuery({
    queryKey: ["flow", flowId],
    queryFn: async () => {
      const { data: flow } = await supabase.from("flows").select("*").eq("id", flowId!).single();
      const { data: dbNodes } = await supabase.from("flow_nodes").select("*").eq("flow_id", flowId!);
      const { data: dbEdges } = await supabase.from("flow_edges").select("*").eq("flow_id", flowId!);
      return { flow, nodes: dbNodes || [], edges: dbEdges || [] };
    },
    enabled: !!flowId && flowId !== "new",
  });

  useEffect(() => {
    if (flowData && !loaded) {
      setFlowName(flowData.flow?.name || "");
      setFlowActive(flowData.flow?.active || false);
      if (flowData.nodes.length > 0) {
        setNodes(flowData.nodes.map((n: any) => ({
          id: n.id,
          type: "flowNode",
          position: { x: Number(n.position_x), y: Number(n.position_y) },
          data: { ...(n.data as Record<string, unknown>), label: n.label, nodeType: n.node_type },
        })));
        setEdges(flowData.edges.map((e: any) => ({
          id: e.id,
          source: e.source_node_id,
          target: e.target_node_id,
          sourceHandle: e.source_handle || undefined,
          label: e.label || undefined,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 2 },
        })));
      }
      setLoaded(true);
    }
  }, [flowData, loaded]);

  // For new flows, add a trigger node
  useEffect(() => {
    if (flowId === "new" && !loaded) {
      setNodes([{
        id: getNodeId(),
        type: "flowNode",
        position: { x: 250, y: 50 },
        data: { label: "Início", nodeType: "trigger", triggerType: "keyword", triggerValue: "" },
      }]);
      setLoaded(true);
    }
  }, [flowId, loaded]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({
      ...params,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2 },
    }, eds));
  }, []);

  const addNode = (type: string) => {
    const id = getNodeId();
    const newNode: Node = {
      id,
      type: "flowNode",
      position: { x: 250, y: (nodes.length + 1) * 120 },
      data: { label: blockTypes.find((b) => b.type === type)?.label || type, nodeType: type },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const updateNodeData = (id: string, data: Record<string, any>) => {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data } : n));
    if (selectedNode?.id === id) setSelectedNode((prev) => prev ? { ...prev, data } : null);
  };

  const onNodeClick = (_: React.MouseEvent, node: Node) => setSelectedNode(node);
  const onPaneClick = () => setSelectedNode(null);

  const deleteNode = (id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  // Save flow
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !flowName) throw new Error("Missing data");

      let fId = flowId;

      // Get trigger node data for flow-level trigger info
      const triggerNode = nodes.find((n) => (n.data.nodeType as string) === "trigger");

      if (flowId === "new") {
        const { data, error } = await supabase.from("flows").insert({
          company_id: companyId,
          name: flowName,
          active: flowActive,
          trigger_type: (triggerNode?.data.triggerType as string) || "keyword",
          trigger_value: (triggerNode?.data.triggerValue as string) || "",
        }).select("id").single();
        if (error) throw error;
        fId = data.id;
      } else {
        await supabase.from("flows").update({
          name: flowName,
          active: flowActive,
          trigger_type: (triggerNode?.data.triggerType as string) || "keyword",
          trigger_value: (triggerNode?.data.triggerValue as string) || "",
        }).eq("id", fId!);

        // Delete old nodes and edges
        await supabase.from("flow_edges").delete().eq("flow_id", fId!);
        await supabase.from("flow_nodes").delete().eq("flow_id", fId!);
      }

      // Insert nodes
      if (nodes.length > 0) {
        const nodeIdMap: Record<string, string> = {};
        for (const node of nodes) {
          const { data: inserted, error } = await supabase.from("flow_nodes").insert({
            flow_id: fId!,
            node_type: (node.data.nodeType as string) || "message",
            label: (node.data.label as string) || "",
            data: node.data as any,
            position_x: node.position.x,
            position_y: node.position.y,
          }).select("id").single();
          if (error) throw error;
          nodeIdMap[node.id] = inserted.id;
        }

        // Insert edges with mapped IDs
        if (edges.length > 0) {
          const edgeInserts = edges.map((e) => ({
            flow_id: fId!,
            source_node_id: nodeIdMap[e.source],
            target_node_id: nodeIdMap[e.target],
            source_handle: e.sourceHandle || "",
            label: (e.label as string) || "",
          }));
          const { error } = await supabase.from("flow_edges").insert(edgeInserts);
          if (error) throw error;
        }
      }

      return fId;
    },
    onSuccess: (fId) => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
      toast.success("Fluxo salvo!");
      if (flowId === "new") navigate(`/automacoes/flow/${fId}`, { replace: true });
    },
    onError: () => toast.error("Erro ao salvar fluxo"),
  });

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full">
      {/* Sidebar - Block palette */}
      <div className="w-56 border-r bg-background p-3 space-y-3 shrink-0 overflow-y-auto">
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start" onClick={() => navigate("/automacoes")}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Nome do fluxo</Label>
          <Input value={flowName} onChange={(e) => setFlowName(e.target.value)} placeholder="Meu fluxo" className="text-sm" />
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={flowActive} onCheckedChange={setFlowActive} />
          <Label className="text-sm">{flowActive ? "Ativo" : "Inativo"}</Label>
        </div>

        <div className="pt-2 border-t">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Blocos</Label>
          <div className="space-y-1.5 mt-2">
            {blockTypes.map((b) => (
              <button
                key={b.type}
                onClick={() => addNode(b.type)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg border bg-card hover:bg-accent transition-colors"
              >
                <b.icon className={`h-4 w-4 ${b.color}`} />
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !flowName} className="w-full gap-2 mt-4">
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Salvando..." : "Salvar fluxo"}
        </Button>
      </div>

      {/* Canvas */}
      <div className="flex-1" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode="Delete"
          className="bg-muted/30"
        >
          <Background gap={20} size={1} />
          <Controls />
          <MiniMap zoomable pannable className="!bg-background !border" />
        </ReactFlow>
      </div>

      {/* Node config panel */}
      {selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          onUpdate={updateNodeData}
          onClose={() => setSelectedNode(null)}
          onDelete={deleteNode}
          agents={agents}
        />
      )}
    </div>
  );
}
