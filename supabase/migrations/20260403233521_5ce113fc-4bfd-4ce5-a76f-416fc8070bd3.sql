
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS whatsapp_token text DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp_phone_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp_verify_token text DEFAULT '',
  ADD COLUMN IF NOT EXISTS keywords text DEFAULT '',
  ADD COLUMN IF NOT EXISTS schedule_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS schedule_start time DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS schedule_end time DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS schedule_days text DEFAULT 'seg,ter,qua,qui,sex',
  ADD COLUMN IF NOT EXISTS away_message text DEFAULT 'Olá! No momento estamos fora do horário de atendimento. Retornaremos em breve!';
