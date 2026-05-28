
-- ISSUE 1: Revoke SELECT/UPDATE on sensitive token columns of public.agents from client roles
REVOKE SELECT (whatsapp_token, whatsapp_verify_token, zapi_token, zapi_instance_id) ON public.agents FROM anon, authenticated;
REVOKE UPDATE (whatsapp_token, whatsapp_verify_token, zapi_token, zapi_instance_id) ON public.agents FROM anon, authenticated;
REVOKE INSERT (whatsapp_token, whatsapp_verify_token, zapi_token, zapi_instance_id) ON public.agents FROM anon, authenticated;

-- ISSUE 2: agent_credentials is service-role / SECURITY DEFINER only. Make this explicit.
ALTER TABLE public.agent_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_credentials FROM anon, authenticated;
GRANT ALL ON public.agent_credentials TO service_role;

-- Explicit deny-all policies so intent is documented (no client access; SECURITY DEFINER funcs bypass RLS).
DROP POLICY IF EXISTS "agent_credentials_no_client_select" ON public.agent_credentials;
CREATE POLICY "agent_credentials_no_client_select"
  ON public.agent_credentials FOR SELECT TO authenticated, anon USING (false);

DROP POLICY IF EXISTS "agent_credentials_no_client_insert" ON public.agent_credentials;
CREATE POLICY "agent_credentials_no_client_insert"
  ON public.agent_credentials FOR INSERT TO authenticated, anon WITH CHECK (false);

DROP POLICY IF EXISTS "agent_credentials_no_client_update" ON public.agent_credentials;
CREATE POLICY "agent_credentials_no_client_update"
  ON public.agent_credentials FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "agent_credentials_no_client_delete" ON public.agent_credentials;
CREATE POLICY "agent_credentials_no_client_delete"
  ON public.agent_credentials FOR DELETE TO authenticated, anon USING (false);

-- ISSUE 3: Fix storage.objects policies for agent-avatars to validate by agent UUID path.
-- Path format: company_id/agent_id/<file>
DROP POLICY IF EXISTS agent_avatars_read_company ON storage.objects;
DROP POLICY IF EXISTS agent_avatars_insert_admin ON storage.objects;
DROP POLICY IF EXISTS agent_avatars_update_admin ON storage.objects;
DROP POLICY IF EXISTS agent_avatars_delete_admin ON storage.objects;

CREATE POLICY agent_avatars_select_company
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'agent-avatars'
    AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
  );

CREATE POLICY agent_avatars_insert_admin
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'agent-avatars'
    AND public.is_admin_or_owner(auth.uid())
    AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
    AND EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.company_id = public.get_user_company_id()
        AND a.id::text = (storage.foldername(name))[2]
    )
  );

CREATE POLICY agent_avatars_update_admin
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'agent-avatars'
    AND public.is_admin_or_owner(auth.uid())
    AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
  )
  WITH CHECK (
    bucket_id = 'agent-avatars'
    AND public.is_admin_or_owner(auth.uid())
    AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
    AND EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.company_id = public.get_user_company_id()
        AND a.id::text = (storage.foldername(name))[2]
    )
  );

CREATE POLICY agent_avatars_delete_admin
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'agent-avatars'
    AND public.is_admin_or_owner(auth.uid())
    AND (storage.foldername(name))[1] = (public.get_user_company_id())::text
  );
