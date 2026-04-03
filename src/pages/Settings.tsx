import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Eye, EyeOff, Copy, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";

export default function Settings() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState("");
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [openaiKey, setOpenaiKey] = useState("");
  const [whatsappToken, setWhatsappToken] = useState("");
  const [phoneId, setPhoneId] = useState("");
  const [verifyToken, setVerifyToken] = useState("");

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  const { data: company } = useQuery({
    queryKey: ["company-settings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("name, whatsapp_token, whatsapp_phone_id, whatsapp_verify_token, openai_api_key")
        .eq("id", companyId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (company) {
      setCompanyName(company.name);
      setWhatsappToken(company.whatsapp_token || "");
      setPhoneId(company.whatsapp_phone_id || "");
      setVerifyToken(company.whatsapp_verify_token || "");
      setOpenaiKey(company.openai_api_key || "");
    }
  }, [company]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").update({
        name: companyName,
        whatsapp_token: whatsappToken,
        whatsapp_phone_id: phoneId,
        whatsapp_verify_token: verifyToken,
        openai_api_key: openaiKey,
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
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>
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

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
        <Save className="h-4 w-4" /> {saveMutation.isPending ? "Salvando..." : "Salvar todas as configurações"}
      </Button>
    </div>
  );
}
