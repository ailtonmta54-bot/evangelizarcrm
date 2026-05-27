ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS instagram_bot_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'whatsapp';
CREATE INDEX IF NOT EXISTS idx_messages_channel ON public.messages(channel);