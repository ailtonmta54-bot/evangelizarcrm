import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, Trash2, Plus } from "lucide-react";
import type { Node } from "@xyflow/react";

interface Route {
  id: string;
  keyword: string;
  label: string;
}

interface NodeConfigPanelProps {
  node: Node;
  onUpdate: (id: string, data: Record<string, any>) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  agents: { id: string; name: string }[];
}

export function NodeConfigPanel({ node, onUpdate, onClose, onDelete, agents }: NodeConfigPanelProps) {
  const nodeType = (node.data.nodeType as string) || "message";
  const update = (key: string, value: any) => onUpdate(node.id, { ...node.data, [key]: value });

  const routes: Route[] = (node.data.routes as Route[]) || [];

  const addRoute = () => {
    const newRoute: Route = { id: `route_${Date.now()}`, keyword: "", label: "" };
    update("routes", [...routes, newRoute]);
  };

  const updateRoute = (routeId: string, field: keyof Route, value: string) => {
    update("routes", routes.map((r) => r.id === routeId ? { ...r, [field]: value } : r));
  };

  const removeRoute = (routeId: string) => {
    update("routes", routes.filter((r) => r.id !== routeId));
  };

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
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-green-600 shrink-0" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.574-1.47A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-2.17 0-4.19-.587-5.932-1.608l-.425-.252-2.712.872.886-2.637-.277-.44A9.794 9.794 0 012.182 12c0-5.418 4.4-9.818 9.818-9.818S21.818 6.582 21.818 12s-4.4 9.818-9.818 9.818z" />
            </svg>
            <span className="text-xs font-medium text-green-700 dark:text-green-300">Enviada via WhatsApp</span>
          </div>
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea value={(node.data.message as string) || ""} onChange={(e) => update("message", e.target.value)}
              placeholder="Olá {nome}, tudo bem?" rows={4}
            />
            <p className="text-xs text-muted-foreground">Use {"{nome}"} para o nome do lead</p>
          </div>
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

      {nodeType === "router" && (
        <div className="space-y-3">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800">
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              Direcione o lead para caminhos diferentes baseado na resposta. Cada rota verifica se a resposta contém a palavra-chave.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Rotas</Label>
            {routes.map((route, i) => (
              <div key={route.id} className="flex gap-1.5 items-start">
                <div className="flex-1 space-y-1">
                  <Input
                    value={route.keyword}
                    onChange={(e) => updateRoute(route.id, "keyword", e.target.value)}
                    placeholder="Palavra-chave (ex: sim)"
                    className="text-xs h-8"
                  />
                  <Input
                    value={route.label}
                    onChange={(e) => updateRoute(route.id, "label", e.target.value)}
                    placeholder="Nome da rota (ex: Interessado)"
                    className="text-xs h-8"
                  />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeRoute(route.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" className="w-full gap-1" onClick={addRoute}>
            <Plus className="h-3 w-3" /> Adicionar rota
          </Button>

          <p className="text-xs text-muted-foreground">
            Se nenhuma rota combinar, o lead segue pela saída padrão (inferior).
          </p>
        </div>
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
              <SelectItem value="qualificado">Qualificado</SelectItem>
              <SelectItem value="negociacao">Negociação</SelectItem>
              <SelectItem value="proposta">Proposta</SelectItem>
              <SelectItem value="fechado">Fechado</SelectItem>
              <SelectItem value="perdido">Perdido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {nodeType !== "trigger" && (
        <Button
          variant="destructive"
          className="w-full gap-2 mt-4"
          onClick={() => { onDelete(node.id); onClose(); }}
        >
          <Trash2 className="h-4 w-4" />
          Excluir bloco
        </Button>
      )}
    </div>
  );
}
