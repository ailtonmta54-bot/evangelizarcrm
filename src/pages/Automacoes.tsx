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

interface Automation {
  id: string;
  name: string;
  trigger: string;
  message: string;
  active: boolean;
}

const initialAutomations: Automation[] = [
  { id: "1", name: "Mensagem de Boas-vindas", trigger: "novo_lead", message: "Olá! Seja bem-vindo. Como posso ajudá-lo?", active: true },
  { id: "2", name: "Follow-up 24h", trigger: "sem_resposta", message: "Oi! Vi que não conseguimos conversar. Posso ajudar com algo?", active: true },
  { id: "3", name: "Lembrete de proposta", trigger: "proposta_enviada", message: "Olá! Gostaria de saber se teve a chance de analisar nossa proposta.", active: false },
];

const triggerLabels: Record<string, string> = {
  novo_lead: "Novo Lead",
  sem_resposta: "Sem resposta",
  proposta_enviada: "Proposta enviada",
};

export default function Automacoes() {
  const [automations, setAutomations] = useState(initialAutomations);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState("novo_lead");
  const [newMessage, setNewMessage] = useState("");

  const handleCreate = () => {
    if (!newName || !newMessage) return;
    setAutomations((prev) => [
      ...prev,
      { id: Date.now().toString(), name: newName, trigger: newTrigger, message: newMessage, active: true },
    ]);
    setNewName("");
    setNewMessage("");
    setOpen(false);
    toast.success("Automação criada com sucesso!");
  };

  const handleDelete = (id: string) => {
    setAutomations((prev) => prev.filter((a) => a.id !== id));
    toast.success("Automação removida");
  };

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
            <DialogHeader>
              <DialogTitle>Criar automação</DialogTitle>
            </DialogHeader>
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
              <Button onClick={handleCreate} className="w-full">Criar automação</Button>
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
                <p className="text-xs text-muted-foreground mt-0.5">Gatilho: {triggerLabels[auto.trigger] || auto.trigger}</p>
                <p className="text-sm text-muted-foreground mt-1 truncate">{auto.message}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(auto.id)} className="shrink-0">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
