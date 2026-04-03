
DROP POLICY IF EXISTS "Service role can insert automation logs" ON public.automation_logs;

CREATE POLICY "Users can insert company automation logs"
  ON public.automation_logs FOR INSERT
  WITH CHECK (company_id = get_user_company_id());
