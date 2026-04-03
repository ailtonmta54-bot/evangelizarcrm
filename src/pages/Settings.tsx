import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Eye, EyeOff, Copy } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const [companyName, setCompanyName] = useState("Minha Empresa LTDA");
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [openaiKey, setOpenaiKey] = useState("sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
  const [whatsappToken, setWhatsappToken] = useState("EAAxxxxxxxxxxxxxxxxxxxxxxx");
  const [phoneId, setPhoneId] = useState("1234567890");
  const webhookUrl = "https://api.evangelizarcrm.com/webhook/whatsapp";

  const handleSave = () => toast.success("Configurações salvas!");
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
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
          <CardDescription>Informações gerais da sua empresa</CardDescription>
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
          <CardTitle>Integrações</CardTitle>
          <CardDescription>Tokens de API e configurações de integração</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Token da API OpenAI</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showOpenAI ? "text" : "password"}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowOpenAI(!showOpenAI)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showOpenAI ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Token WhatsApp Business</Label>
            <div className="relative">
              <Input
                type={showWhatsApp ? "text" : "password"}
                value={whatsappToken}
                onChange={(e) => setWhatsappToken(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowWhatsApp(!showWhatsApp)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showWhatsApp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Phone Number ID</Label>
            <Input value={phoneId} onChange={(e) => setPhoneId(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Webhook URL (somente leitura)</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="bg-muted" />
              <Button variant="outline" size="icon" onClick={() => handleCopy(webhookUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" /> Salvar configurações
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
