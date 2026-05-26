import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Shield, Mail, Database, Lock, Eye, Trash2, MessageSquare, Users } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-8">
      <Card className="w-full max-w-3xl shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Política de Privacidade</CardTitle>
          <p className="text-muted-foreground text-sm">
            Evangelizar CRM — Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-6">
              <section>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
                  <Eye className="w-5 h-5 text-primary" />
                  1. Informações que coletamos
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Coletamos informações necessárias para o funcionamento do CRM, incluindo:
                  dados de perfil do Instagram Business (nome de usuário, foto, ID da página),
                  mensagens trocadas via Instagram Direct, nomes e informações de contato dos leads,
                  e dados de uso da plataforma para melhorar nossos serviços.
                </p>
              </section>

              <Separator />

              <section>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
                  <Database className="w-5 h-5 text-primary" />
                  2. Como usamos seus dados
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Seus dados são utilizados exclusivamente para: gerenciar conversas com leads via Instagram Direct,
                  operar os robôs de IA para atendimento automatizado, armazenar histórico de interações no CRM,
                  e gerar relatórios analíticos de desempenho. Não vendemos seus dados a terceiros.
                </p>
              </section>

              <Separator />

              <section>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
                  <Lock className="w-5 h-5 text-primary" />
                  3. Segurança dos dados
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Utilizamos criptografia em trânsito (TLS/SSL) e em repouso. Tokens de acesso ao Instagram são
                  armazenados de forma segura em nosso backend e nunca expostos na interface do cliente.
                  Cada empresa/tenant tem isolamento completo de dados (multi-tenancy com RLS).
                </p>
              </section>

              <Separator />

              <section>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  4. Instagram Direct e Meta
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Nossa integração com Instagram Direct segue as políticas oficiais da Meta. O acesso é feito
                  via OAuth seguro — você nunca digita sua senha do Instagram em nossa plataforma.
                  As permissões solicitadas são limitadas ao necessário para receber e responder mensagens.
                </p>
              </section>

              <Separator />

              <section>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-primary" />
                  5. Compartilhamento com terceiros
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Compartilhamos dados apenas com: Meta (Instagram) para envio/recepção de mensagens,
                  OpenAI para processamento de mensagens quando o bot de IA está ativo,
                  e provedores de infraestrutura cloud necessários para hospedar o serviço.
                </p>
              </section>

              <Separator />

              <section>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
                  <Trash2 className="w-5 h-5 text-primary" />
                  6. Exclusão de dados
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Você pode solicitar a exclusão completa dos seus dados a qualquer momento. Ao desconectar
                  sua conta do Instagram, todos os tokens e mensagens associadas são removidos automaticamente.
                  Para exclusão total da conta, envie um e-mail para o endereço abaixo.
                </p>
              </section>

              <Separator />

              <section>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
                  <Mail className="w-5 h-5 text-primary" />
                  7. Contato
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Para questões sobre privacidade ou exclusão de dados, entre em contato:<br />
                  <strong>E-mail:</strong>{" "}
                  <a
                    href="mailto:ailton.mta54@gmail.com"
                    className="text-primary hover:underline"
                  >
                    ailton.mta54@gmail.com
                  </a>
                </p>
              </section>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
