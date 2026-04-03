import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useCompanyId() {
  const { user } = useAuth();
  
  const { data: companyId } = useQuery({
    queryKey: ["company-id", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data.company_id;
    },
    enabled: !!user,
  });

  return companyId;
}
