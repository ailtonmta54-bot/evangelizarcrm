ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS zapi_instance_id text DEFAULT '',
ADD COLUMN IF NOT EXISTS zapi_token text DEFAULT '',
ADD COLUMN IF NOT EXISTS zapi_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_provider text DEFAULT 'official';