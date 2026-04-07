import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { Node } from "@xyflow/react";

interface NodeConfigPanelProps {
  node: Node;
  onUpdate: (id: string, data: Record<string, any>) => void;
  onClose: () => void;
  agents: { id: string; name: string }[];
}

export function NodeConfigPanel({ node, onUpdate, onClose, agents }: NodeConfigPanelProps) {
  const nodeType = (node.data.nodeType as string) || "message";
  const update = (key: string, value: any) => onUpdate(node.id, { ...node.data, [key]: value });

  return (
    <div className="w-72 border-l bg-background p-4 space-y-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Configurar bloco</h3>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div className="space-y-2">
        <Label>Título</Label>
        <Input value={(node.data.label as string) || ""} onChange={(e) => update("label", e.target.value)} />
      </div>

      {nodeType === "trigger" && (
        <>
          <div className="space-y-2">
            <Label>Tipo de gatilho</Label>
            <Select value={(node.data.triggerType as string) || "keyword"} onValueChange={(v) => update("triggerType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="keyword">Palavra-chave</SelectItem>
                <SelectItem value="new_lead">Novo lead</SelectItem>
                <SelectItem value="no_response">Sem resposta</SelectItem>
                <SelectItem value="status_change">Mudança de status</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor do gatilho</Label>
            <Input value={(node.data.triggerValue as string) || ""} onChange={(e) => update("triggerValue", e.target.value)}
              placeholder={node.data.triggerType === "keyword" ? "Ex: preço, oi" : node.data.triggerType === "no_response" ? "Horas (ex: 24)" : ""}
            />
          </div>
        </>
      )}

      {nodeType === "message" && (
        <div className="space-y-2">
          <Label>Mensagem</Label>
          <Textarea value={(node.data.message as string) || ""} onChange={(e) => update("message", e.target.value)}
            placeholder="Olá {nome}, tudo bem?" rows={4}
          />
          <p className="text-xs text-muted-foreground">Use {"{nome}"} para o nome do lead</p>
        </div>
      )}

      {nodeType === "delay" && (
        <div className="space-y-2">
          <Label>Tempo de espera</Label>
          <div className="flex gap-2">
            <Input type="number" min="1" value={(node.data.delayValue as string) || "1"} onChange={(e) => update("delayValue", e.target.value)} className="w-20" />
            <Select value={(node.data.delayUnit as string) || "hours"} onValueChange={(v) => update("delayUnit", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Aguarda {(node.data.delayValue as string) || "1"} {(node.data.delayUnit as string) === "minutes" ? "min" : (node.data.delayUnit as string) === "days" ? "dias" : "h"} antes de continuar
          </p>
        </div>
      )}

      {nodeType === "condition" && (
        <>
          <div className="space-y-2">
            <Label>Tipo de condição</Label>
            <Select value={(node.data.conditionType as string) || "response_contains"} onValueChange={(v) => update("conditionType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="response_contains">Resposta contém</SelectItem>
                <SelectItem value="no_response">Não respondeu</SelectItem>
                <SelectItem value="status_is">Status do lead é</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor</Label>
            <Input value={(node.data.conditionValue as string) || ""} onChange={(e) => update("conditionValue", e.target.value)}
              placeholder="Ex: sim, quero, preço"
            />
          </div>
        </>
      )}

      {nodeType === "assign_agent" && (
        <div className="space-y-2">
          <Label>Agente/Robô</Label>
          <Select value={(node.data.agentId as string) || ""} onValueChange={(v) => update("agentId", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione um agente" /></SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {nodeType === "add_tag" && (
        <div className="space-y-2">
          <Label>Tag</Label>
          <Input value={(node.data.tagValue as string) || ""} onChange={(e) => update("tagValue", e.target.value)} placeholder="Ex: interessado, qualificado" />
        </div>
      )}

      {nodeType === "move_crm" && (
        <div className="space-y-2">
          <Label>Mover para status</Label>
          <Select value={(node.data.newStatus as string) || "atendimento"} onValueChange={(v) => update("newStatus", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="novo">Novo</SelectItem>
              <SelectItem value="atendimento">Atendimento</SelectItem>
              <SelectItem value="proposta">Proposta</SelectItem>
              <SelectItem value="fechado">Fechado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
