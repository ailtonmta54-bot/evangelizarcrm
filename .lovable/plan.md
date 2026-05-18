# Instagram OAuth — Conexão Simples para Clientes Revenda

## Objetivo
O cliente final do CRM conecta o Instagram dele em **1 clique** ("Conectar Instagram" → login Meta → autorizar → pronto). Nenhuma chave técnica é exposta. Credenciais do App Meta ficam apenas no backend da plataforma (você, o revendedor).

## Mudança de arquitetura

**Antes (atual):** cada empresa preenchia App ID, Secret, Token, Verify Token na tela de Configurações.
**Agora:** existe **um único App Meta da plataforma** (suas credenciais como dono do CRM white-label). Cada cliente apenas autoriza esse App a acessar a conta Instagram dele via OAuth.

```text
Plataforma (você)                     Cliente final
─────────────────                     ─────────────
META_APP_ID         ──── OAuth ────►  Botão "Conectar Instagram"
META_APP_SECRET                       Login Meta + Autorização
META_VERIFY_TOKEN                     Token salvo no tenant dele
WEBHOOK único                  ◄────  DMs chegam em tempo real
```

## Pré-requisitos do revendedor (você, uma vez só)

1. Criar um App Meta em developers.facebook.com com produtos:
   - **Facebook Login for Business**
   - **Instagram Graph API** + **Webhooks**
2. Permissões solicitadas: `instagram_basic`, `instagram_manage_messages`, `pages_messaging`, `pages_show_list`, `pages_manage_metadata`, `business_management`
3. Configurar **Valid OAuth Redirect URI** = URL da edge function `instagram-oauth-callback`
4. Configurar Webhook único (URL já existente `instagram-webhook`) com Verify Token e assinar o campo `messages`
5. Informar 3 secrets ao CRM: `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`

> Esses secrets são armazenados no backend da plataforma. Nenhum cliente vê.

## Mudanças no banco

**Remover de `companies`** (não são mais por cliente):
- `instagram_app_id`, `instagram_app_secret`, `instagram_verify_token`

**Manter/usar em `companies`** (preenchidos automaticamente pelo OAuth):
- `instagram_access_token` (token de longa duração ~60 dias do cliente)
- `instagram_business_id` (IG Business Account ID)
- `instagram_page_id` (Page ID vinculada)
- `instagram_enabled` (true após OAuth bem-sucedido)

**Adicionar em `companies`:**
- `instagram_username` (texto, exibição)
- `instagram_profile_pic_url` (texto)
- `instagram_connected_at` (timestamp)
- `instagram_token_expires_at` (timestamp, para alerta de renovação)

## Edge functions

### 1. `instagram-oauth-start` (nova, autenticada)
- Recebe `company_id` do usuário logado
- Gera `state` aleatório (CSRF), salva em tabela `oauth_states` com `company_id` + `expires_at` (10 min)
- Retorna URL `https://www.facebook.com/v21.0/dialog/oauth?client_id=...&redirect_uri=...&state=...&scope=...`
- Frontend faz `window.location.href = url`

### 2. `instagram-oauth-callback` (nova, pública — `verify_jwt = false`)
- Recebe `?code=...&state=...` da Meta
- Valida `state` em `oauth_states`, extrai `company_id`, deleta o state
- Troca `code` → `short_token` no endpoint `/oauth/access_token`
- Troca `short_token` → `long_token` (60 dias) em `/oauth/access_token?grant_type=fb_exchange_token`
- Busca Pages do usuário em `/me/accounts` → pega `page_id` + `page_access_token`
- Busca IG Business Account vinculado: `/{page_id}?fields=instagram_business_account`
- Busca perfil IG: `/{ig_id}?fields=username,profile_picture_url`
- Inscreve a Page no webhook: `POST /{page_id}/subscribed_apps?subscribed_fields=messages`
- Salva em `companies`: token, ig_business_id, page_id, username, pic, expires_at, enabled=true
- Redireciona para `/{frontend}/configuracoes?instagram=connected`

### 3. `instagram-disconnect` (nova, autenticada)
- Limpa campos IG da `companies` do usuário, enabled=false

### 4. `instagram-webhook` (existente, ajustar)
- Continuar usando `META_WEBHOOK_VERIFY_TOKEN` global do env (não mais por empresa)
- Lookup da empresa continua por `instagram_business_id`

### 5. `instagram-send` (existente, sem mudanças)

## Nova tabela `oauth_states`
```sql
id uuid pk, state text unique, company_id uuid, provider text, 
created_at timestamptz, expires_at timestamptz
```
Sem RLS de leitura (só edge functions usam via service role).

## Frontend

### Reescrever `InstagramSettings.tsx`
Substituir o formulário técnico por um **card de status simples**:

- **Estado desconectado:** ícone Instagram + texto "Conecte sua conta Instagram Business para receber DMs no CRM" + botão grande **"Conectar Instagram"** (chama `instagram-oauth-start` e redireciona)
- **Estado conectado:** avatar + `@username` + badge verde "Conectado" + data de conexão + botão "Desconectar"
- Alerta amarelo se `token_expires_at` < 7 dias: "Reconecte sua conta para continuar recebendo mensagens"
- Detecta `?instagram=connected` ou `?instagram=error=...` na URL e mostra toast

### Sem mudanças necessárias em:
- Inbox (lead.source === 'instagram' já roteia para `instagram-send`)
- CRM, Robôs IA, Automações, Dashboard

## Multi-tenant / Isolamento
- Já garantido por RLS via `company_id` em todas as tabelas (`leads`, `messages`, etc.)
- O webhook usa `service role` mas resolve `company_id` por `instagram_business_id` único
- Cada cliente vê apenas leads e DMs da própria empresa
- Admin da empresa vê quem está conectado no card de status; admin da plataforma (você) vê via banco

## Secrets a adicionar
- `META_APP_ID`
- `META_APP_SECRET`
- `META_WEBHOOK_VERIFY_TOKEN`

## Fora de escopo
- Renovação automática de token (faremos alerta; renovação é re-OAuth manual em ~60 dias — padrão Meta)
- Aprovação do App Meta (revisão Meta é responsabilidade sua como revendedor)
- Painel "super admin" multi-empresa (você consulta via banco se precisar)
