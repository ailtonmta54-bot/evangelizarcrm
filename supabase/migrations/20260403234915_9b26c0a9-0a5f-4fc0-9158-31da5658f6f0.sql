ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS recognize_audio boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ignore_groups boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS ignore_voice_calls boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS ignore_video_calls boolean DEFAULT true;