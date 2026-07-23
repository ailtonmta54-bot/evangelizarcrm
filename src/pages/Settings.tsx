import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, MailPlus, Save, ShieldCheck, User, Users } from "lucide-react";
import { WorkspacesSettings } from "@/components/workspaces/WorkspacesSettings";
import { toast } from "sonner";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";
import { useUserRole, type AppRole } from "@/hooks/use-user-role";
import { useWorkspaces } from "@/hooks/use-active-workspace";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Settings() {
  const companyId = useCompanyId();
  const { isAdmin, isOwner } = useUserRole();
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("user");
  const [lastInviteLink, setLastInviteLink] = useState("");
  const { data: workspaces = [] } = useWorkspaces();

  const { data: company } = useQuery({
    queryKey: ["company-settings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("name")
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

  const { data: invites = [] } = useQuery({
    queryKey: ["workspace-invites", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_invites")
        .select("id, email, role, status, token, expires_at, created_at, workspace_id")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && isAdmin,
  });

  useEffect(() => {
    if (company) {
      setCompanyName(company.name);
    }
  }, [company]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").update({
        name: companyName,
      }).eq("id", companyId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("Configurações salvas!");
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!inviteWorkspaceId) throw new Error("Selecione um workspace");
      if (inviteRole === "admin" && !isOwner) throw new Error("Somente owner pode convidar administradores");

      const { data, error } = await supabase.rpc("create_workspace_invite", {
        _email: inviteEmail,
        _workspace_id: inviteWorkspaceId,
        _role: inviteRole,
      });
      if (error) throw error;

      const token = data?.[0]?.invite_token;
      if (!token) throw new Error("Convite criado sem token");
      return `${window.location.origin}/invite/${token}`;
    },
    onSuccess: (link) => {
      setLastInviteLink(link);
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["workspace-invites"] });
      toast.success("Convite criado. Copie o link e envie ao cliente.");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao criar convite"),
  });

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

      {isAdmin && <WorkspacesSettings />}

      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MailPlus className="h-5 w-5" />
              <div>
                <CardTitle>Acesso de clientes</CardTitle>
                <CardDescription>Convide um cliente para acessar somente o workspace selecionado</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_140px_auto]">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@cliente.com"
              />
              <Select value={inviteWorkspaceId} onValueChange={setInviteWorkspaceId}>
                <SelectTrigger><SelectValue placeholder="Workspace" /></SelectTrigger>
                <SelectContent>
                  {workspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  {isOwner && <SelectItem value="admin">Admin</SelectItem>}
                </SelectContent>
              </Select>
              <Button onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending || !inviteEmail} className="gap-2">
                <MailPlus className="h-4 w-4" /> Convidar
              </Button>
            </div>

            {lastInviteLink && (
              <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{lastInviteLink}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    navigator.clipboard.writeText(lastInviteLink);
                    toast.success("Link copiado");
                  }}
                >
                  <Copy className="h-4 w-4" /> Copiar
                </Button>
              </div>
            )}

            <div className="space-y-2">
              {invites.slice(0, 6).map((invite) => (
                <div key={invite.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {workspaces.find((w) => w.id === invite.workspace_id)?.name || "Workspace"} · {invite.role}
                    </p>
                  </div>
                  <Badge variant={invite.status === "pending" ? "secondary" : "default"}>{invite.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}


      {isAdmin && (
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
          <Save className="h-4 w-4" /> {saveMutation.isPending ? "Salvando..." : "Salvar configurações"}
        </Button>
      )}
    </div>
  );
}
