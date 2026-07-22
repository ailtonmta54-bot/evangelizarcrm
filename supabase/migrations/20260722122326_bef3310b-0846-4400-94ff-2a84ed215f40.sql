
-- Revoke PUBLIC (includes anon) execute on SECURITY DEFINER helpers that leaked it
REVOKE EXECUTE ON FUNCTION public.get_active_workspace_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fill_lead_workspace() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fill_message_workspace() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_active_workspace_id() FROM anon;

-- Trigger functions should only run via triggers, not RPC
REVOKE EXECUTE ON FUNCTION public.fill_lead_workspace() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_message_workspace() FROM anon, authenticated;

-- Ensure companies table cannot be inserted/deleted by clients (explicit deny policies)
DROP POLICY IF EXISTS "No client inserts on companies" ON public.companies;
CREATE POLICY "No client inserts on companies" ON public.companies FOR INSERT TO authenticated, anon WITH CHECK (false);

DROP POLICY IF EXISTS "No client deletes on companies" ON public.companies;
CREATE POLICY "No client deletes on companies" ON public.companies FOR DELETE TO authenticated, anon USING (false);

-- Ensure user_roles cannot be inserted/updated/deleted by clients (role changes go through set_user_role RPC)
DROP POLICY IF EXISTS "No client inserts on user_roles" ON public.user_roles;
CREATE POLICY "No client inserts on user_roles" ON public.user_roles FOR INSERT TO authenticated, anon WITH CHECK (false);

DROP POLICY IF EXISTS "No client updates on user_roles" ON public.user_roles;
CREATE POLICY "No client updates on user_roles" ON public.user_roles FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No client deletes on user_roles" ON public.user_roles;
CREATE POLICY "No client deletes on user_roles" ON public.user_roles FOR DELETE TO authenticated, anon USING (false);

-- Harden profiles UPDATE: WITH CHECK ensures company_id cannot be swapped to another company (trigger also enforces this)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );
