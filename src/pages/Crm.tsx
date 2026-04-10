import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, GripVertical, Plus, Bot, Calendar, MessageSquare, Trash2, Eye } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

const columns = [
  { id: "novo" as const, title: "Novo Lead", color: "bg-info" },
  { id: "qualificado", title: "Qualificado", color: "bg-purple-500" },
  { id: "atendimento" as const, title: "Em Atendimento", color: "bg-warning" },
  { id: "proposta" as const, title: "Proposta", color: "bg-primary" },
  { id: "negociacao", title: "Negociação", color: "bg-cyan-500" },
  { id: "fechado" as const, title: "Fechado / Ganho", color: "bg-success" },
  { id: "perdido", title: "Perdido", color: "bg-destructive" },
];

export default function Crm() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [dragging, setDragging] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [detailLead, setDetailLead] = useState<Lead | null>(null);

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!companyId,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents-crm", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("agents").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages-detail", detailLead?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("lead_id", detailLead!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!detailLead,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leads").update({ status: status as Lead["status"] }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("leads").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const createLead = useMutation({
    mutationFn: async () => {
      if (!newName || !companyId) return;
      const { error } = await supabase.from("leads").insert({
        name: newName, phone: newPhone, company_id: companyId, ai_enabled: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setNewName(""); setNewPhone(""); setOpen(false);
      toast.success("Lead criado!");
    },
    onError: () => toast.error("Erro ao criar lead"),
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setDetailLead(null);
      toast.success("Lead removido!");
    },
    onError: () => toast.error("Erro ao remover lead"),
  });

  const toggleAi = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("leads").update({ ai_enabled: enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const handleDrop = (column: string) => {
    if (!dragging) return;
    updateStatus.mutate({ id: dragging, status: column });
    setDragging(null);
  };

  const totalLeads = leads.length;
  const closedLeads = leads.filter(l => l.status === "fechado").length;
  const lostLeads = leads.filter(l => l.status === "perdido").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CRM Pipeline</h1>
          <p className="text-muted-foreground">Gerencie seus leads no funil de vendas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Novo lead</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar lead</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do lead" />
              </div>
              <div className="space-y-2">
                <Label>Telefone (com código do país)</Label>
                <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="5511999998888" />
              </div>
              <Button onClick={() => createLead.mutate()} disabled={createLead.isPending} className="w-full">
                {createLead.isPending ? "Criando..." : "Criar lead"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{totalLeads}</p>
          <p className="text-xs text-muted-foreground">Total de leads</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{leads.filter(l => l.status === "atendimento" || l.status === "negociacao").length}</p>
          <p className="text-xs text-muted-foreground">Em andamento</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-success">{closedLeads}</p>
          <p className="text-xs text-muted-foreground">Fechados</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{lostLeads}</p>
          <p className="text-xs text-muted-foreground">Perdidos</p>
        </CardContent></Card>
      </div>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colLeads = leads.filter((l) => l.status === col.id);
          return (
            <div
              key={col.id}
              className="bg-muted/50 rounded-lg p-3 min-h-[400px] min-w-[220px] w-[220px] shrink-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.id)}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                <h3 className="font-semibold text-xs">{col.title}</h3>
                <span className="ml-auto text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5">
                  {colLeads.length}
                </span>
              </div>
              <div className="space-y-2">
                {colLeads.map((lead) => (
                  <Card
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragging(lead.id)}
                    className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{lead.name}</p>
                          {lead.phone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Phone className="h-3 w-3" />
                              <span className="truncate">{lead.phone}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}</span>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1">
                              <Bot className={`h-3 w-3 ${lead.ai_enabled ? "text-primary" : "text-muted-foreground"}`} />
                              <span className="text-[10px] text-muted-foreground">IA</span>
                              <Switch
                                checked={lead.ai_enabled}
                                onCheckedChange={(checked) => toggleAi.mutate({ id: lead.id, enabled: checked })}
                                className="scale-75 origin-left"
                              />
                            </div>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDetailLead(lead)}>
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailLead} onOpenChange={(v) => !v && setDetailLead(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {detailLead?.name}
            </DialogTitle>
          </DialogHeader>
          {detailLead && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={detailLead.status}
                    onValueChange={(v) => {
                      updateLead.mutate({ id: detailLead.id, updates: { status: v } });
                      setDetailLead({ ...detailLead, status: v as Lead["status"] });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {columns.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${c.color}`} />
                            {c.title}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Robô atribuído</Label>
                  <Select
                    value={detailLead.agent_id || "none"}
                    onValueChange={(v) => {
                      const agentId = v === "none" ? null : v;
                      updateLead.mutate({ id: detailLead.id, updates: { agent_id: agentId } });
                      setDetailLead({ ...detailLead, agent_id: agentId });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {agents.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Telefone</Label>
                <p className="text-sm">{detailLead.phone || "Não informado"}</p>
              </div>

              {/* Messages history */}
              <div className="space-y-1">
                <Label className="text-xs">Histórico de mensagens</Label>
                <div className="max-h-[200px] overflow-y-auto border rounded-lg p-3 space-y-2 scrollbar-thin">
                  {messages.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma mensagem ainda</p>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.type === "enviada" ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`rounded-lg px-3 py-1.5 max-w-[80%] text-xs ${
                          msg.type === "enviada" ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive gap-1"
                  onClick={() => {
                    if (confirm("Remover este lead permanentemente?")) {
                      deleteLead.mutate(detailLead.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir lead
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
