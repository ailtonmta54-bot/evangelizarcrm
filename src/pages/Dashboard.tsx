import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, DollarSign, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";

const chartData = [
  { name: "Jan", leads: 65, vendas: 12 },
  { name: "Fev", leads: 78, vendas: 18 },
  { name: "Mar", leads: 90, vendas: 22 },
  { name: "Abr", leads: 120, vendas: 29 },
  { name: "Mai", leads: 150, vendas: 35 },
  { name: "Jun", leads: 180, vendas: 42 },
];

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

  const conversionRate = leadCount > 0 ? ((closedDeals / leadCount) * 100).toFixed(1) : "0";

  const stats = [
    { title: "Total de Leads", value: String(leadCount), icon: Users },
    { title: "Mensagens", value: String(activeMessages), icon: MessageSquare },
    { title: "Vendas Realizadas", value: String(closedDeals), icon: DollarSign },
    { title: "Taxa de Conversão", value: `${conversionRate}%`, icon: TrendingUp },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu CRM</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leads & Vendas (mock)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="vendas" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
