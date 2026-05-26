import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "owner" | "admin" | "manager" | "user";

const RANK: Record<AppRole, number> = { owner: 4, admin: 3, manager: 2, user: 1 };

export function useUserRole() {
  const { user } = useAuth();

  const { data: roles, isLoading } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data?.map((r) => r.role) ?? []) as AppRole[];
    },
    enabled: !!user,
  });

  const list = roles ?? [];
  const top = list.reduce<AppRole>(
    (acc, r) => (RANK[r] > RANK[acc] ? r : acc),
    "user"
  );

  return {
    role: top,
    roles: list,
    isOwner: list.includes("owner"),
    isAdmin: list.includes("admin") || list.includes("owner"),
    isManager: list.includes("manager") || list.includes("admin") || list.includes("owner"),
    hasRole: (r: AppRole) => RANK[top] >= RANK[r],
    isLoading,
  };
}
