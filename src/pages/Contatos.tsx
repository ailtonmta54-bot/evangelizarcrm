import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MessageSquare, Phone, Calendar, User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  novo: { label: "Novo", variant: "default" },
  atendimento: { label: "Atendimento", variant: "secondary" },
  proposta: { label: "Proposta", variant: "outline" },
  fechado: { label: "Fechado", variant: "destructive" },
};

export default function Contatos() {
  const companyId = useCompanyId();
  const [search, setSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const { data: leads = [] } = useQuery({
    queryKey: ["contatos-leads", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["contato-messages", selectedLeadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("lead_id", selectedLeadId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLeadId,
  });

  const selectedLead = leads.find((l) => l.id === selectedLeadId);

  const filtered = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.phone.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contatos</h1>
          <p className="text-muted-foreground text-sm">Todos os leads e histórico de conversas</p>
        </div>
        <Badge variant="outline" className="text-sm">
          {leads.length} contatos
        </Badge>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou telefone..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>IA</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum contato encontrado.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((lead) => {
              const st = statusMap[lead.status] || { label: lead.status, variant: "outline" as const };
              return (
                <TableRow key={lead.id} className="cursor-pointer" onClick={() => setSelectedLeadId(lead.id)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                        {lead.name.charAt(0)}
                      </div>
                      <span className="font-medium">{lead.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span className="text-sm">{lead.phone || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </TableCell>
                  <TableCell>
                    {lead.ai_enabled ? (
                      <Bot className="h-4 w-4 text-primary" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground text-sm">
                      <Calendar className="h-3 w-3" />
                      {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedLeadId(lead.id); }}>
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Histórico
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedLeadId} onOpenChange={(open) => !open && setSelectedLeadId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLead && (
                <>
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                    {selectedLead.name.charAt(0)}
                  </div>
                  <div>
                    <span>{selectedLead.name}</span>
                    <p className="text-xs font-normal text-muted-foreground">{selectedLead.phone}</p>
                  </div>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-[400px] pr-4">
            {messages.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">Nenhuma mensagem no histórico.</p>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex", msg.type === "enviada" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                        msg.type === "enviada"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted rounded-bl-md"
                      )}
                    >
                      <p>{msg.content}</p>
                      <span className={cn("text-[10px] mt-1 block", msg.type === "enviada" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {new Date(msg.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
