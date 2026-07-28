
-- Fix 1: Revoke PUBLIC execute on set_workspace_from_active (anon-executable SECURITY DEFINER)
REVOKE EXECUTE ON FUNCTION public.set_workspace_from_active() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_workspace_from_active() FROM anon;

-- Fix 2: Harden profiles UPDATE policy so users cannot change their own company_id.
-- The previous WITH CHECK read from profiles (which returns the row *being* updated),
-- allowing self-reassignment. Replace with a check that requires company_id to remain
-- equal to the pre-update value via the trigger `protect_profile_tenant_fields`, and
-- lock the policy to just user ownership.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Ensure the tenant-field protection trigger exists (blocks company_id/user_id changes)
DROP TRIGGER IF EXISTS protect_profile_tenant_fields_trg ON public.profiles;
CREATE TRIGGER protect_profile_tenant_fields_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_tenant_fields();
