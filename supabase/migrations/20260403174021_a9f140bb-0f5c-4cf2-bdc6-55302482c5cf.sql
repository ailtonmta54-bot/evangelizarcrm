
-- Add delay_hours to automations for follow-up timing
ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS delay_hours integer NOT NULL DEFAULT 0;

-- Create automation_logs table to track executed automations
CREATE TABLE public.automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company automation logs"
  ON public.automation_logs FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Service role can insert automation logs"
  ON public.automation_logs FOR INSERT
  WITH CHECK (true);
