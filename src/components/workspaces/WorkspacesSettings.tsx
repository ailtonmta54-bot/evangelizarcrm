import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Plus, Trash2, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/use-company-id";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const MAX = 5;

export function WorkspacesSettings() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  const { workspaces, activeWorkspaceId, setActive } = useActiveWorkspace();
  const [newName, setNewName] = useState("");

  const createMut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      const name = newName.trim() || `Workspace ${workspaces.length + 1}`;
      const { error } = await supabase.from("workspaces").insert({ company_id: companyId, name });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Workspace criado");
      setNewName("");
      qc.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (e: any) => {
      const msg = e?.message || "Erro";
      toast.error(msg.includes("limite de 5") ? "Você atingiu o limite de 5 workspaces para esta conta." : msg);
    },
  });

  const renameMut = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("workspaces").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
    onError: (e: any) => toast.error(e?.message || "Erro"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workspaces").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Workspace removido");
      qc.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (e: any) => toast.error(e?.message || "Não foi possível remover (pode ter robôs vinculados)"),
  });

  const atLimit = workspaces.length >= MAX;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          <div className="flex-1">
            <CardTitle>Workspaces</CardTitle>
            <CardDescription>
              Organize seus robôs em até {MAX} workspaces ({workspaces.length}/{MAX} usados)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {workspaces.map((w) => (
            <div key={w.id} className="flex items-center gap-2 p-3 rounded-lg border">
              <Input
                defaultValue={w.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== w.name) renameMut.mutate({ id: w.id, name: v });
                }}
                className="flex-1 h-9"
              />
              {activeWorkspaceId === w.id ? (
                <Badge className="gap-1 bg-emerald-500 hover:bg-emerald-500">
                  <Check className="h-3 w-3" /> Ativo
                </Badge>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setActive(w.id)}>
                  Ativar
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" disabled={workspaces.length <= 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover workspace?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. Robôs vinculados a este workspace impedirão a remoção.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMut.mutate(w.id)}>Remover</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome do novo workspace"
            disabled={atLimit || createMut.isPending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !atLimit) createMut.mutate();
            }}
          />
          <Button onClick={() => createMut.mutate()} disabled={atLimit || createMut.isPending} className="gap-1">
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar
          </Button>
        </div>
        {atLimit && (
          <p className="text-xs text-muted-foreground">
            Você atingiu o limite de {MAX} workspaces para esta conta.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
