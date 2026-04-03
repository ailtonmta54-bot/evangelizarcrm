
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS elevenlabs_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS elevenlabs_voice_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS google_calendar_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_calendar_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS google_calendar_link text DEFAULT '';
