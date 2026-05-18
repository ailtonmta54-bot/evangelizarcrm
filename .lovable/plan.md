# Integração Instagram Direct no Evangelizar CRM

Adicionar o Instagram como **novo canal de mensagens** ao lado do WhatsApp já existente, reutilizando Inbox, CRM Kanban, Robôs IA, Automações e Dashboard. Sem reescrever o que já funciona.

## Entrega em 3 fases

### Fase 1 — Conexão + Inbox Instagram (esta entrega)
- Página **Configurações → Instagram**: campos Meta App ID, App Secret, Access Token (long-lived), Instagram Business Account ID, Page ID, Webhook Verify Token. Botão "Testar conexão" e exibição da Webhook URL pronta para colar no painel Meta.
- **Webhook público** (`instagram-webhook`) recebendo mensagens em tempo real, criando/atualizando lead com `source = 'instagram'` e gravando mensagem.
- **Envio** (`instagram-send`) via Graph API `/me/messages` usando o token da empresa.
- **Inbox**: identificador visual do canal (ícone Instagram vs WhatsApp), foto e @username quando disponíveis, envio responde pelo canal de origem do lead.
- Campos novos no lead: `instagram_username`, `instagram_user_id`, `profile_pic_url`, `email`, `interest`, `source`, `assigned_to`, `follow_up_date`, `notes`.

### Fase 2 — IA Instagram + Tags automáticas + Takeover humano
- Reaproveita Robôs IA (já existem com base de conhecimento, tom, temperatura). Adiciona seletor de canal no robô: WhatsApp / Instagram / Ambos.
- Toggle **IA ligada/desligada por conversa** no header do chat (campo `ai_enabled` já existe na tabela `leads`).
- Tags automáticas por palavra-chave (price, comprar, agendar, proposta) usando o motor de automações existente.
- Notificação interna quando o lead pede humano ou dispara palavra quente.

### Fase 3 — Dashboard Instagram + RBAC refinado
- Cards no Dashboard: leads IG, mensagens IG novas, conversas IA vs humano, conversão por etapa.
- Manter Admin (configura integração) e Atendente (responde + leads atribuídos). Admin/Manager unificados por enquanto.

## Mudanças no banco (Fase 1)

```text
companies
  + instagram_app_id          text
  + instagram_app_secret      text
  + instagram_access_token    text
  + instagram_business_id     text
  + instagram_page_id         text
  + instagram_verify_token    text
  + instagram_enabled         boolean default false

leads
  + source                    text default 'whatsapp'   -- 'whatsapp' | 'instagram' | 'manual'
  + instagram_username        text
  + instagram_user_id         text     -- IGSID, usado para enviar resposta
  + profile_pic_url           text
  + email                     text
  + interest                  text
  + assigned_to               uuid     -- profiles.user_id
  + follow_up_date            timestamptz
  + notes                     text
  + tags                      text[]   default '{}'

agents
  + channel                   text default 'whatsapp'   -- 'whatsapp' | 'instagram' | 'both'
```

RLS: novas colunas herdam as policies por `company_id` já existentes.

## Edge Functions novas

- `instagram-webhook` (público, `verify_jwt = false`): GET para handshake do Meta, POST para receber `messages`/`messaging_postbacks`. Cria lead se não existir (lookup por `instagram_user_id`), grava mensagem `recebida`, dispara IA se `ai_enabled` e robô com canal `instagram`/`both` ativo.
- `instagram-send`: recebe `{ lead_id, message }`, busca token da empresa, chama `https://graph.facebook.com/v21.0/me/messages` com `messaging_product: "instagram"`, grava mensagem `enviada`.

Reutiliza `sdr-ai-respond` para gerar a resposta IA (já implementado).

## Mudanças de frontend (Fase 1)

- `src/pages/Settings.tsx`: nova aba **Instagram** com formulário + status de conexão + URL do webhook copiável.
- `src/pages/Inbox.tsx`: badge do canal por lead, roteamento de envio (`instagram-send` vs `whatsapp-send`), exibir @username e avatar IG.
- `src/components/instagram/InstagramSettings.tsx`: componente do formulário.
- `src/pages/Contatos.tsx`: filtro por canal/origem e novos campos do lead.

## Pré-requisitos do usuário (depois da entrega)

1. App no Meta for Developers com produtos **Instagram Graph API** + **Webhooks**.
2. Conta Instagram **Business/Creator** ligada a uma **Página do Facebook**.
3. Permissões aprovadas: `instagram_basic`, `instagram_manage_messages`, `pages_messaging`, `pages_show_list`.
4. Colar credenciais na nova aba e configurar o Webhook no painel Meta com a URL que o CRM mostra.

## Fora do escopo desta entrega

- Aprovação de App no Meta (processo manual do usuário).
- Reescrita do Inbox/CRM existente.
- Novo papel "Manager" (mantém Admin/User atuais; Atendente = User).
- Notificações push externas — só toasts internos por enquanto.
