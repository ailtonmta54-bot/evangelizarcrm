import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Cross, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Invite() {
  const { token } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (loading || !user || !token || accepted || accepting) return;

    const acceptInvite = async () => {
      setAccepting(true);
      const { error } = await supabase.rpc("accept_workspace_invite", { _token: token });
      setAccepting(false);

      if (error) {
        toast.error(error.message || "Não foi possível aceitar o convite");
        return;
      }

      setAccepted(true);
      toast.success("Acesso liberado");
      setTimeout(() => navigate("/dashboard"), 900);
    };

    acceptInvite();
  }, [accepted, accepting, loading, navigate, token, user]);

  if (!token) {
    return (
      <InviteShell icon={<ShieldAlert className="h-6 w-6 text-destructive" />} title="Convite inválido" description="O link de convite está incompleto." />
    );
  }

  if (loading || accepting) {
    return <InviteShell icon={<Loader2 className="h-6 w-6 animate-spin text-primary" />} title="Liberando acesso" description="Aguarde enquanto validamos seu convite." />;
  }

  if (!user) {
    return (
      <InviteShell
        icon={<Cross className="h-6 w-6 text-primary" />}
        title="Entre para aceitar o convite"
        description="Use o mesmo email que recebeu o convite. Se ainda não tiver conta, cadastre-se por este link."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild><Link to={`/login?invite=${token}`}>Entrar</Link></Button>
          <Button asChild variant="outline"><Link to={`/register?invite=${token}`}>Criar conta</Link></Button>
        </div>
      </InviteShell>
    );
  }

  return <InviteShell icon={<CheckCircle2 className="h-6 w-6 text-success" />} title="Convite aceito" description="Você será redirecionado para o CRM." />;
}

function InviteShell({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children?: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">{icon}</div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {children && <CardContent>{children}</CardContent>}
      </Card>
    </div>
  );
}