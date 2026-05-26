import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Bot, Plus, Save, Trash2, Brain, MessageSquare,
  ShoppingCart, Headphones, CalendarCheck, Cog, Clock,
  ArrowLeft, Send, Camera, Upload, Check,
  UsersRound, PhoneOff, VideoOff, AudioLines,
  Play, FlaskConical, Power, Copy, Globe,
  FileText, FileUp, ChevronDown, ChevronUp,
} from "lucide-react";
import { WhatsAppIcon, ElevenLabsIcon, GoogleCalendarIcon } from "@/components/BrandIcons";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";

import avatarAtendimentoF from "@/assets/avatars/avatar-atendimento-f.png";
import avatarVendasM from "@/assets/avatars/avatar-vendas-m.png";
import avatarBot1 from "@/assets/avatars/avatar-bot-1.png";
import avatarSuporteM from "@/assets/avatars/avatar-suporte-m.png";
import avatarQualificacaoF from "@/assets/avatars/avatar-qualificacao-f.png";
import avatarAgendamentoM from "@/assets/avatars/avatar-agendamento-m.png";
import avatarBot2 from "@/assets/avatars/avatar-bot-2.png";
import avatarVendasF from "@/assets/avatars/avatar-vendas-f.png";
import { InstagramSettings } from "@/components/instagram/InstagramSettings";

const avatarOptions = [
  { src: avatarAtendimentoF, label: "Atendente" },
  { src: avatarVendasM, label: "Vendedor" },
  { src: avatarVendasF, label: "Vendedora" },
  { src: avatarBot1, label: "Robô Amigável" },
  { src: avatarBot2, label: "Robô Futurista" },
  { src: avatarSuporteM, label: "Suporte" },
  { src: avatarQualificacaoF, label: "Consultora" },
  { src: avatarAgendamentoM, label: "Agendador" },
];

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

