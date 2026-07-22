CREATE OR REPLACE FUNCTION public.prevent_profile_company_id_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'company_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_profile_company_id_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_profile_company_id_change() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_profile_company_id_change() FROM authenticated;

DROP TRIGGER IF EXISTS prevent_profile_company_id_change ON public.profiles;
CREATE TRIGGER prevent_profile_company_id_change
  BEFORE UPDATE OF company_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_company_id_change();

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND company_id = (
    SELECT p.company_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
  )
);