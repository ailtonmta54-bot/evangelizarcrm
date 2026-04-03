import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bot, Plus, Save, Sparkles, Trash2, Pencil, Brain, MessageSquare, ShoppingCart, Headphones, CalendarCheck, Cog } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";

const agentTypeConfig = {
  vendas: { label: "Vendas", icon: ShoppingCart, color: "text-green-500" },
  atendimento: { label: "Atendimento", icon: MessageSquare, color: "text-blue-500" },
  suporte: { label: "Suporte", icon: Headphones, color: "text-orange-500" },
  qualificacao: { label: "Qualificação", icon: Brain, color: "text-purple-500" },
  agendamento: { label: "Agendamento", icon: CalendarCheck, color: "text-cyan-500" },
  custom: { label: "Personalizado", icon: Cog, color: "text-muted-foreground" },
};

const toneOptions = [
  { value: "formal", label: "Formal" },
  { value: "persuasivo", label: "Persuasivo" },
  { value: "amigavel", label: "Amigável" },
  { value: "tecnico", label: "Técnico" },
  { value: "casual", label: "Casual" },
];

const goalOptions = [
  { value: "fechar", label: "Fechar venda" },
  { value: "qualificar", label: "Qualificar lead" },
  { value: "agendar", label: "Agendar reunião" },
  { value: "suporte", label: "Resolver problema" },
  { value: "informar", label: "Informar / Educar" },
];

type Agent = {
  id: string;
  name: string;
  description: string;
  agent_type: string;
  prompt: string;
  tone: string;
  goal: string;
  temperature: number;
  active: boolean;
  is_default: boolean;
  knowledge: string;
  company_id: string;
  created_at: string;
};

const defaultAgent: Omit<Agent, "id" | "company_id" | "created_at"> = {
  name: "",
  description: "",
  agent_type: "vendas",
  prompt: "",
  tone: "amigavel",
  goal: "qualificar",
  temperature: 0.7,
  active: true,
  is_default: false,
  knowledge: "",
};

