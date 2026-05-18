
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS instagram_app_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram_app_secret text DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram_access_token text DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram_business_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram_page_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram_verify_token text DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS instagram_username text DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram_user_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS profile_pic_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS interest text DEFAULT '',
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS follow_up_date timestamptz,
  ADD COLUMN IF NOT EXISTS notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_leads_instagram_user_id ON public.leads(instagram_user_id) WHERE instagram_user_id IS NOT NULL AND instagram_user_id <> '';
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads(source);

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'whatsapp';
