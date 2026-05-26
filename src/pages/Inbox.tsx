import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Search, MessageSquare, Instagram } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";
import { toast } from "sonner";

export default function Inbox() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");

  const { data: leads = [] } = useQuery({
    queryKey: ["inbox-leads", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
    refetchInterval: 5000, // Poll for new messages
  });

  const selectedLead = leads.find((l) => l.id === selectedLeadId) || leads[0];

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", selectedLead?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("*").eq("lead_id", selectedLead!.id).order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLead?.id,
    refetchInterval: 3000,
  });

  // Check if WhatsApp is configured (without exposing tokens)
  const { data: whatsappConfigured = false } = useQuery({
    queryKey: ["company-whatsapp-configured", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_company_whatsapp_configured");
      if (error) throw error;
      return !!data;
    },
    enabled: !!companyId,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!newMessage.trim() || !selectedLead || !companyId) return;

      const isInstagram = (selectedLead as any).source === "instagram";

      if (isInstagram) {
        const { data, error } = await supabase.functions.invoke("instagram-send", {
          body: { lead_id: selectedLead.id, message: newMessage },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      } else if (whatsappConfigured && selectedLead.phone) {
        const { data, error } = await supabase.functions.invoke("whatsapp-send", {
          body: { to: selectedLead.phone, message: newMessage, lead_id: selectedLead.id },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      } else {
        const { error } = await supabase.from("messages").insert({
          lead_id: selectedLead.id,
          content: newMessage,
          type: "enviada" as const,
          company_id: companyId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      setNewMessage("");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao enviar mensagem");
    },
  });

  const filtered = leads.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className="w-80 border-r flex flex-col bg-card shrink-0">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar conversa..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-auto scrollbar-thin">
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">Nenhum lead encontrado.</p>
          )}
          {filtered.map((lead) => {
            const isIg = (lead as any).source === "instagram";
            const subtitle = isIg ? ((lead as any).instagram_username ? `@${(lead as any).instagram_username}` : "Instagram") : lead.phone;
            const picUrl = (lead as any).profile_pic_url;
            return (
              <button
                key={lead.id}
                onClick={() => setSelectedLeadId(lead.id)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 text-left hover:bg-accent transition-colors",
                  selectedLead?.id === lead.id && "bg-accent"
                )}
              >
                <div className="relative shrink-0">
                  {picUrl ? (
                    <img src={picUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                      {lead.name.charAt(0)}
                    </div>
                  )}
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full flex items-center justify-center border-2 border-card",
                    isIg ? "bg-pink-500" : "bg-emerald-500"
                  )}>
                    {isIg ? <Instagram className="h-2.5 w-2.5 text-white" /> : <MessageSquare className="h-2.5 w-2.5 text-white" />}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm truncate block">{lead.name}</span>
                  <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {selectedLead ? (
          <>
            <div className="h-14 border-b flex items-center justify-between px-4 bg-card shrink-0">
              <div className="flex items-center gap-3">
                {(selectedLead as any).profile_pic_url ? (
                  <img src={(selectedLead as any).profile_pic_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                    {selectedLead.name.charAt(0)}
                  </div>
                )}
                <div>
                  <span className="font-medium">{selectedLead.name}</span>
                  <p className="text-xs text-muted-foreground">
                    {(selectedLead as any).source === "instagram"
                      ? ((selectedLead as any).instagram_username ? `@${(selectedLead as any).instagram_username}` : "Instagram Direct")
                      : selectedLead.phone}
                  </p>
                </div>
              </div>
              {(selectedLead as any).source === "instagram" ? (
                <div className="flex items-center gap-1 text-xs text-pink-600">
                  <Instagram className="h-3 w-3" />
                  <span>Instagram</span>
                </div>
              ) : whatsappConfigured && (
                <div className="flex items-center gap-1 text-xs text-primary">
                  <MessageSquare className="h-3 w-3" />
                  <span>WhatsApp ativo</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3 scrollbar-thin">
              {messages.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">Nenhuma mensagem ainda.</p>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex", msg.type === "enviada" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2 text-sm",
                      msg.type === "enviada"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md"
                    )}
                  >
                    <p>{msg.content}</p>
                    <span className={cn("text-[10px] mt-1 block", msg.type === "enviada" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t bg-card flex gap-2">
              <Input
                placeholder={
                  (selectedLead as any).source === "instagram"
                    ? "Responder no Instagram Direct..."
                    : whatsappConfigured ? "Enviar via WhatsApp..." : "Digite uma mensagem..."
                }
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMutation.mutate()}
                className="flex-1"
              />
              <Button size="icon" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Selecione uma conversa ou crie leads no CRM
          </div>
        )}
      </div>
    </div>
  );
}
