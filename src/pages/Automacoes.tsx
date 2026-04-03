import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Zap, Trash2, Clock, MessageSquare, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";

const triggerLabels: Record<string, string> = {
  novo_lead: "Novo Lead",
  sem_resposta: "Sem resposta",
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
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState("novo_lead");
  const [newMessage, setNewMessage] = useState("");
  const [newDelayHours, setNewDelayHours] = useState("24");

  const { data: automations = [] } = useQuery({
    queryKey: ["automations", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("automations").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("automations").insert({
        name: newName,
        trigger_type: newTrigger,
        message: newMessage,
        delay_hours: newTrigger === "sem_resposta" ? parseInt(newDelayHours) || 24 : 0,
        company_id: companyId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      setNewName(""); setNewMessage(""); setNewDelayHours("24"); setOpen(false);
      toast.success("Automação criada!");
    },
    onError: () => toast.error("Erro ao criar automação"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("automations").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast.success("Status atualizado");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast.success("Automação removida");
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automações</h1>
          <p className="text-muted-foreground">Automatize follow-ups e mensagens iniciais</p>
        </div>
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
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4" /> Novo Lead
                      </div>
                    </SelectItem>
                    <SelectItem value="sem_resposta">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" /> Sem resposta (follow-up)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{triggerDescriptions[newTrigger]}</p>
              </div>

              {newTrigger === "sem_resposta" && (
                <div className="space-y-2">
                  <Label>Tempo sem resposta (horas)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newDelayHours}
                    onChange={(e) => setNewDelayHours(e.target.value)}
                    placeholder="24"
                  />
                  <p className="text-xs text-muted-foreground">
                    O follow-up será enviado após {newDelayHours || "24"}h sem resposta do lead.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Olá {nome}, tudo bem? ..." rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Use <code className="bg-muted px-1 rounded text-xs">{"{nome}"}</code> para inserir o nome do lead.
                </p>
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
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">{auto.name}</h3>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {triggerLabels[auto.trigger_type] || auto.trigger_type}
                    </span>
                    {auto.trigger_type === "sem_resposta" && (auto as any).delay_hours > 0 && (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {(auto as any).delay_hours}h
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    <span className="truncate">{auto.message}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={auto.active}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: auto.id, active: checked })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(auto.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {automations.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <Zap className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">Nenhuma automação criada ainda.</p>
            <p className="text-xs text-muted-foreground">Crie automações para enviar mensagens automáticas aos seus leads.</p>
          </div>
        )}
      </div>
    </div>
  );
}
