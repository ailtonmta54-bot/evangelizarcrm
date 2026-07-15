import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Workspace = { id: string; name: string; company_id: string };

export function useWorkspaces() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["workspaces", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, company_id")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Workspace[];
    },
    enabled: !!user,
  });
}

export function useActiveWorkspace() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const profileQ = useQuery({
    queryKey: ["profile-active-ws", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, active_workspace_id, company_id")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const workspacesQ = useWorkspaces();

  // Fallback: se não há active_workspace_id, usa o primeiro disponível
  const activeId =
    profileQ.data?.active_workspace_id || workspacesQ.data?.[0]?.id || null;

  const active = workspacesQ.data?.find((w) => w.id === activeId) || null;

  const setActive = useMutation({
    mutationFn: async (workspaceId: string) => {
      if (!profileQ.data) return;
      const { error } = await supabase
        .from("profiles")
        .update({ active_workspace_id: workspaceId })
        .eq("id", profileQ.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      // Ao trocar de workspace, todos os dados escopados (leads, mensagens,
      // produtos, automações, fluxos, sdr, robôs) precisam ser recarregados.
      qc.invalidateQueries();
    },
  });

  return {
    workspaces: workspacesQ.data || [],
    activeWorkspaceId: activeId,
    activeWorkspace: active,
    isLoading: profileQ.isLoading || workspacesQ.isLoading,
    setActive: (id: string) => setActive.mutate(id),
  };
}
