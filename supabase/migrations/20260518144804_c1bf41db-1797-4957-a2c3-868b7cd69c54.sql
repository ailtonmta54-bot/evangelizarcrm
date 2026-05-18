
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS instagram_username text DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram_profile_pic_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS instagram_token_expires_at timestamptz;

CREATE TABLE IF NOT EXISTS public.oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL UNIQUE,
  company_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'instagram',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- No client policies: only service role (edge functions) reads/writes.
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON public.oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON public.oauth_states(expires_at);
