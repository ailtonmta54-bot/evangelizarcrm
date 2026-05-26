import { Navigate, Outlet } from "react-router-dom";
import { useUserRole, type AppRole } from "@/hooks/use-user-role";
import { ShieldAlert } from "lucide-react";

interface RoleGuardProps {
  required: AppRole;
  redirectTo?: string;
  children?: React.ReactNode;
}

export function RoleGuard({ required, redirectTo, children }: RoleGuardProps) {
  const { hasRole, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasRole(required)) {
    if (redirectTo) return <Navigate to={redirectTo} replace />;
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <h2 className="text-2xl font-semibold">Acesso negado</h2>
        <p className="text-muted-foreground max-w-md">
          Você não tem permissão para acessar esta área. Fale com o administrador da sua conta.
        </p>
      </div>
    );
  }

  return <>{children ?? <Outlet />}</>;
}
