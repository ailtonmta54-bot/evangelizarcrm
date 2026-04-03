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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Bot, Plus, Save, Sparkles, Trash2, Pencil, Brain, MessageSquare,
  ShoppingCart, Headphones, CalendarCheck, Cog, Clock, Key, Globe,
  Phone, Mic, Calendar,
} from "lucide-react";
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

const weekDays = [
  { value: "seg", label: "Seg" },
  { value: "ter", label: "Ter" },
  { value: "qua", label: "Qua" },
  { value: "qui", label: "Qui" },
  { value: "sex", label: "Sex" },
  { value: "sab", label: "Sáb" },
  { value: "dom", label: "Dom" },
];

type AgentForm = {
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
  keywords: string;
  schedule_enabled: boolean;
  schedule_start: string;
  schedule_end: string;
  schedule_days: string;
  away_message: string;
};

const defaultForm: AgentForm = {
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
  keywords: "",
  schedule_enabled: false,
  schedule_start: "08:00",
  schedule_end: "18:00",
  schedule_days: "seg,ter,qua,qui,sex",
  away_message: "Olá! No momento estamos fora do horário de atendimento. Retornaremos em breve!",
};

// Integration config dialog types
type IntegrationDialogType = "whatsapp" | "elevenlabs" | "calendar" | null;

