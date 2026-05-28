/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Instagram, CheckCircle2, AlertTriangle, Loader2, LogIn, LogOut, HandMetal, Bug } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";

type Status = "disconnected" | "connected" | "expired" | "expiring";

export function InstagramSettings() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: company, isLoading } = useQuery({
    queryKey: ["instagram-status", companyId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("companies") as any)
        .select(
          "instagram_enabled, instagram_bot_enabled, instagram_username, instagram_profile_pic_url, instagram_connected_at, instagram_token_expires_at, instagram_last_webhook_at, instagram_bot_debug, instagram_bot_debug_updated_at"
        )


        .eq("id", companyId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Handle OAuth return params
  useEffect(() => {
    const ig = searchParams.get("instagram");
    if (!ig) return;
    if (ig === "connected") {
      toast.success("Instagram conectado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["instagram-status"] });
    } else if (ig === "error") {
      const reason = searchParams.get("reason") || "desconhecido";
      toast.error(`Falha ao conectar Instagram (${reason})`);
    }
    searchParams.delete("instagram");
    searchParams.delete("reason");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, queryClient]);

  const status: Status = (() => {
    if (!company?.instagram_enabled || !company?.instagram_username) return "disconnected";
    const exp = company.instagram_token_expires_at ? new Date(company.instagram_token_expires_at).getTime() : 0;
    const now = Date.now();
    if (exp && exp < now) return "expired";
    if (exp && exp - now < 7 * 24 * 3600 * 1000) return "expiring";
    return "connected";
  })();

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("instagram-oauth-start", {
        body: { return_to: "popup" },
      });
      if (error || data?.error || !data?.url) {
        console.error("instagram-oauth-start error:", error || data?.error);
        throw new Error("Não foi possível iniciar a conexão com o Instagram.");
      }

      // Abre popup centrado
      const w = 600;
      const h = 720;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      const popup = window.open(
        data.url,
        "ig-oauth",
        `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=yes,status=no`
      );

      if (!popup) {
        throw new Error("Popup bloqueado. Permita popups para este site e tente novamente.");
      }

      // Aguarda mensagem do callback OU fechamento do popup
      return await new Promise<void>((resolve, reject) => {
        const handler = (event: MessageEvent) => {
          if (!event.data || event.data.type !== "instagram-oauth") return;
          window.removeEventListener("message", handler);
          clearInterval(checkClosed);
          try { popup.close(); } catch {}
          if (event.data.status === "connected") {
            toast.success("Instagram conectado com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["instagram-status"] });
            resolve();
          } else {
            reject(new Error(`Falha ao conectar (${event.data.reason || "desconhecido"})`));
          }
        };
        window.addEventListener("message", handler);

        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener("message", handler);
            reject(new Error("Conexão cancelada"));
          }
        }, 800);
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });


  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("instagram-disconnect", { body: {} });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Instagram desconectado");
      queryClient.invalidateQueries({ queryKey: ["instagram-status"] });
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao desconectar"),
  });

  const toggleBotMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.from("companies").update({ instagram_bot_enabled: enabled }).eq("id", companyId!);
      if (error) throw error;
    },
    onSuccess: (_d, enabled) => {
      toast.success(enabled ? "Bot do Instagram ativado" : "Bot do Instagram pausado");
      queryClient.invalidateQueries({ queryKey: ["instagram-status"] });
    },
    onError: (err: Error) => toast.error(err.message || "Erro"),
  });


  // Human takeover: disable AI on all IG leads of this company
  const humanTakeoverMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("leads")
        .update({ ai_enabled: false })
        .eq("company_id", companyId!)
        .eq("source", "instagram");
      if (error) throw error;
    },
    onSuccess: () => toast.success("Bot pausado em todas as conversas do Instagram"),
    onError: (err: Error) => toast.error(err.message || "Erro"),
  });

  const isConnecting = connectMutation.isPending;
  const debug = ((company as any)?.instagram_bot_debug || {}) as Record<string, any>;
  const debugRows = [
    ["Last received Direct message", debug.last_received_direct_message],
    ["Tenant ID", debug.tenant_id],
    ["Conversation ID", debug.conversation_id],
    ["Sender ID", debug.sender_id],
    ["Bot enabled?", typeof debug.bot_enabled === "boolean" ? (debug.bot_enabled ? "Sim" : "Não") : "—"],
    ["Human takeover?", typeof debug.human_takeover === "boolean" ? (debug.human_takeover ? "Sim" : "Não") : "—"],
    ["Trigger found?", typeof debug.trigger_found === "boolean" ? (debug.trigger_found ? "Sim" : "Não") : "—"],
    ["OpenAI called?", debug.openai_called ? "Sim" : "Não"],
    ["AI response generated?", debug.ai_response_generated],
    ["Meta send API response", debug.meta_send_api_response],
    ["Blocked reason", debug.blocked_reason],
    ["Final status", debug.final_status],
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 flex items-center justify-center">
            <Instagram className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <CardTitle>Instagram Direct</CardTitle>
            <CardDescription>Conecte sua conta Business para receber e responder DMs no CRM</CardDescription>
          </div>
          {status === "connected" && (
            <Badge className="gap-1 bg-emerald-500 hover:bg-emerald-500">
              <CheckCircle2 className="h-3 w-3" /> Conectado
            </Badge>
          )}
          {status === "expiring" && (
            <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-700">
              Expira em breve
            </Badge>
          )}
          {status === "expired" && (
            <Badge variant="destructive" className="gap-1">
              Expirado
            </Badge>
          )}
          {status === "disconnected" && (
            <Badge variant="secondary">Não conectado</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : status === "disconnected" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Faça login com sua conta Meta/Facebook e autorize o acesso. Sua senha nunca é compartilhada com o CRM —
              utilizamos o login oficial da Meta.
            </p>
            <Button
              size="lg"
              className="w-full sm:w-auto gap-2 bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400 hover:opacity-90 text-white"
              onClick={() => connectMutation.mutate()}
              disabled={isConnecting}
            >
              {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {isConnecting ? "Abrindo login Meta..." : "Entrar com Instagram"}
            </Button>
          </div>
        ) : (
          <>
            {(status === "expired" || status === "expiring") && (
              <Alert variant={status === "expired" ? "destructive" : "default"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {status === "expired" ? "Conexão expirada" : "Conexão expira em breve"}
                </AlertTitle>
                <AlertDescription>
                  Reconecte sua conta Instagram para continuar recebendo mensagens.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={company?.instagram_profile_pic_url || undefined} />
                  <AvatarFallback>
                    <Instagram className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">@{company?.instagram_username}</p>
                  <p className="text-xs text-muted-foreground">
                    Conectado em{" "}
                    {company?.instagram_connected_at
                      ? new Date(company.instagram_connected_at).toLocaleDateString("pt-BR")
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {(status === "expired" || status === "expiring") && (
                  <Button variant="outline" size="sm" onClick={() => connectMutation.mutate()} disabled={isConnecting}>
                    {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                    Reconectar
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  className="gap-1"
                >
                  <LogOut className="h-4 w-4" /> Desconectar
                </Button>
              </div>
            </div>

            {(() => {
              const lastWh = (company as any)?.instagram_last_webhook_at;
              const lastDate = lastWh ? new Date(lastWh) : null;
              const minutesAgo = lastDate ? (Date.now() - lastDate.getTime()) / 60000 : null;
              const healthy = lastDate !== null;
              return (
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <Label className="text-sm font-medium">Status do webhook</Label>
                    <p className="text-xs text-muted-foreground">
                      {lastDate
                        ? `Última mensagem recebida: ${lastDate.toLocaleString("pt-BR")}`
                        : "Nenhuma mensagem recebida ainda. Envie um DM de teste para validar."}
                    </p>
                  </div>
                  <Badge variant={healthy ? "default" : "secondary"} className={healthy ? "bg-emerald-500 hover:bg-emerald-500" : ""}>
                    {healthy ? `Ativo${minutesAgo !== null && minutesAgo < 60 ? ` (${Math.round(minutesAgo)}min)` : ""}` : "Aguardando"}
                  </Badge>
                </div>
              );
            })()}

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-sm font-medium">Bot de IA no Instagram Direct</Label>
                <p className="text-xs text-muted-foreground">
                  {(company as any)?.instagram_bot_enabled !== false ? "Bot ativo — respondendo automaticamente" : "Bot inativo — modo manual"}
                </p>
              </div>
              <Switch
                checked={(company as any)?.instagram_bot_enabled !== false}
                onCheckedChange={(v) => toggleBotMutation.mutate(v)}
              />
            </div>


            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-sm font-medium">Atendimento humano</Label>
                <p className="text-xs text-muted-foreground">
                  Pausar o bot em todas as conversas atuais do Instagram
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => humanTakeoverMutation.mutate()}
                disabled={humanTakeoverMutation.isPending}
                className="gap-2"
              >
                <HandMetal className="h-4 w-4" /> Assumir conversas
              </Button>
            </div>

            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Bug className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-sm">Instagram Bot Debug</CardTitle>
                    <CardDescription className="text-xs">
                      Último diagnóstico do bot no Instagram Direct
                      {(company as any)?.instagram_bot_debug_updated_at
                        ? ` · ${new Date((company as any).instagram_bot_debug_updated_at).toLocaleString("pt-BR")}`
                        : ""}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {debugRows.map(([label, value]) => (
                  <div key={label} className="grid gap-1 rounded-md border bg-muted/20 p-2 sm:grid-cols-[190px_1fr]">
                    <span className="text-xs font-medium text-muted-foreground">{label}</span>
                    <span className="break-words text-xs font-mono">{value ? String(value) : "—"}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </CardContent>
    </Card>
  );
}
