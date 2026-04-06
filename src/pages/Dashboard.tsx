import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, MessageSquare, DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight,
  Bot, Zap, Clock, Activity,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";

export default function Dashboard() {
  const companyId = useCompanyId();

  const { data: leadCount = 0 } = useQuery({
    queryKey: ["leads-count", companyId],
    queryFn: async () => {
      const { count } = await supabase.from("leads").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
    enabled: !!companyId,
  });

  const { data: activeMessages = 0 } = useQuery({
    queryKey: ["active-messages", companyId],
    queryFn: async () => {
      const { count } = await supabase.from("messages").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
    enabled: !!companyId,
  });

  const { data: closedDeals = 0 } = useQuery({
    queryKey: ["closed-deals", companyId],
    queryFn: async () => {
      const { count } = await supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "fechado");
      return count ?? 0;
    },
    enabled: !!companyId,
  });

  const { data: agentCount = 0 } = useQuery({
    queryKey: ["agent-count", companyId],
    queryFn: async () => {
      const { count } = await supabase.from("agents").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
    enabled: !!companyId,
  });

  const { data: recentLeads = [] } = useQuery({
    queryKey: ["recent-leads", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: leadsByStatus = [] } = useQuery({
    queryKey: ["leads-by-status", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("status");
      if (!data) return [];
      const counts: Record<string, number> = {};
      data.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
    enabled: !!companyId,
  });

  const conversionRate = leadCount > 0 ? ((closedDeals / leadCount) * 100).toFixed(1) : "0";

  const stats = [
    { title: "Total de Leads", value: String(leadCount), icon: Users, trend: "+12%", up: true, color: "text-primary" },
    { title: "Mensagens", value: String(activeMessages), icon: MessageSquare, trend: "+8%", up: true, color: "text-[hsl(var(--info))]" },
    { title: "Vendas Fechadas", value: String(closedDeals), icon: DollarSign, trend: "+23%", up: true, color: "text-[hsl(var(--success))]" },
    { title: "Conversão", value: `${conversionRate}%`, icon: TrendingUp, trend: "+2.1%", up: true, color: "text-[hsl(var(--warning))]" },
  ];

  const activityData = [
    { name: "Seg", msgs: 24 }, { name: "Ter", msgs: 38 }, { name: "Qua", msgs: 45 },
    { name: "Qui", msgs: 32 }, { name: "Sex", msgs: 56 }, { name: "Sáb", msgs: 12 }, { name: "Dom", msgs: 8 },
  ];

  const PIE_COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--info))",
    "hsl(var(--warning))",
    "hsl(var(--chart-4))",
  ];

  const statusLabels: Record<string, string> = {
    novo: "Novo",
    atendimento: "Atendimento",
    proposta: "Proposta",
    fechado: "Fechado",
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral do seu CRM</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Activity className="h-3 w-3" />
            Ao vivo
          </Badge>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 opacity-[0.05]">
              <stat.icon className="w-full h-full" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className={`h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
              <div className="flex items-center gap-1 mt-1">
                {stat.up ? (
                  <ArrowUpRight className="h-3 w-3 text-[hsl(var(--success))]" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-destructive" />
                )}
                <span className="text-xs text-[hsl(var(--success))] font-medium">{stat.trend}</span>
                <span className="text-xs text-muted-foreground">vs mês anterior</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Atividade da Semana</CardTitle>
            <Badge variant="secondary" className="text-xs font-normal">Mensagens</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData}>
                  <defs>
                    <linearGradient id="colorMsgs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="name" className="text-xs" axisLine={false} tickLine={false} />
                  <YAxis className="text-xs" axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                      color: "hsl(var(--foreground))",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="msgs"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#colorMsgs)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart - Lead Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {leadsByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={leadsByStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {leadsByStatus.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                          color: "hsl(var(--foreground))",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {leadsByStatus.map((entry, i) => (
                    <div key={entry.name} className="flex items-center gap-2 text-xs">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground">{statusLabels[entry.name] || entry.name}</span>
                      <span className="ml-auto font-medium">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Leads */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Leads Recentes</CardTitle>
            <Badge variant="outline" className="text-xs">{recentLeads.length} últimos</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead ainda</p>
            ) : (
              recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                    {lead.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.phone || "Sem telefone"}</p>
                  </div>
                  <Badge variant={lead.status === "fechado" ? "destructive" : lead.status === "novo" ? "default" : "secondary"} className="text-[10px] shrink-0">
                    {statusLabels[lead.status] || lead.status}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo Rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Robôs Ativos</p>
                <p className="text-xs text-muted-foreground">Agentes de IA configurados</p>
              </div>
              <span className="text-2xl font-bold">{agentCount}</span>
            </div>
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              <div className="h-10 w-10 rounded-lg bg-[hsl(var(--info))]/10 flex items-center justify-center text-[hsl(var(--info))]">
                <Zap className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Automações</p>
                <p className="text-xs text-muted-foreground">Follow-ups automáticos</p>
              </div>
              <Badge variant="secondary">Ativo</Badge>
            </div>
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              <div className="h-10 w-10 rounded-lg bg-[hsl(var(--warning))]/10 flex items-center justify-center text-[hsl(var(--warning))]">
                <Clock className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Tempo Médio</p>
                <p className="text-xs text-muted-foreground">Resposta ao lead</p>
              </div>
              <span className="text-lg font-bold">~2min</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
