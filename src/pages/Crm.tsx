import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Phone, GripVertical, Plus, Bot } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

const columns = [
  { id: "novo" as const, title: "Novo Lead", color: "bg-info" },
  { id: "atendimento" as const, title: "Em Atendimento", color: "bg-warning" },
  { id: "proposta" as const, title: "Proposta", color: "bg-primary" },
  { id: "fechado" as const, title: "Fechado", color: "bg-success" },
];

export default function Crm() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [dragging, setDragging] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!companyId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leads").update({ status: status as Lead["status"] }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((col) => {
          const colLeads = leads.filter((l) => l.status === col.id);
          return (
            <div
              key={col.id}
              className="bg-muted/50 rounded-lg p-3 min-h-[400px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.id)}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                <h3 className="font-semibold text-sm">{col.title}</h3>
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
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Phone className="h-3 w-3" />
                            <span>{lead.phone}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2">
                            <Bot className={`h-3 w-3 ${lead.ai_enabled ? "text-primary" : "text-muted-foreground"}`} />
                            <span className="text-[10px] text-muted-foreground">IA</span>
                            <Switch
                              checked={lead.ai_enabled}
                              onCheckedChange={(checked) => toggleAi.mutate({ id: lead.id, enabled: checked })}
                              className="scale-75 origin-left"
                            />
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
    </div>
  );
}
