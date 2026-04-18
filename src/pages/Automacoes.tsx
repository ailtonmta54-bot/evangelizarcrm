import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Zap, Trash2, Clock, MessageSquare, UserPlus, Workflow, Edit } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";
import { useNavigate } from "react-router-dom";

const triggerLabels: Record<string, string> = {
  novo_lead: "Novo Lead",
  sem_resposta: "Sem resposta",
  keyword: "Palavra-chave",
  new_lead: "Novo lead",
  no_response: "Sem resposta",
  status_change: "Mudança de status",
};

const triggerIcons: Record<string, typeof Zap> = {
  novo_lead: UserPlus,
  sem_resposta: Clock,
};

const triggerDescriptions: Record<string, string> = {
  novo_lead: "Envia mensagem quando um novo lead entra pelo WhatsApp",
  sem_resposta: "Envia follow-up quando o lead não responde após X horas",
};

export default function Automacoes() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState("novo_lead");
  const [newMessage, setNewMessage] = useState("");
  const [newDelayHours, setNewDelayHours] = useState("24");
  const [newScheduledTime, setNewScheduledTime] = useState("");

  const { data: automations = [] } = useQuery({
    queryKey: ["automations", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("automations").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: flows = [] } = useQuery({
    queryKey: ["flows", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("flows").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("automations").insert({
        name: newName, trigger_type: newTrigger, message: newMessage,
        delay_hours: newTrigger === "sem_resposta" ? parseInt(newDelayHours) || 24 : 0,
        scheduled_time: newScheduledTime || null,
        company_id: companyId!,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      setNewName(""); setNewMessage(""); setNewDelayHours("24"); setNewScheduledTime(""); setOpen(false);
      toast.success("Automação criada!");
    },
    onError: (err: any) => toast.error(`Erro ao criar automação: ${err?.message || ""}`),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("automations").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["automations"] }); toast.success("Status atualizado"); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["automations"] }); toast.success("Automação removida"); },
  });

  const deleteFlowMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("flows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["flows"] }); toast.success("Fluxo removido"); },
  });

  const toggleFlowMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("flows").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["flows"] }); toast.success("Status atualizado"); },
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automações</h1>
          <p className="text-muted-foreground">Automatize follow-ups, mensagens e fluxos completos</p>
        </div>
      </div>

      <Tabs defaultValue="flows">
        <TabsList>
          <TabsTrigger value="flows" className="gap-2"><Workflow className="h-4 w-4" /> Fluxos visuais</TabsTrigger>
          <TabsTrigger value="simple" className="gap-2"><Zap className="h-4 w-4" /> Automações simples</TabsTrigger>
        </TabsList>

        {/* FLOWS TAB */}
        <TabsContent value="flows" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => navigate("/automacoes/flow/new")} className="gap-2">
              <Plus className="h-4 w-4" /> Novo fluxo
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {flows.map((flow: any) => (
              <Card key={flow.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/automacoes/flow/${flow.id}`)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Workflow className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Switch checked={flow.active} onCheckedChange={(checked) => toggleFlowMutation.mutate({ id: flow.id, active: checked })} />
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => { if (confirm("Tem certeza que deseja excluir este fluxo?")) deleteFlowMutation.mutate(flow.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="font-semibold">{flow.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-0.5 bg-muted rounded-full">
                      {triggerLabels[flow.trigger_type] || flow.trigger_type}
                    </span>
                    {flow.active ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full">Ativo</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-muted rounded-full">Inativo</span>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="w-full mt-1 gap-2">
                    <Edit className="h-3 w-3" /> Editar fluxo
                  </Button>
                </CardContent>
              </Card>
            ))}
            {flows.length === 0 && (
              <div className="col-span-full text-center py-12 space-y-2">
                <Workflow className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="text-muted-foreground">Nenhum fluxo criado ainda.</p>
                <p className="text-xs text-muted-foreground">Crie fluxos visuais estilo ManyChat com gatilhos, condições e ações.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* SIMPLE AUTOMATIONS TAB */}
        <TabsContent value="simple" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" /> Nova automação</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Criar automação</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Boas-vindas ao novo lead" />
                  </div>
                  <div className="space-y-2">
                    <Label>Gatilho</Label>
                    <Select value={newTrigger} onValueChange={setNewTrigger}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="novo_lead">
                          <div className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Novo Lead</div>
                        </SelectItem>
                        <SelectItem value="sem_resposta">
                          <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> Sem resposta (follow-up)</div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{triggerDescriptions[newTrigger]}</p>
                  </div>
                  {newTrigger === "sem_resposta" && (
                    <div className="space-y-2">
                      <Label>Tempo sem resposta (horas)</Label>
                      <Input type="number" min="1" value={newDelayHours} onChange={(e) => setNewDelayHours(e.target.value)} placeholder="24" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Horário de envio (opcional)</Label>
                    <Input type="time" value={newScheduledTime} onChange={(e) => setNewScheduledTime(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Defina a hora exata em que a mensagem deve ser enviada. Deixe em branco para enviar imediatamente após o gatilho.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Mensagem</Label>
                    <Textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Olá {nome}, tudo bem? ..." rows={3} />
                    <p className="text-xs text-muted-foreground">Use <code className="bg-muted px-1 rounded text-xs">{"{nome}"}</code> para o nome do lead.</p>
                  </div>
                  <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newName || !newMessage} className="w-full">
                    {createMutation.isPending ? "Criando..." : "Criar automação"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {automations.map((auto) => {
              const Icon = triggerIcons[auto.trigger_type] || Zap;
              return (
                <Card key={auto.id}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm">{auto.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{triggerLabels[auto.trigger_type] || auto.trigger_type}</span>
                        {auto.trigger_type === "sem_resposta" && auto.delay_hours > 0 && (
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{auto.delay_hours}h</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        <span className="truncate">{auto.message}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={auto.active} onCheckedChange={(checked) => toggleMutation.mutate({ id: auto.id, active: checked })} />
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => { if (confirm("Tem certeza que deseja excluir esta automação?")) deleteMutation.mutate(auto.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {automations.length === 0 && (
              <div className="text-center py-12 space-y-2">
                <Zap className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="text-muted-foreground">Nenhuma automação criada ainda.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
