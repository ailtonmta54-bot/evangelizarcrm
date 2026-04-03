import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Zap, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";

const triggerLabels: Record<string, string> = {
  novo_lead: "Novo Lead",
  sem_resposta: "Sem resposta",
  proposta_enviada: "Proposta enviada",
};

export default function Automacoes() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState("novo_lead");
  const [newMessage, setNewMessage] = useState("");

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
        name: newName, trigger_type: newTrigger, message: newMessage, company_id: companyId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      setNewName(""); setNewMessage(""); setOpen(false);
      toast.success("Automação criada!");
    },
    onError: () => toast.error("Erro ao criar automação"),
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
          <p className="text-muted-foreground">Gerencie mensagens automáticas</p>
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
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome da automação" />
              </div>
              <div className="space-y-2">
                <Label>Gatilho</Label>
                <Select value={newTrigger} onValueChange={setNewTrigger}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novo_lead">Novo Lead</SelectItem>
                    <SelectItem value="sem_resposta">Sem resposta</SelectItem>
                    <SelectItem value="proposta_enviada">Proposta enviada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Mensagem automática..." rows={3} />
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? "Criando..." : "Criar automação"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {automations.map((auto) => (
          <Card key={auto.id}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm">{auto.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${auto.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {auto.active ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Gatilho: {triggerLabels[auto.trigger_type] || auto.trigger_type}</p>
                <p className="text-sm text-muted-foreground mt-1 truncate">{auto.message}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(auto.id)} className="shrink-0">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {automations.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhuma automação criada ainda.</p>
        )}
      </div>
    </div>
  );
}
