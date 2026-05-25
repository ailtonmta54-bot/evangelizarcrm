import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DataDeletion() {
  return (
    <div className="min-h-screen bg-background p-6 flex items-start justify-center">
      <Card className="max-w-2xl w-full mt-10">
        <CardHeader>
          <CardTitle className="text-2xl">Exclusão de Dados do Usuário</CardTitle>
          <p className="text-sm text-muted-foreground">Evangelizar CRM — Política de exclusão de dados</p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <p>
            Respeitamos sua privacidade. Você pode solicitar a exclusão de todos os dados associados à sua conta
            (incluindo dados obtidos via login com Facebook/Instagram) a qualquer momento.
          </p>

          <h2 className="font-semibold text-base pt-2">Como solicitar a exclusão</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Envie um e-mail para <strong>ailton.mta54@gmail.com</strong> com o assunto <em>"Exclusão de dados"</em>.</li>
            <li>Informe o e-mail cadastrado e, se aplicável, o usuário do Instagram conectado.</li>
            <li>Em até 30 dias confirmaremos a exclusão completa dos seus dados de nossos sistemas e backups.</li>
          </ol>

          <h2 className="font-semibold text-base pt-2">Exclusão automática (Instagram)</h2>
          <p>
            Você também pode desconectar sua conta Instagram diretamente em <strong>Configurações → Instagram Direct → Desconectar</strong>.
            Isso revoga imediatamente o acesso e remove os tokens armazenados.
          </p>

          <h2 className="font-semibold text-base pt-2">O que é excluído</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Perfil, e-mail e dados da empresa</li>
            <li>Tokens de acesso Meta/Instagram</li>
            <li>Mensagens, leads e histórico de conversas</li>
            <li>Configurações de bots e automações</li>
          </ul>

          <p className="pt-4 text-xs text-muted-foreground">
            Última atualização: {new Date().toLocaleDateString("pt-BR")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