export default function Robos() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [form, setForm] = useState<AgentForm>(defaultForm);

  // Integration dialogs
  const [integrationDialog, setIntegrationDialog] = useState<IntegrationDialogType>(null);
  const [integrationAgent, setIntegrationAgent] = useState<any>(null);
  const [integrationForm, setIntegrationForm] = useState<any>({});

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["agents", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      if (!form.name.trim()) throw new Error("Nome é obrigatório");

      const payload: any = {
        name: form.name,
        description: form.description,
        agent_type: form.agent_type as any,
        prompt: form.prompt,
        tone: form.tone,
        goal: form.goal,
        temperature: form.temperature,
        active: form.active,
        is_default: form.is_default,
        knowledge: form.knowledge,
        keywords: form.keywords,
        schedule_enabled: form.schedule_enabled,
        schedule_start: form.schedule_start,
        schedule_end: form.schedule_end,
        schedule_days: form.schedule_days,
        away_message: form.away_message,
      };

      if (editingAgent) {
        const { error } = await supabase.from("agents").update(payload).eq("id", editingAgent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agents").insert({ ...payload, company_id: companyId });
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

  const saveIntegrationMutation = useMutation({
    mutationFn: async () => {
      if (!integrationAgent) return;
      const { error } = await supabase.from("agents").update(integrationForm).eq("id", integrationAgent.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Integração salva!");
      setIntegrationDialog(null);
      setIntegrationAgent(null);
    },
    onError: () => toast.error("Erro ao salvar integração"),
  });

  const openCreate = () => {
    setEditingAgent(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (agent: any) => {
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
      keywords: agent.keywords || "",
      schedule_enabled: agent.schedule_enabled || false,
      schedule_start: agent.schedule_start || "08:00",
      schedule_end: agent.schedule_end || "18:00",
      schedule_days: agent.schedule_days || "seg,ter,qua,qui,sex",
      away_message: agent.away_message || "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingAgent(null);
    setForm(defaultForm);
  };

  const openIntegration = (type: IntegrationDialogType, agent: any) => {
    setIntegrationAgent(agent);
    setIntegrationDialog(type);

    if (type === "whatsapp") {
      setIntegrationForm({
        whatsapp_token: agent.whatsapp_token || "",
        whatsapp_phone_id: agent.whatsapp_phone_id || "",
        whatsapp_verify_token: agent.whatsapp_verify_token || "",
      });
    } else if (type === "elevenlabs") {
      setIntegrationForm({
        elevenlabs_enabled: agent.elevenlabs_enabled || false,
        elevenlabs_voice_id: agent.elevenlabs_voice_id || "",
      });
    } else if (type === "calendar") {
      setIntegrationForm({
        google_calendar_enabled: agent.google_calendar_enabled || false,
        google_calendar_id: agent.google_calendar_id || "",
        google_calendar_link: agent.google_calendar_link || "",
      });
    }
  };

  const update = <K extends keyof AgentForm>(key: K, value: AgentForm[K]) =>
    setForm({ ...form, [key]: value });

  const toggleDay = (day: string) => {
    const days = form.schedule_days.split(",").map(d => d.trim()).filter(Boolean);
    const newDays = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
    update("schedule_days", newDays.join(","));
  };

  return (
    <TooltipProvider>
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
              <Tabs defaultValue="geral" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="geral">Geral</TabsTrigger>
                  <TabsTrigger value="treinamento">Treinamento</TabsTrigger>
                  <TabsTrigger value="gatilhos">Gatilhos</TabsTrigger>
                </TabsList>

                <TabsContent value="geral" className="space-y-5 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label>{form.active ? "Ativo" : "Inativo"}</Label>
                      <Switch checked={form.active} onCheckedChange={(v) => update("active", v)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Agente padrão</Label>
                      <Switch checked={form.is_default} onCheckedChange={(v) => update("is_default", v)} />
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tom de voz</Label>
                      <Select value={form.tone} onValueChange={(v) => update("tone", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {toneOptions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Objetivo</Label>
                      <Select value={form.goal} onValueChange={(v) => update("goal", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {goalOptions.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Temperatura</Label>
                      <span className="text-sm text-muted-foreground font-mono">{form.temperature.toFixed(1)}</span>
                    </div>
                    <Slider value={[form.temperature]} onValueChange={([v]) => update("temperature", v)} min={0} max={1} step={0.1} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Mais preciso</span><span>Mais criativo</span>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="treinamento" className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <Label>Prompt principal (Treinamento)</Label>
                    <Textarea rows={6} value={form.prompt} onChange={(e) => update("prompt", e.target.value)} placeholder="Descreva o comportamento do robô..." />
                    <p className="text-xs text-muted-foreground">Quanto mais detalhado, melhor será o atendimento.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Base de conhecimento</Label>
                    <Textarea rows={6} value={form.knowledge} onChange={(e) => update("knowledge", e.target.value)} placeholder="FAQ, catálogo, preços, scripts..." />
                  </div>
                </TabsContent>

                <TabsContent value="gatilhos" className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" /> Palavras-chave
                    </Label>
                    <Input value={form.keywords} onChange={(e) => update("keywords", e.target.value)} placeholder="vendas, comprar, preço, orçamento" />
                    <p className="text-xs text-muted-foreground">Separe por vírgula. Ativa o robô quando a mensagem contiver essas palavras.</p>
                  </div>
                  <div className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Horário de funcionamento</Label>
                      <Switch checked={form.schedule_enabled} onCheckedChange={(v) => update("schedule_enabled", v)} />
                    </div>
                    {form.schedule_enabled && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Início</Label>
                            <Input type="time" value={form.schedule_start} onChange={(e) => update("schedule_start", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Fim</Label>
                            <Input type="time" value={form.schedule_end} onChange={(e) => update("schedule_end", e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Dias ativos</Label>
                          <div className="flex flex-wrap gap-2">
                            {weekDays.map((day) => {
                              const selected = form.schedule_days.split(",").map(d => d.trim()).includes(day.value);
                              return (
                                <label key={day.value} className={`px-3 py-1.5 rounded-md border cursor-pointer text-sm transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                                  <Checkbox checked={selected} onCheckedChange={() => toggleDay(day.value)} className="hidden" />
                                  {day.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Mensagem fora do horário</Label>
                          <Textarea rows={2} value={form.away_message} onChange={(e) => update("away_message", e.target.value)} placeholder="Mensagem automática quando fora do horário..." />
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full gap-2 mt-2">
                <Save className="h-4 w-4" /> {saveMutation.isPending ? "Salvando..." : "Salvar robô"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* Integration Dialogs */}
        <Dialog open={integrationDialog === "whatsapp"} onOpenChange={(open) => !open && setIntegrationDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-green-500" /> WhatsApp API
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm bg-green-500/10 rounded-lg p-3">
                <Globe className="h-4 w-4 text-green-500" />
                <span>Conecte a API oficial do WhatsApp (Meta) a este robô.</span>
              </div>
              <div className="space-y-2">
                <Label>WhatsApp Token</Label>
                <Input type="password" value={integrationForm.whatsapp_token || ""} onChange={(e) => setIntegrationForm({ ...integrationForm, whatsapp_token: e.target.value })} placeholder="Token de acesso da API Meta" />
              </div>
              <div className="space-y-2">
                <Label>Phone Number ID</Label>
                <Input value={integrationForm.whatsapp_phone_id || ""} onChange={(e) => setIntegrationForm({ ...integrationForm, whatsapp_phone_id: e.target.value })} placeholder="ID do número de telefone" />
              </div>
              <div className="space-y-2">
                <Label>Verify Token</Label>
                <Input value={integrationForm.whatsapp_verify_token || ""} onChange={(e) => setIntegrationForm({ ...integrationForm, whatsapp_verify_token: e.target.value })} placeholder="Token de verificação" />
              </div>
              <div className="space-y-2">
                <Label>URL do Webhook</Label>
                <div className="flex gap-2">
                  <Input readOnly value={webhookUrl} className="bg-muted text-xs font-mono" />
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("URL copiada!"); }}>Copiar</Button>
                </div>
                <p className="text-xs text-muted-foreground">Cole esta URL no painel Meta. O sistema identifica o robô pelo Phone Number ID.</p>
              </div>
              <Button onClick={() => saveIntegrationMutation.mutate()} disabled={saveIntegrationMutation.isPending} className="w-full gap-2">
                <Save className="h-4 w-4" /> Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={integrationDialog === "elevenlabs"} onOpenChange={(open) => !open && setIntegrationDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-purple-500" /> ElevenLabs - Voz IA
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm bg-purple-500/10 rounded-lg p-3">
                <Mic className="h-4 w-4 text-purple-500" />
                <span>Permita que o robô responda com áudio via ElevenLabs.</span>
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativar resposta por voz</Label>
                <Switch checked={integrationForm.elevenlabs_enabled || false} onCheckedChange={(v) => setIntegrationForm({ ...integrationForm, elevenlabs_enabled: v })} />
              </div>
              {integrationForm.elevenlabs_enabled && (
                <div className="space-y-2">
                  <Label>Voice ID (ElevenLabs)</Label>
                  <Input value={integrationForm.elevenlabs_voice_id || ""} onChange={(e) => setIntegrationForm({ ...integrationForm, elevenlabs_voice_id: e.target.value })} placeholder="Ex: JBFqnCBsd6RMkjVDRZzb" />
                  <p className="text-xs text-muted-foreground">
                    Encontre vozes na <a href="https://elevenlabs.io/voice-library" target="_blank" rel="noopener" className="underline text-primary">Biblioteca ElevenLabs</a>.
                  </p>
                </div>
              )}
              <Button onClick={() => saveIntegrationMutation.mutate()} disabled={saveIntegrationMutation.isPending} className="w-full gap-2">
                <Save className="h-4 w-4" /> Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={integrationDialog === "calendar"} onOpenChange={(open) => !open && setIntegrationDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" /> Google Agenda
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm bg-blue-500/10 rounded-lg p-3">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span>Permita que o robô agende reuniões no Google Agenda.</span>
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativar agendamento</Label>
                <Switch checked={integrationForm.google_calendar_enabled || false} onCheckedChange={(v) => setIntegrationForm({ ...integrationForm, google_calendar_enabled: v })} />
              </div>
              {integrationForm.google_calendar_enabled && (
                <>
                  <div className="space-y-2">
                    <Label>Calendar ID</Label>
                    <Input value={integrationForm.google_calendar_id || ""} onChange={(e) => setIntegrationForm({ ...integrationForm, google_calendar_id: e.target.value })} placeholder="email@gmail.com" />
                    <p className="text-xs text-muted-foreground">O e-mail associado ao Google Agenda.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Link de agendamento</Label>
                    <Input value={integrationForm.google_calendar_link || ""} onChange={(e) => setIntegrationForm({ ...integrationForm, google_calendar_link: e.target.value })} placeholder="https://calendar.app.google/..." />
                    <p className="text-xs text-muted-foreground">Link público para agendamento (Google Appointment, Calendly, etc.).</p>
                  </div>
                </>
              )}
              <Button onClick={() => saveIntegrationMutation.mutate()} disabled={saveIntegrationMutation.isPending} className="w-full gap-2">
                <Save className="h-4 w-4" /> Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Agent Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse"><CardContent className="p-6 h-40" /></Card>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
              <h3 className="text-lg font-medium mb-2">Nenhum robô criado</h3>
              <p className="text-muted-foreground mb-4">Crie seu primeiro agente de IA para automatizar atendimentos</p>
              <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Criar primeiro robô</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((agent) => {
              const typeConf = agentTypeConfig[agent.agent_type as keyof typeof agentTypeConfig] || agentTypeConfig.custom;
              const TypeIcon = typeConf.icon;
              const hasWhatsApp = !!(agent as any).whatsapp_phone_id;
              const hasElevenLabs = !!(agent as any).elevenlabs_enabled;
              const hasCalendar = !!(agent as any).google_calendar_enabled;

              return (
                <Card key={agent.id} className="relative group hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <TypeIcon className={`h-5 w-5 ${typeConf.color}`} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{agent.name}</CardTitle>
                          <CardDescription className="text-xs">{agent.description || "Sem descrição"}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {agent.is_default && <Badge variant="outline" className="text-xs">Padrão</Badge>}
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
                    </div>

                    {agent.prompt && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{agent.prompt}</p>
                    )}

                    {/* Integration Icons */}
                    <div className="flex items-center gap-1 pt-1 border-t">
                      <span className="text-xs text-muted-foreground mr-2">Integrações:</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => openIntegration("whatsapp", agent)}
                            className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors border ${hasWhatsApp ? "bg-green-500/10 border-green-500/30 text-green-500" : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"}`}
                          >
                            <Phone className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>WhatsApp API</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => openIntegration("elevenlabs", agent)}
                            className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors border ${hasElevenLabs ? "bg-purple-500/10 border-purple-500/30 text-purple-500" : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"}`}
                          >
                            <Mic className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>ElevenLabs - Voz IA</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => openIntegration("calendar", agent)}
                            className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors border ${hasCalendar ? "bg-blue-500/10 border-blue-500/30 text-blue-500" : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"}`}
                          >
                            <Calendar className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Google Agenda</TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEdit(agent)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className="gap-1.5 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm("Remover este robô?")) deleteMutation.mutate(agent.id); }}
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
    </TooltipProvider>
  );
}
