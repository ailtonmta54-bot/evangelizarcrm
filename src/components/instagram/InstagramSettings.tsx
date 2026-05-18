import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Instagram, Copy, Check, Save } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const WEBHOOK_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/instagram-webhook`;

export function InstagramSettings() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    instagram_app_id: "",
    instagram_app_secret: "",
    instagram_access_token: "",
    instagram_business_id: "",
    instagram_page_id: "",
    instagram_verify_token: "",
    instagram_enabled: false,
  });

  const { data: company } = useQuery({
    queryKey: ["instagram-settings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("instagram_app_id, instagram_app_secret, instagram_access_token, instagram_business_id, instagram_page_id, instagram_verify_token, instagram_enabled")
        .eq("id", companyId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (company) {
      setForm({
        instagram_app_id: company.instagram_app_id || "",
        instagram_app_secret: company.instagram_app_secret || "",
        instagram_access_token: company.instagram_access_token || "",
        instagram_business_id: company.instagram_business_id || "",
        instagram_page_id: company.instagram_page_id || "",
        instagram_verify_token: company.instagram_verify_token || "",
        instagram_enabled: company.instagram_enabled || false,
      });
    }
  }, [company]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").update(form).eq("id", companyId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-settings"] });
      toast.success("Configurações do Instagram salvas!");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao salvar"),
  });

  const copyWebhook = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Instagram className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Integração Instagram Direct</CardTitle>
              <CardDescription>Conecte sua conta Business para receber e responder DMs</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="ig-enabled" className="text-sm">Ativo</Label>
            <Switch
              id="ig-enabled"
              checked={form.instagram_enabled}
              onCheckedChange={(v) => setForm({ ...form, instagram_enabled: v })}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <Label className="text-xs text-muted-foreground">Webhook URL (cole no painel Meta → Webhooks → Instagram)</Label>
          <div className="flex gap-2">
            <Input value={WEBHOOK_URL} readOnly className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={copyWebhook}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use o mesmo <strong>Verify Token</strong> abaixo na configuração do webhook.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Meta App ID</Label>
            <Input value={form.instagram_app_id} onChange={(e) => setForm({ ...form, instagram_app_id: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Meta App Secret</Label>
            <Input type="password" value={form.instagram_app_secret} onChange={(e) => setForm({ ...form, instagram_app_secret: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Access Token (Long-Lived)</Label>
            <Input type="password" value={form.instagram_access_token} onChange={(e) => setForm({ ...form, instagram_access_token: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Instagram Business Account ID</Label>
            <Input value={form.instagram_business_id} onChange={(e) => setForm({ ...form, instagram_business_id: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Facebook Page ID</Label>
            <Input value={form.instagram_page_id} onChange={(e) => setForm({ ...form, instagram_page_id: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Webhook Verify Token</Label>
            <Input
              value={form.instagram_verify_token}
              onChange={(e) => setForm({ ...form, instagram_verify_token: e.target.value })}
              placeholder="ex: meu-token-secreto-123"
            />
          </div>
        </div>

        <div className="rounded-md border bg-primary/5 p-3 text-xs space-y-1">
          <p className="font-medium">Pré-requisitos:</p>
          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
            <li>Conta Instagram <strong>Business ou Creator</strong> conectada a uma Página do Facebook</li>
            <li>App Meta com produtos <strong>Instagram Graph API</strong> + <strong>Webhooks</strong></li>
            <li>Permissões: <code>instagram_basic</code>, <code>instagram_manage_messages</code>, <code>pages_messaging</code></li>
            <li>Inscrever o webhook no campo <code>messages</code></li>
          </ul>
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
          <Save className="h-4 w-4" /> {saveMutation.isPending ? "Salvando..." : "Salvar Instagram"}
        </Button>
      </CardContent>
    </Card>
  );
}
