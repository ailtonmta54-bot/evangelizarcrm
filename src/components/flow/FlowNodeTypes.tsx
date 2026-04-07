import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { MessageSquare, Clock, GitBranch, UserCheck, Tag, ArrowRightLeft, Zap } from "lucide-react";

const nodeStyles: Record<string, { icon: typeof Zap; color: string; bg: string }> = {
  trigger: { icon: Zap, color: "text-amber-600", bg: "bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-700" },
  message: { icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-700" },
  delay: { icon: Clock, color: "text-purple-600", bg: "bg-purple-50 border-purple-300 dark:bg-purple-950 dark:border-purple-700" },
  condition: { icon: GitBranch, color: "text-orange-600", bg: "bg-orange-50 border-orange-300 dark:bg-orange-950 dark:border-orange-700" },
  assign_agent: { icon: UserCheck, color: "text-green-600", bg: "bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-700" },
  add_tag: { icon: Tag, color: "text-pink-600", bg: "bg-pink-50 border-pink-300 dark:bg-pink-950 dark:border-pink-700" },
  move_crm: { icon: ArrowRightLeft, color: "text-cyan-600", bg: "bg-cyan-50 border-cyan-300 dark:bg-cyan-950 dark:border-cyan-700" },
};

const nodeLabels: Record<string, string> = {
  trigger: "Gatilho",
  message: "Enviar Mensagem",
  delay: "Aguardar",
  condition: "Condição",
  assign_agent: "Direcionar Agente",
  add_tag: "Adicionar Tag",
  move_crm: "Mover no CRM",
};

function FlowNode({ data, selected }: NodeProps) {
  const nodeType = (data.nodeType as string) || "message";
  const style = nodeStyles[nodeType] || nodeStyles.message;
  const Icon = style.icon;
  const isTrigger = nodeType === "trigger";
  const isCondition = nodeType === "condition";

  return (
    <div className={`rounded-xl border-2 px-4 py-3 min-w-[180px] max-w-[220px] shadow-sm transition-shadow ${style.bg} ${selected ? "ring-2 ring-primary shadow-md" : ""}`}>
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

      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-primary !border-2 !border-background" />
      
      {isCondition && (
        <Handle
          type="source"
          position={Position.Right}
          id="false"
          className="!w-3 !h-3 !bg-destructive !border-2 !border-background"
        />
      )}
    </div>
  );
}

export const nodeTypes = {
  flowNode: memo(FlowNode),
};