const statusConfig = {
  producao: { label: "Em produção", icon: Play, color: "bg-green-500", textColor: "text-green-600", badgeClass: "bg-green-500/10 text-green-600 border-green-500/30" },
  teste: { label: "Em teste", icon: FlaskConical, color: "bg-yellow-500", textColor: "text-yellow-600", badgeClass: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  desativado: { label: "Desativado", icon: Power, color: "bg-muted-foreground", textColor: "text-muted-foreground", badgeClass: "bg-muted text-muted-foreground border-border" },
};

export default function Robos() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [configTab, setConfigTab] = useState("geral");
  const [trainingTab, setTrainingTab] = useState("texto");
  const [expandedIntegration, setExpandedIntegration] = useState<string | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create form
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState("vendas");
  const [createDesc, setCreateDesc] = useState("");

  // Test chat
  const [testMessages, setTestMessages] = useState<{ role: string; content: string }[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testLoading, setTestLoading] = useState(false);

  // Website scraping
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [websiteLoading, setWebsiteLoading] = useState(false);
  const [websiteContent, setWebsiteContent] = useState<string | null>(null);

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

  const { data: products = [] } = useQuery({
    queryKey: ["products", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: agentProducts = [] } = useQuery({
    queryKey: ["agent_products", selectedAgentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_products")
        .select("product_id")
        .eq("agent_id", selectedAgentId!);
      if (error) throw error;
      return data.map(ap => ap.product_id);
    },
    enabled: !!selectedAgentId,
  });

  const toggleProduct = useMutation({
    mutationFn: async ({ productId, linked }: { productId: string; linked: boolean }) => {
      if (!selectedAgentId) return;
      if (linked) {
        const { error } = await supabase
          .from("agent_products")
          .delete()
          .eq("agent_id", selectedAgentId)
          .eq("product_id", productId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("agent_products")
          .insert({ agent_id: selectedAgentId, product_id: productId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_products", selectedAgentId] });
    },
    onError: () => toast.error("Erro ao atualizar produto"),
  });

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  const currentAgent = selectedAgentId ? agents.find(a => a.id === selectedAgentId) : null;

  // Fetch sensitive credentials separately (admin-only RPC)
  const { data: agentSecrets } = useQuery({
    queryKey: ["agent-secrets", selectedAgentId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_agent_secrets", { _agent_id: selectedAgentId! });
      if (error) throw error;
      return (data?.[0] ?? { whatsapp_token: "", whatsapp_verify_token: "", zapi_token: "" }) as {
        whatsapp_token: string; whatsapp_verify_token: string; zapi_token: string;
      };
    },
    enabled: !!selectedAgentId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      if (!createName.trim()) throw new Error("Nome é obrigatório");
      const { data, error } = await supabase.from("agents").insert({
        name: createName,
        description: createDesc,
        agent_type: createType as any,
        company_id: companyId,
      }).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Robô criado!");
      setCreateDialogOpen(false);
      setCreateName("");
      setCreateDesc("");
      setCreateType("vendas");
      setSelectedAgentId(data.id);
    },
    onError: (e) => toast.error(e.message || "Erro ao criar"),
  });

  const updateField = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      if (!currentAgent) return;
      const { error } = await supabase.from("agents").update(updates as any).eq("id", currentAgent.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Robô removido!");
      setSelectedAgentId(null);
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const uploadAvatar = async (file: File) => {
    if (!currentAgent) return;
    const ext = file.name.split(".").pop();
    const path = `${currentAgent.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("agent-avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Erro ao enviar imagem");
      return;
    }

    const { data: publicUrl } = supabase.storage.from("agent-avatars").getPublicUrl(path);
    await updateField.mutateAsync({ avatar_url: publicUrl.publicUrl });
    toast.success("Foto atualizada!");
  };

  const sendTestMessage = async () => {
    if (!testInput.trim() || !currentAgent) return;
    const userMsg = testInput.trim();
    setTestInput("");
    setTestMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setTestLoading(true);

    try {
      const response = await supabase.functions.invoke("sdr-ai-respond", {
        body: {
          lead_id: null,
          company_id: companyId,
          agent_id: currentAgent.id,
          test_mode: true,
          test_message: userMsg,
          test_history: testMessages,
        },
      });

      const reply = response.data?.message || "Sem resposta";
      setTestMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setTestMessages(prev => [...prev, { role: "assistant", content: "Erro ao gerar resposta de teste." }]);
    } finally {
      setTestLoading(false);
    }
  };

  // Save field with debounced auto-save on blur
  const saveField = (field: string, value: any) => {
    updateField.mutate({ [field]: value });
  };

  // ===== AGENT CONFIG PANEL =====
  if (currentAgent) {
    const typeConf = agentTypeConfig[currentAgent.agent_type as keyof typeof agentTypeConfig] || agentTypeConfig.custom;
    const st = statusConfig[(currentAgent as any).status as keyof typeof statusConfig] || statusConfig.desativado;
    const StatusIcon = st.icon;

    return (
      <div className="p-6 space-y-6 max-w-5xl">
        {/* Top Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedAgentId(null)} className="mt-1">
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Avatar */}
          <div className="relative group cursor-pointer" onClick={() => setAvatarPickerOpen(true)}>
            <div className="h-16 w-16 rounded-xl overflow-hidden bg-muted flex items-center justify-center border-2 border-border">
              {(currentAgent as any).avatar_url ? (
                <img src={(currentAgent as any).avatar_url} alt={currentAgent.name} className="h-full w-full object-cover" />
              ) : (
                <Bot className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Camera className="h-5 w-5 text-white" />
            </div>
            {/* Status dot */}
            <div className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full ${st.color} border-2 border-background flex items-center justify-center`}>
              <StatusIcon className="h-3 w-3 text-white" />
            </div>
          </div>

          {/* Hidden file input for custom upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadAvatar(file);
            }}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold truncate">{currentAgent.name}</h1>
              <Badge variant="outline" className={st.badgeClass}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {st.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">{currentAgent.description || typeConf.label}</p>
          </div>

          <div className="flex gap-2 shrink-0">
            <Select
              value={(currentAgent as any).status || "desativado"}
              onValueChange={(v) => saveField("status", v)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="producao">
                  <span className="flex items-center gap-2"><Play className="h-3 w-3 text-green-500" /> Em produção</span>
                </SelectItem>
                <SelectItem value="teste">
                  <span className="flex items-center gap-2"><FlaskConical className="h-3 w-3 text-yellow-500" /> Em teste</span>
                </SelectItem>
                <SelectItem value="desativado">
                  <span className="flex items-center gap-2"><Power className="h-3 w-3 text-muted-foreground" /> Desativado</span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline" size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => { if (confirm("Remover este robô permanentemente?")) deleteMutation.mutate(currentAgent.id); }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Config Tabs */}
        <Tabs value={configTab} onValueChange={setConfigTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="treinamento">Treinamento</TabsTrigger>
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
            <TabsTrigger value="gatilhos">Gatilhos</TabsTrigger>
            <TabsTrigger value="integracoes">Integrações</TabsTrigger>
            <TabsTrigger value="teste">Chat Teste</TabsTrigger>
          </TabsList>

          {/* === GERAL === */}
          <TabsContent value="geral" className="space-y-6 mt-4">
            {/* Avatar Gallery Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Camera className="h-4 w-4" /> Avatar do Robô</CardTitle>
                <CardDescription>Escolha um avatar estilo cartão para o seu robô</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                  {avatarOptions.map((opt, i) => {
                    const isSelected = (currentAgent as any)?.avatar_url === opt.src;
                    return (
                      <button
                        key={i}
                        className={`relative flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all hover:scale-105 ${
                          isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                        }`}
                        onClick={async () => {
                          await updateField.mutateAsync({ avatar_url: opt.src });
                          toast.success("Avatar atualizado!");
                        }}
                      >
                        <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted">
                          <img src={opt.src} alt={opt.label} className="h-full w-full object-cover" loading="lazy" />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium leading-tight text-center">{opt.label}</span>
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <Separator className="my-3" />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Ou envie sua própria foto</p>
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3 w-3 mr-1" /> Enviar foto
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Informações Básicas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome do robô</Label>
                    <Input defaultValue={currentAgent.name} onBlur={(e) => saveField("name", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input defaultValue={currentAgent.description} onBlur={(e) => saveField("description", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de agente</Label>
                    <Select value={currentAgent.agent_type} onValueChange={(v) => saveField("agent_type", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(agentTypeConfig).map(([value, conf]) => (
                          <SelectItem key={value} value={value}>{conf.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tom de voz</Label>
                      <Select value={currentAgent.tone} onValueChange={(v) => saveField("tone", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {toneOptions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Objetivo</Label>
                      <Select value={currentAgent.goal} onValueChange={(v) => saveField("goal", v)}>
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
                      <span className="text-sm text-muted-foreground font-mono">{Number(currentAgent.temperature).toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[Number(currentAgent.temperature)]}
                      onValueCommit={([v]) => saveField("temperature", v)}
                      min={0} max={1} step={0.1}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Mais preciso</span><span>Mais criativo</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Agente padrão</Label>
                    <Switch checked={currentAgent.is_default} onCheckedChange={(v) => saveField("is_default", v)} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><Cog className="h-4 w-4" /> Comportamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AudioLines className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label className="text-sm">Reconhecer áudio</Label>
                        <p className="text-xs text-muted-foreground">Transcreve e responde mensagens de áudio</p>
                      </div>
                    </div>
                    <Switch
                      checked={(currentAgent as any).recognize_audio ?? false}
                      onCheckedChange={(v) => saveField("recognize_audio", v)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UsersRound className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label className="text-sm">Não responder grupos</Label>
                        <p className="text-xs text-muted-foreground">Ignora mensagens de grupos</p>
                      </div>
                    </div>
                    <Switch
                      checked={(currentAgent as any).ignore_groups ?? true}
                      onCheckedChange={(v) => saveField("ignore_groups", v)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PhoneOff className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label className="text-sm">Não atender chamada de voz</Label>
                        <p className="text-xs text-muted-foreground">Rejeita chamadas de voz automaticamente</p>
                      </div>
                    </div>
                    <Switch
                      checked={(currentAgent as any).ignore_voice_calls ?? true}
                      onCheckedChange={(v) => saveField("ignore_voice_calls", v)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <VideoOff className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label className="text-sm">Não atender chamada de vídeo</Label>
                        <p className="text-xs text-muted-foreground">Rejeita chamadas de vídeo automaticamente</p>
                      </div>
                    </div>
                    <Switch
                      checked={(currentAgent as any).ignore_video_calls ?? true}
                      onCheckedChange={(v) => saveField("ignore_video_calls", v)}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* === TREINAMENTO === */}
          <TabsContent value="treinamento" className="space-y-6 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4" /> Prompt principal</CardTitle>
                <CardDescription>Descreva o comportamento, personalidade e regras do robô</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={6}
                  defaultValue={currentAgent.prompt}
                  onBlur={(e) => saveField("prompt", e.target.value)}
                  placeholder="Descreva o comportamento do robô, personalidade, regras..."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4" /> Base de Conhecimento</CardTitle>
                <CardDescription>Adicione informações para o robô consultar durante as conversas</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={trainingTab} onValueChange={setTrainingTab}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="texto" className="gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> Texto
                    </TabsTrigger>
                    <TabsTrigger value="website" className="gap-1.5">
                      <Globe className="h-3.5 w-3.5" /> Website
                    </TabsTrigger>
                    <TabsTrigger value="documento" className="gap-1.5">
                      <FileUp className="h-3.5 w-3.5" /> Documento
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="texto" className="mt-4 space-y-2">
                    <Textarea
                      rows={8}
                      maxLength={1000}
                      defaultValue={currentAgent.knowledge}
                      onBlur={(e) => saveField("knowledge", e.target.value)}
                      placeholder="FAQ, catálogo de produtos, preços, scripts de vendas, informações da empresa..."
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Pequenos conhecimentos, FAQ, informações rápidas</span>
                      <span>{(currentAgent.knowledge || "").length}/1000</span>
                    </div>
                  </TabsContent>

                  <TabsContent value="website" className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>URL do site</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://www.seusite.com.br"
                          value={websiteUrl}
                          onChange={(e) => setWebsiteUrl(e.target.value)}
                        />
                        <Button
                          variant="outline"
                          className="shrink-0 gap-1.5"
                          disabled={websiteLoading || !websiteUrl.trim()}
                          onClick={async () => {
                            setWebsiteLoading(true);
                            setWebsiteContent(null);
                            try {
                              const { data } = await supabase.functions.invoke("scrape-website", {
                                body: { url: websiteUrl.trim() },
                              });
                              if (!data?.ok) throw new Error(data?.error || "Erro ao ler o site");
                              const content = data.content || "";
                              setWebsiteContent(content);
                              // Append to existing knowledge
                              const currentKnowledge = currentAgent.knowledge || "";
                              const separator = currentKnowledge ? "\n\n--- Conteúdo extraído de " + websiteUrl + " ---\n" : "";
                              const newKnowledge = (currentKnowledge + separator + content).substring(0, 10000);
                              saveField("knowledge", newKnowledge);
                              toast.success("Conteúdo extraído e adicionado à base de conhecimento!");
                            } catch (err: any) {
                              console.error("Scrape error:", err);
                              toast.error(err.message || "Erro ao ler o site");
                            } finally {
                              setWebsiteLoading(false);
                            }
                          }}
                        >
                          {websiteLoading ? (
                            <><span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" /> Lendo...</>
                          ) : (
                            <><Globe className="h-4 w-4" /> Ler site</>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        O robô irá ler o conteúdo do site e adicionar à base de conhecimento.
                      </p>
                    </div>
                    {websiteContent ? (
                      <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Check className="h-4 w-4 text-green-500" />
                          Conteúdo extraído com sucesso
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-6">{websiteContent}</p>
                        <p className="text-xs text-muted-foreground">
                          {websiteContent.length} caracteres adicionados à base de conhecimento
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p>Insira uma URL acima e clique em "Ler site"</p>
                        <p className="text-xs mt-1">O conteúdo será extraído e adicionado à base de conhecimento</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="documento" className="mt-4 space-y-4">
                    <div className="rounded-lg border border-dashed p-8 text-center">
                      <FileUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-sm font-medium mb-1">Envie um documento</p>
                      <p className="text-xs text-muted-foreground mb-4">PDF ou DOCX com até 10MB</p>
                      <Button variant="outline" className="gap-1.5">
                        <Upload className="h-4 w-4" /> Selecionar arquivo
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O conteúdo do documento será extraído e usado como base de conhecimento do robô.
                    </p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="produtos" className="space-y-6 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Produtos vinculados</CardTitle>
                <CardDescription>Selecione os produtos que este robô pode oferecer. Ele usará os preços e descrições cadastrados.</CardDescription>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <ShoppingCart className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm font-medium mb-1">Nenhum produto cadastrado</p>
                    <p className="text-xs text-muted-foreground mb-4">Cadastre seus produtos na aba "Produtos" do menu lateral</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-muted-foreground">
                        {agentProducts.length} de {products.length} produtos selecionados
                      </p>
                    </div>
                    {products.map((product) => {
                      const isLinked = agentProducts.includes(product.id);
                      return (
                        <div
                          key={product.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isLinked ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
                          }`}
                          onClick={() => toggleProduct.mutate({ productId: product.id, linked: isLinked })}
                        >
                          <Checkbox checked={isLinked} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{product.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{product.description || "Sem descrição"}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold">R$ {Number(product.price).toFixed(2)}</p>
                            {product.external_link && (
                              <a href={product.external_link} target="_blank" rel="noopener" className="text-xs text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}>
                                Ver link
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-xs text-muted-foreground pt-2">
                      Clique para vincular ou desvincular produtos deste robô. Apenas os produtos selecionados serão oferecidos.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === GATILHOS === */}
          <TabsContent value="gatilhos" className="space-y-6 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Palavras-chave</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input
                  defaultValue={currentAgent.keywords || ""}
                  onBlur={(e) => saveField("keywords", e.target.value)}
                  placeholder="vendas, comprar, preço, orçamento"
                />
                <p className="text-xs text-muted-foreground">Separe por vírgula. Ativa o robô quando a mensagem contiver essas palavras.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Horário de funcionamento</CardTitle>
                  <Switch
                    checked={currentAgent.schedule_enabled ?? false}
                    onCheckedChange={(v) => saveField("schedule_enabled", v)}
                  />
                </div>
              </CardHeader>
              {currentAgent.schedule_enabled && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Início</Label>
                      <Input
                        type="time"
                        defaultValue={currentAgent.schedule_start || "08:00"}
                        onBlur={(e) => saveField("schedule_start", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Fim</Label>
                      <Input
                        type="time"
                        defaultValue={currentAgent.schedule_end || "18:00"}
                        onBlur={(e) => saveField("schedule_end", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Dias ativos</Label>
                    <div className="flex flex-wrap gap-2">
                      {weekDays.map((day) => {
                        const days = (currentAgent.schedule_days || "seg,ter,qua,qui,sex").split(",").map(d => d.trim());
                        const selected = days.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            onClick={() => {
                              const newDays = selected ? days.filter(d => d !== day.value) : [...days, day.value];
                              saveField("schedule_days", newDays.join(","));
                            }}
                            className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Mensagem fora do horário</Label>
                    <Textarea
                      rows={2}
                      defaultValue={currentAgent.away_message || ""}
                      onBlur={(e) => saveField("away_message", e.target.value)}
                      placeholder="Mensagem automática quando fora do horário..."
                    />
                  </div>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          {/* === INTEGRAÇÕES === */}
          <TabsContent value="integracoes" className="space-y-4 mt-4">
            {/* Instagram (nível empresa) */}
            <InstagramSettings />

            {/* WhatsApp */}
            <Card
              className="cursor-pointer transition-all hover:border-primary/30"
              onClick={() => setExpandedIntegration(expandedIntegration === "whatsapp" ? null : "whatsapp")}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${currentAgent.whatsapp_phone_id ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                    <WhatsAppIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-sm">WhatsApp API</CardTitle>
                    <CardDescription className="text-xs">API oficial do WhatsApp (Meta)</CardDescription>
                  </div>
                  <Badge variant={currentAgent.whatsapp_phone_id ? "default" : "secondary"} className="text-xs">
                    {currentAgent.whatsapp_phone_id ? "Conectado" : "Não configurado"}
                  </Badge>
                  {expandedIntegration === "whatsapp" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </CardHeader>
              {expandedIntegration === "whatsapp" && (
                <CardContent className="space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="space-y-2">
                    <Label className="text-xs">Token de Acesso</Label>
                    <Input
                      type="password"
                      defaultValue={agentSecrets?.whatsapp_token || ""}
                      onBlur={(e) => saveField("whatsapp_token", e.target.value)}
                      placeholder="Token da API Meta"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Phone Number ID</Label>
                    <Input
                      defaultValue={currentAgent.whatsapp_phone_id || ""}
                      onBlur={(e) => saveField("whatsapp_phone_id", e.target.value)}
                      placeholder="ID do número"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Verify Token</Label>
                    <Input
                      defaultValue={agentSecrets?.whatsapp_verify_token || ""}
                      onBlur={(e) => saveField("whatsapp_verify_token", e.target.value)}
                      placeholder="Token de verificação"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">URL do Webhook</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={webhookUrl} className="bg-muted text-xs font-mono" />
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(webhookUrl); toast.success("URL copiada!"); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Z-API */}
            <Card
              className="cursor-pointer transition-all hover:border-primary/30"
              onClick={() => setExpandedIntegration(expandedIntegration === "zapi" ? null : "zapi")}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${(currentAgent as any).zapi_enabled ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                    <Globe className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-sm">Z-API</CardTitle>
                    <CardDescription className="text-xs">WhatsApp não-oficial via Z-API</CardDescription>
                  </div>
                  <Badge variant={(currentAgent as any).zapi_enabled ? "default" : "secondary"} className="text-xs">
                    {(currentAgent as any).zapi_enabled ? "Conectado" : "Não configurado"}
                  </Badge>
                  {expandedIntegration === "zapi" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </CardHeader>
              {expandedIntegration === "zapi" && (
                <CardContent className="space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="space-y-2">
                    <Label className="text-xs">Instance ID</Label>
                    <Input
                      defaultValue={(currentAgent as any).zapi_instance_id || ""}
                      onBlur={(e) => saveField("zapi_instance_id" as any, e.target.value)}
                      placeholder="ID da instância Z-API"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Token</Label>
                    <Input
                      type="password"
                      defaultValue={agentSecrets?.zapi_token || ""}
                      onBlur={(e) => saveField("zapi_token" as any, e.target.value)}
                      placeholder="Token da instância"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={(currentAgent as any).zapi_enabled || false}
                      onCheckedChange={(v) => saveField("zapi_enabled" as any, v)}
                    />
                    <Label className="text-xs">Ativar Z-API</Label>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Provedor WhatsApp</Label>
                    <Select
                      value={(currentAgent as any).whatsapp_provider || "official"}
                      onValueChange={(v) => saveField("whatsapp_provider" as any, v)}
                    >
                      <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="official">API Oficial (Meta)</SelectItem>
                        <SelectItem value="zapi">Z-API</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Escolha qual API usar para enviar mensagens</p>
                  </div>
                </CardContent>
              )}
            </Card>

            <Card
              className="cursor-pointer transition-all hover:border-primary/30"
              onClick={() => setExpandedIntegration(expandedIntegration === "elevenlabs" ? null : "elevenlabs")}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${currentAgent.elevenlabs_enabled ? "bg-purple-500/10 text-purple-500" : "bg-muted text-muted-foreground"}`}>
                    <ElevenLabsIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-sm">ElevenLabs - Voz IA</CardTitle>
                    <CardDescription className="text-xs">Respostas em áudio com voz realista</CardDescription>
                  </div>
                  <Switch
                    checked={currentAgent.elevenlabs_enabled ?? false}
                    onCheckedChange={(v) => { v ? setExpandedIntegration("elevenlabs") : null; saveField("elevenlabs_enabled", v); }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {expandedIntegration === "elevenlabs" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </CardHeader>
              {expandedIntegration === "elevenlabs" && (
                <CardContent className="space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="space-y-2">
                    <Label className="text-xs">Voice ID</Label>
                    <Input
                      defaultValue={currentAgent.elevenlabs_voice_id || ""}
                      onBlur={(e) => saveField("elevenlabs_voice_id", e.target.value)}
                      placeholder="Ex: JBFqnCBsd6RMkjVDRZzb"
                    />
                    <p className="text-xs text-muted-foreground">
                      Encontre vozes na <a href="https://elevenlabs.io/voice-library" target="_blank" rel="noopener" className="underline text-primary">Biblioteca ElevenLabs</a>.
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Google Calendar */}
            <Card
              className="cursor-pointer transition-all hover:border-primary/30"
              onClick={() => setExpandedIntegration(expandedIntegration === "calendar" ? null : "calendar")}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${currentAgent.google_calendar_enabled ? "bg-blue-500/10 text-blue-500" : "bg-muted text-muted-foreground"}`}>
                    <GoogleCalendarIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-sm">Google Agenda</CardTitle>
                    <CardDescription className="text-xs">Agendamento automático de reuniões</CardDescription>
                  </div>
                  <Switch
                    checked={currentAgent.google_calendar_enabled ?? false}
                    onCheckedChange={(v) => { v ? setExpandedIntegration("calendar") : null; saveField("google_calendar_enabled", v); }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {expandedIntegration === "calendar" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </CardHeader>
              {expandedIntegration === "calendar" && (
                <CardContent className="space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="space-y-2">
                    <Label className="text-xs">Calendar ID</Label>
                    <Input
                      defaultValue={currentAgent.google_calendar_id || ""}
                      onBlur={(e) => saveField("google_calendar_id", e.target.value)}
                      placeholder="email@gmail.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Link de agendamento</Label>
                    <Input
                      defaultValue={currentAgent.google_calendar_link || ""}
                      onBlur={(e) => saveField("google_calendar_link", e.target.value)}
                      placeholder="https://calendar.app.google/..."
                    />
                  </div>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          {/* === CHAT TESTE === */}
          <TabsContent value="teste" className="mt-4">
            <Card className="h-[500px] flex flex-col">
              <CardHeader className="pb-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                    {(currentAgent as any).avatar_url ? (
                      <img src={(currentAgent as any).avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Bot className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-sm">Chat de Teste - {currentAgent.name}</CardTitle>
                    <CardDescription className="text-xs">Teste o comportamento do robô antes de colocar em produção</CardDescription>
                  </div>
                  {testMessages.length > 0 && (
                    <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setTestMessages([])}>
                      Limpar
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
                <div className="flex-1 overflow-y-auto px-6 py-2 space-y-3">
                  {testMessages.length === 0 && (
                    <div className="h-full flex items-center justify-center text-center">
                      <div>
                        <FlaskConical className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">Envie uma mensagem para testar o robô</p>
                        <p className="text-xs text-muted-foreground mt-1">As respostas serão geradas com base no prompt e conhecimento configurados</p>
                      </div>
                    </div>
                  )}
                  {testMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {testLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                        <span className="animate-pulse">Digitando...</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="border-t px-4 py-3 flex gap-2 shrink-0">
                  <Input
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder="Digite uma mensagem de teste..."
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendTestMessage()}
                    disabled={testLoading}
                  />
                  <Button size="icon" onClick={sendTestMessage} disabled={testLoading || !testInput.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Botão Salvar */}
        <div className="flex justify-end pt-4 border-t border-border">
          <Button
            onClick={() => toast.success("Todas as alterações foram salvas!")}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Salvar Alterações
          </Button>
        </div>
      </div>
    );
  }

  // ===== AGENT LIST =====
  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Robôs IA</h1>
          <p className="text-muted-foreground">Crie e gerencie seus agentes de inteligência artificial</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Criar Robô
        </Button>
      </div>

      {/* Avatar Picker Dialog */}
      <Dialog open={avatarPickerOpen} onOpenChange={setAvatarPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Escolha um avatar</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-3">
            {avatarOptions.map((opt, i) => {
              const isSelected = (currentAgent as any)?.avatar_url === opt.src;
              return (
                <button
                  key={i}
                  className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all hover:scale-105 ${
                    isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                  }`}
                  onClick={async () => {
                    if (currentAgent) {
                      await updateField.mutateAsync({ avatar_url: opt.src });
                      toast.success("Avatar atualizado!");
                      setAvatarPickerOpen(false);
                    }
                  }}
                >
                  <div className="h-14 w-14 rounded-lg overflow-hidden bg-muted">
                    <img src={opt.src} alt={opt.label} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{opt.label}</span>
                  {isSelected && (
                    <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Ou envie sua própria foto</p>
            <Button variant="outline" size="sm" onClick={() => { setAvatarPickerOpen(false); fileInputRef.current?.click(); }}>
              <Upload className="h-4 w-4 mr-1" /> Enviar foto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Dialog - simplified */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Robô</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do robô *</Label>
              <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Ex: SDR Vendas" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de agente</Label>
              <Select value={createType} onValueChange={setCreateType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(agentTypeConfig).map(([value, conf]) => (
                    <SelectItem key={value} value={value}>{conf.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} placeholder="Breve descrição" />
            </div>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="w-full gap-2">
              <Plus className="h-4 w-4" /> {createMutation.isPending ? "Criando..." : "Criar e Configurar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-6 h-44" /></Card>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
            <h3 className="text-lg font-medium mb-2">Nenhum robô criado</h3>
            <p className="text-muted-foreground mb-4">Crie seu primeiro agente de IA para automatizar atendimentos</p>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Criar primeiro robô</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const typeConf = agentTypeConfig[agent.agent_type as keyof typeof agentTypeConfig] || agentTypeConfig.custom;
            const TypeIcon = typeConf.icon;
            const st = statusConfig[(agent as any).status as keyof typeof statusConfig] || statusConfig.desativado;
            const StatusIcon = st.icon;
            const hasWhatsApp = !!agent.whatsapp_phone_id;
            const hasElevenLabs = !!agent.elevenlabs_enabled;
            const hasCalendar = !!agent.google_calendar_enabled;

            return (
              <Card
                key={agent.id}
                className="relative group hover:shadow-md transition-all cursor-pointer hover:border-primary/30"
                onClick={() => setSelectedAgentId(agent.id)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="relative">
                      <div className="h-12 w-12 rounded-xl overflow-hidden bg-muted flex items-center justify-center shrink-0">
                        {(agent as any).avatar_url ? (
                          <img src={(agent as any).avatar_url} alt={agent.name} className="h-full w-full object-cover" />
                        ) : (
                          <TypeIcon className={`h-6 w-6 ${typeConf.color}`} />
                        )}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full ${st.color} border-2 border-background`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{agent.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{agent.description || typeConf.label}</p>
                      <Badge variant="outline" className={`text-xs mt-1 ${st.badgeClass}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {st.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Integration icons */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <div className={`h-7 w-7 rounded flex items-center justify-center ${hasWhatsApp ? "text-green-500" : "text-muted-foreground/20"}`}>
                      <WhatsAppIcon className="h-4 w-4" />
                    </div>
                    <div className={`h-7 w-7 rounded flex items-center justify-center ${hasElevenLabs ? "text-purple-500" : "text-muted-foreground/20"}`}>
                      <ElevenLabsIcon className="h-4 w-4" />
                    </div>
                    <div className={`h-7 w-7 rounded flex items-center justify-center ${hasCalendar ? "text-blue-500" : "text-muted-foreground/20"}`}>
                      <GoogleCalendarIcon className="h-4 w-4" />
                    </div>
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
