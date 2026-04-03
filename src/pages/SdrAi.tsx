import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Bot, Save } from "lucide-react";
import { toast } from "sonner";

export default function SdrAi() {
  const [prompt, setPrompt] = useState("Você é um assistente de vendas da empresa. Seja cordial, objetivo e ajude o cliente a entender nossos produtos e serviços.");
  const [tone, setTone] = useState("amigavel");
  const [goal, setGoal] = useState("qualificar");

  const handleSave = () => {
    toast.success("Configurações do SDR IA salvas com sucesso!");
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">SDR IA</h1>
        <p className="text-muted-foreground">Configure o robô de atendimento inteligente</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Configuração do Robô</CardTitle>
              <CardDescription>Defina como o SDR IA deve se comportar nas conversas</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt principal</Label>
            <Textarea
              id="prompt"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Descreva como o robô deve se comportar..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tom de voz</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="persuasivo">Persuasivo</SelectItem>
                  <SelectItem value="amigavel">Amigável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Select value={goal} onValueChange={setGoal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fechar">Fechar venda</SelectItem>
                  <SelectItem value="qualificar">Qualificar lead</SelectItem>
                  <SelectItem value="agendar">Agendar reunião</SelectItem>
                </SelectContent>
              </Select>
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
