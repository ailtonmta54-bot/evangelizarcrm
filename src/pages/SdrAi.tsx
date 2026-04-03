import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Bot, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";

export default function SdrAi() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("amigavel");
  const [goal, setGoal] = useState("qualificar");
  const [temperature, setTemperature] = useState(0.7);
  const [active, setActive] = useState(true);

  const { data: config } = useQuery({
    queryKey: ["sdr-config", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sdr_config").select("*").single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (config) {
      setPrompt(config.prompt);
      setTone(config.tone);
      setGoal(config.goal);
      setTemperature(Number(config.temperature) || 0.7);
      setActive(config.active ?? true);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!config) return;
      const { error } = await supabase.from("sdr_config").update({
        prompt, tone, goal, temperature, active,
      }).eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sdr-config"] });
      toast.success("Configurações do SDR IA salvas!");
    },
    onError: () => toast.error("Erro ao salvar configurações"),
  });

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">SDR IA</h1>
        <p className="text-muted-foreground">Configure o robô de atendimento inteligente</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Configuração do Robô</CardTitle>
                <CardDescription>Defina como o SDR IA deve se comportar</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="sdr-active" className="text-sm">
                {active ? "Ativo" : "Inativo"}
              </Label>
              <Switch id="sdr-active" checked={active} onCheckedChange={setActive} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {active && (
            <div className="flex items-center gap-2 text-sm text-primary bg-primary/5 rounded-lg p-3">
              <Sparkles className="h-4 w-4" />
              <span>O SDR IA responderá automaticamente mensagens recebidas via WhatsApp usando OpenAI.</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt principal</Label>
            <Textarea id="prompt" rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder="Descreva o comportamento, produtos, e regras do robô..."
            />
            <p className="text-xs text-muted-foreground">
              Inclua informações sobre seus produtos, preços e regras de atendimento.
            </p>
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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Temperatura (criatividade)</Label>
              <span className="text-sm text-muted-foreground font-mono">{temperature.toFixed(1)}</span>
            </div>
            <Slider
              value={[temperature]}
              onValueChange={([v]) => setTemperature(v)}
              min={0}
              max={1}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Mais preciso</span>
              <span>Mais criativo</span>
            </div>
          </div>

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
            <Save className="h-4 w-4" /> {saveMutation.isPending ? "Salvando..." : "Salvar configurações"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
