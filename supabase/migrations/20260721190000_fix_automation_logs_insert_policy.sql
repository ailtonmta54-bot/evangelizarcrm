-- Security fix: the previous INSERT policy on automation_logs used
-- WITH CHECK (true), which allowed ANY authenticated user to insert
-- fake automation log rows for any company/lead, not just the backend.
--
-- The real writer (process-automations / execute-flow edge functions)
-- uses the Supabase service role key, which bypasses RLS entirely, so
-- it does not need an INSERT policy to keep working. Removing the
-- policy closes the gap without breaking anything.

DROP POLICY IF EXISTS "Service role can insert automation logs" ON public.automation_logs;
