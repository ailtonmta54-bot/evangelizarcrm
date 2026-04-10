import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { MessageSquare, Clock, GitBranch, UserCheck, Tag, ArrowRightLeft, Zap, Route, Image, Globe, ListChecks } from "lucide-react";

const nodeStyles: Record<string, { icon: typeof Zap; color: string; bg: string }> = {
  trigger: { icon: Zap, color: "text-amber-600", bg: "bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-700" },
  message: { icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-700" },
  send_media: { icon: Image, color: "text-teal-600", bg: "bg-teal-50 border-teal-300 dark:bg-teal-950 dark:border-teal-700" },
  buttons: { icon: ListChecks, color: "text-violet-600", bg: "bg-violet-50 border-violet-300 dark:bg-violet-950 dark:border-violet-700" },
  webhook: { icon: Globe, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-300 dark:bg-yellow-950 dark:border-yellow-700" },
  delay: { icon: Clock, color: "text-purple-600", bg: "bg-purple-50 border-purple-300 dark:bg-purple-950 dark:border-purple-700" },
  condition: { icon: GitBranch, color: "text-orange-600", bg: "bg-orange-50 border-orange-300 dark:bg-orange-950 dark:border-orange-700" },
  router: { icon: Route, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-300 dark:bg-indigo-950 dark:border-indigo-700" },
  assign_agent: { icon: UserCheck, color: "text-green-600", bg: "bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-700" },
  add_tag: { icon: Tag, color: "text-pink-600", bg: "bg-pink-50 border-pink-300 dark:bg-pink-950 dark:border-pink-700" },
  move_crm: { icon: ArrowRightLeft, color: "text-cyan-600", bg: "bg-cyan-50 border-cyan-300 dark:bg-cyan-950 dark:border-cyan-700" },
};

const nodeLabels: Record<string, string> = {
  trigger: "Gatilho",
  message: "Enviar Mensagem",
  send_media: "Enviar Mídia",
  buttons: "Botões",
  webhook: "Webhook",
  delay: "Aguardar",
  condition: "Condição",
  router: "Roteador",
  assign_agent: "Direcionar Agente",
  add_tag: "Adicionar Tag",
  move_crm: "Mover no CRM",
};

const routeColors = ["bg-blue-500", "bg-green-500", "bg-orange-500", "bg-pink-500", "bg-purple-500"];

function FlowNode({ data, selected }: NodeProps) {
  const nodeType = (data.nodeType as string) || "message";
  const style = nodeStyles[nodeType] || nodeStyles.message;
  const Icon = style.icon;
  const isTrigger = nodeType === "trigger";
  const isCondition = nodeType === "condition";
  const isRouter = nodeType === "router";
  const routes = isRouter ? ((data.routes as { id: string; keyword: string; label: string }[]) || []) : [];

  return (
    <div className={`rounded-xl border-2 px-4 py-3 min-w-[180px] max-w-[240px] shadow-sm transition-shadow ${style.bg} ${selected ? "ring-2 ring-primary shadow-md" : ""}`}>
      {!isTrigger && (
        <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background" />
      )}
      
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${style.color} shrink-0`} />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {nodeLabels[nodeType]}
        </span>
      </div>
      
      <p className="text-sm font-medium truncate">{(data.label as string) || "Sem título"}</p>

      {data.subtitle && (
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{data.subtitle as string}</p>
      )}

      {isRouter && routes.length > 0 && (
        <div className="mt-2 space-y-1">
          {routes.map((route, i) => (
            <div key={route.id} className="flex items-center gap-1.5 text-xs">
              <div className={`w-2 h-2 rounded-full ${routeColors[i % routeColors.length]}`} />
              <span className="truncate">{route.label || route.keyword}</span>
            </div>
          ))}
        </div>
      )}

      {!isRouter && (
        <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-primary !border-2 !border-background" />
      )}
      
      {isCondition && (
        <Handle
          type="source"
          position={Position.Right}
          id="false"
          className="!w-3 !h-3 !bg-destructive !border-2 !border-background"
        />
      )}

      {isRouter && (
        <>
          {/* Default output at bottom */}
          <Handle type="source" position={Position.Bottom} id="default" className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background" />
          {/* Route outputs on the right, spaced vertically */}
          {routes.map((route, i) => (
            <Handle
              key={route.id}
              type="source"
              position={Position.Right}
              id={route.id}
              style={{ top: `${40 + i * 22}px` }}
              className={`!w-3 !h-3 !border-2 !border-background ${routeColors[i % routeColors.length].replace("bg-", "!bg-")}`}
            />
          ))}
        </>
      )}
    </div>
  );
}

export const nodeTypes = {
  flowNode: memo(FlowNode),
};
