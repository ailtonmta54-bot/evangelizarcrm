
-- 1. Restrict sensitive column reads on companies & agents
REVOKE SELECT (whatsapp_token, whatsapp_verify_token, openai_api_key,
  instagram_app_secret, instagram_access_token, instagram_verify_token)
  ON public.companies FROM anon, authenticated;

REVOKE SELECT (whatsapp_token, whatsapp_verify_token, zapi_token)
  ON public.agents FROM anon, authenticated;

-- 2. Admin-only RPC: company secrets
CREATE OR REPLACE FUNCTION public.get_company_secrets()
RETURNS TABLE (
  whatsapp_token text,
  whatsapp_phone_id text,
  whatsapp_verify_token text,
  openai_api_key text,
  instagram_app_id text,
  instagram_app_secret text,
  instagram_access_token text,
  instagram_verify_token text
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT c.whatsapp_token, c.whatsapp_phone_id, c.whatsapp_verify_token,
         c.openai_api_key, c.instagram_app_id, c.instagram_app_secret,
         c.instagram_access_token, c.instagram_verify_token
  FROM public.companies c
  WHERE c.id = public.get_user_company_id()
    AND public.has_role(auth.uid(), 'admin');
$$;
REVOKE EXECUTE ON FUNCTION public.get_company_secrets() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_company_secrets() TO authenticated;

-- 3. Admin-only RPC: agent secrets
CREATE OR REPLACE FUNCTION public.get_agent_secrets(_agent_id uuid)
RETURNS TABLE (
  whatsapp_token text,
  whatsapp_verify_token text,
  zapi_token text
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT a.whatsapp_token, a.whatsapp_verify_token, a.zapi_token
  FROM public.agents a
  WHERE a.id = _agent_id
    AND a.company_id = public.get_user_company_id()
    AND public.has_role(auth.uid(), 'admin');
$$;
REVOKE EXECUTE ON FUNCTION public.get_agent_secrets(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_agent_secrets(uuid) TO authenticated;

-- 4. Boolean helper for inbox (no token leakage)
CREATE OR REPLACE FUNCTION public.is_company_whatsapp_configured()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = public.get_user_company_id()
      AND COALESCE(whatsapp_token, '') <> ''
      AND COALESCE(whatsapp_phone_id, '') <> ''
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_company_whatsapp_configured() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_company_whatsapp_configured() TO authenticated;

-- 5. Restrict EXECUTE on existing helper functions from anon/public
REVOKE EXECUTE ON FUNCTION public.get_user_company_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.assign_default_role() FROM anon, authenticated, public;

-- 6. Replace agent-avatars storage policies with ownership scoping
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND (policyname ILIKE '%agent%avatar%' OR policyname ILIKE '%agent-avatars%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Agent avatars: company members can read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'agent-avatars'
    AND EXISTS (
      SELECT 1 FROM public.agents
      WHERE id::text = (storage.foldername(name))[1]
        AND company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "Agent avatars: company members can insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'agent-avatars'
    AND EXISTS (
      SELECT 1 FROM public.agents
      WHERE id::text = (storage.foldername(name))[1]
        AND company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "Agent avatars: company members can update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'agent-avatars'
    AND EXISTS (
      SELECT 1 FROM public.agents
      WHERE id::text = (storage.foldername(name))[1]
        AND company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "Agent avatars: company members can delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'agent-avatars'
    AND EXISTS (
      SELECT 1 FROM public.agents
      WHERE id::text = (storage.foldername(name))[1]
        AND company_id = public.get_user_company_id()
    )
  );