export default function Robos() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [form, setForm] = useState(defaultAgent);

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["agents", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Agent[];
    },
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      if (!form.name.trim()) throw new Error("Nome é obrigatório");

      if (editingAgent) {
        const { error } = await supabase.from("agents").update({
          name: form.name,
          description: form.description,
          agent_type: form.agent_type,
          prompt: form.prompt,
          tone: form.tone,
          goal: form.goal,
          temperature: form.temperature,
          active: form.active,
          is_default: form.is_default,
          knowledge: form.knowledge,
        }).eq("id", editingAgent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agents").insert({
          company_id: companyId,
          name: form.name,
          description: form.description,
          agent_type: form.agent_type as "vendas" | "atendimento" | "suporte" | "qualificacao" | "agendamento" | "custom",
          prompt: form.prompt,
          tone: form.tone,
          goal: form.goal,
          temperature: form.temperature,
          active: form.active,
          is_default: form.is_default,
          knowledge: form.knowledge,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success(editingAgent ? "Robô atualizado!" : "Robô criado!");
      closeDialog();
    },
    onError: (e) => toast.error(e.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Robô removido!");
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const openCreate = () => {
    setEditingAgent(null);
    setForm(defaultAgent);
    setDialogOpen(true);
  };

  const openEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setForm({
      name: agent.name,
      description: agent.description,
      agent_type: agent.agent_type,
      prompt: agent.prompt,
      tone: agent.tone,
      goal: agent.goal,
      temperature: Number(agent.temperature),
      active: agent.active,
      is_default: agent.is_default,
      knowledge: agent.knowledge,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingAgent(null);
    setForm(defaultAgent);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Robôs IA</h1>
          <p className="text-muted-foreground">Crie e gerencie seus agentes de inteligência artificial</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Criar Robô
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAgent ? "Editar Robô" : "Criar Novo Robô"}</DialogTitle>
            </DialogHeader>
            <AgentForm
              form={form}
              setForm={setForm}
              onSave={() => saveMutation.mutate()}
              saving={saveMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 h-40" />
            </Card>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
            <h3 className="text-lg font-medium mb-2">Nenhum robô criado</h3>
            <p className="text-muted-foreground mb-4">
              Crie seu primeiro agente de IA para automatizar atendimentos via WhatsApp
            </p>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Criar primeiro robô
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent) => {
            const typeConf = agentTypeConfig[agent.agent_type as keyof typeof agentTypeConfig] || agentTypeConfig.custom;
            const TypeIcon = typeConf.icon;
            return (
              <Card key={agent.id} className="relative group hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center`}>
                        <TypeIcon className={`h-5 w-5 ${typeConf.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{agent.name}</CardTitle>
                        <CardDescription className="text-xs">{agent.description || "Sem descrição"}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {agent.is_default && (
                        <Badge variant="outline" className="text-xs">Padrão</Badge>
                      )}
                      <Badge variant={agent.active ? "default" : "secondary"} className="text-xs">
                        {agent.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">{typeConf.label}</Badge>
                    <Badge variant="outline">
                      Tom: {toneOptions.find((t) => t.value === agent.tone)?.label || agent.tone}
                    </Badge>
                    <Badge variant="outline">
                      Objetivo: {goalOptions.find((g) => g.value === agent.goal)?.label || agent.goal}
                    </Badge>
                  </div>
                  {agent.prompt && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{agent.prompt}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEdit(agent)}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("Tem certeza que deseja remover este robô?")) {
                          deleteMutation.mutate(agent.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remover
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AgentForm({
  form,
  setForm,
  onSave,
  saving,
}: {
  form: typeof defaultAgent;
  setForm: (f: typeof defaultAgent) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const update = <K extends keyof typeof defaultAgent>(key: K, value: (typeof defaultAgent)[K]) =>
    setForm({ ...form, [key]: value });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor="agent-active">{form.active ? "Ativo" : "Inativo"}</Label>
          <Switch id="agent-active" checked={form.active} onCheckedChange={(v) => update("active", v)} />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="agent-default" className="text-xs text-muted-foreground">Agente padrão</Label>
          <Switch id="agent-default" checked={form.is_default} onCheckedChange={(v) => update("is_default", v)} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome do robô *</Label>
          <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Ex: SDR Vendas" />
        </div>
        <div className="space-y-2">
          <Label>Tipo de agente</Label>
          <Select value={form.agent_type} onValueChange={(v) => update("agent_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(agentTypeConfig).map(([value, conf]) => (
                <SelectItem key={value} value={value}>{conf.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Breve descrição do que este robô faz" />
      </div>

      <div className="space-y-2">
        <Label>Prompt principal (Treinamento)</Label>
        <Textarea
          rows={5}
          value={form.prompt}
          onChange={(e) => update("prompt", e.target.value)}
          placeholder="Descreva o comportamento do robô, regras, informações sobre produtos, preços, processos..."
        />
        <p className="text-xs text-muted-foreground">
          Aqui é onde você "treina" o robô. Quanto mais detalhado, melhor será o atendimento.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Base de conhecimento</Label>
        <Textarea
          rows={4}
          value={form.knowledge}
          onChange={(e) => update("knowledge", e.target.value)}
          placeholder="Cole aqui FAQ, catálogo de produtos, tabela de preços, scripts de atendimento..."
        />
        <p className="text-xs text-muted-foreground">
          Informações adicionais que o robô pode consultar para responder.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tom de voz</Label>
          <Select value={form.tone} onValueChange={(v) => update("tone", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {toneOptions.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Objetivo</Label>
          <Select value={form.goal} onValueChange={(v) => update("goal", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {goalOptions.map((g) => (
                <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Temperatura (criatividade)</Label>
          <span className="text-sm text-muted-foreground font-mono">{form.temperature.toFixed(1)}</span>
        </div>
        <Slider
          value={[form.temperature]}
          onValueChange={([v]) => update("temperature", v)}
          min={0}
          max={1}
          step={0.1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Mais preciso</span>
          <span>Mais criativo</span>
        </div>
      </div>

      {form.active && (
        <div className="flex items-center gap-2 text-sm text-primary bg-primary/5 rounded-lg p-3">
          <Sparkles className="h-4 w-4" />
          <span>Este robô responderá automaticamente mensagens recebidas via WhatsApp.</span>
        </div>
      )}

      <Button onClick={onSave} disabled={saving} className="w-full gap-2">
        <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar robô"}
      </Button>
    </div>
  );
}
