ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS instagram_bot_debug jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS instagram_bot_debug_updated_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_companies_instagram_bot_debug_updated_at
ON public.companies (instagram_bot_debug_updated_at);