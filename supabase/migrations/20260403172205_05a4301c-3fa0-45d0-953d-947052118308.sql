
ALTER TABLE public.companies
  ADD COLUMN whatsapp_token TEXT DEFAULT '',
  ADD COLUMN whatsapp_phone_id TEXT DEFAULT '',
  ADD COLUMN whatsapp_verify_token TEXT DEFAULT '',
  ADD COLUMN openai_api_key TEXT DEFAULT '';
