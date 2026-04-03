import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Eye, EyeOff, Copy, CheckCircle, Users, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";
import { useUserRole } from "@/hooks/use-user-role";

export default function Settings() {
  const companyId = useCompanyId();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState("");
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [whatsappToken, setWhatsappToken] = useState("");
  const [phoneId, setPhoneId] = useState("");
  const [verifyToken, setVerifyToken] = useState("");

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  const { data: company } = useQuery({
    queryKey: ["company-settings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("name, whatsapp_token, whatsapp_phone_id, whatsapp_verify_token")
        .eq("id", companyId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Fetch team members (admin only)
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, created_at")
        .eq("company_id", companyId!);
      if (error) throw error;

      // Get roles for each member
      const memberIds = data.map((m) => m.user_id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", memberIds);

      return data.map((m) => ({
        ...m,
        role: roles?.find((r) => r.user_id === m.user_id)?.role || "user",
      }));
    },
    enabled: !!companyId && isAdmin,
  });

  useEffect(() => {
    if (company) {
      setCompanyName(company.name);
      setWhatsappToken(company.whatsapp_token || "");
      setPhoneId(company.whatsapp_phone_id || "");
      setVerifyToken(company.whatsapp_verify_token || "");
    }
  }, [company]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").update({
        name: companyName,
        whatsapp_token: whatsappToken,
        whatsapp_phone_id: phoneId,
        whatsapp_verify_token: verifyToken,
      }).eq("id", companyId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("Configurações salvas!");
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const generateVerifyToken = () => {
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    setVerifyToken(token);
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Gerencie as configurações da sua conta</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da Empresa</CardTitle>
          <CardDescription>Informações gerais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da empresa</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={!isAdmin} />
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <div>
                  <CardTitle>Equipe</CardTitle>
                  <CardDescription>Membros da empresa e seus papéis</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      {member.role === "admin" ? (
                        <ShieldCheck className="h-4 w-4 text-primary" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{member.full_name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">
                        Desde {new Date(member.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                    {member.role === "admin" ? "Admin" : "Usuário"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Business API</CardTitle>
              <CardDescription>Configure a integração com o WhatsApp Cloud API da Meta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Token de Acesso (Permanent Token)</Label>
                <div className="relative">
                  <Input
                    type={showWhatsApp ? "text" : "password"}
                    value={whatsappToken}
                    onChange={(e) => setWhatsappToken(e.target.value)}
                    placeholder="EAAxxxxxxx..."
                  />
                  <button type="button" onClick={() => setShowWhatsApp(!showWhatsApp)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showWhatsApp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Phone Number ID</Label>
                <Input value={phoneId} onChange={(e) => setPhoneId(e.target.value)} placeholder="Ex: 1234567890" />
              </div>

              <div className="space-y-2">
                <Label>Verify Token (para validação do webhook)</Label>
                <div className="flex gap-2">
                  <Input value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} placeholder="Token de verificação" />
                  <Button variant="outline" onClick={generateVerifyToken} type="button">Gerar</Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Webhook URL (cole no Meta Business)</Label>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly className="bg-muted text-sm" />
                  <Button variant="outline" size="icon" onClick={() => handleCopy(webhookUrl)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cole esta URL no Meta Business → WhatsApp → Configuração → Webhook. Use o Verify Token acima.
                </p>
              </div>

              {whatsappToken && phoneId && verifyToken && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <CheckCircle className="h-4 w-4" />
                  <span>WhatsApp configurado</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OpenAI</CardTitle>
              <CardDescription>Chave de API para o SDR IA</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="relative">
                  <Input
                    type={showOpenAI ? "text" : "password"}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                  />
                  <button type="button" onClick={() => setShowOpenAI(!showOpenAI)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showOpenAI ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!isAdmin && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
            <p>Apenas administradores podem editar integrações e configurações avançadas.</p>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
          <Save className="h-4 w-4" /> {saveMutation.isPending ? "Salvando..." : "Salvar todas as configurações"}
        </Button>
      )}
    </div>
  );
}
