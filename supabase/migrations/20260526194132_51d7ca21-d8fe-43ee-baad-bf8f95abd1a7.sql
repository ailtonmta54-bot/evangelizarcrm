-- Grant execute on app-facing helper functions to authenticated only.
-- These are used by RLS policies and the frontend; anon must NOT call them.
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_or_above(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_whatsapp_configured() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_secrets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agent_secrets(uuid) TO authenticated;

-- Harden secret-returning functions with an explicit auth check inside.
CREATE OR REPLACE FUNCTION public.get_company_secrets()
RETURNS TABLE(whatsapp_token text, whatsapp_phone_id text, whatsapp_verify_token text, openai_api_key text, instagram_app_id text, instagram_app_secret text, instagram_access_token text, instagram_verify_token text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  RETURN QUERY
    SELECT c.whatsapp_token, c.whatsapp_phone_id, c.whatsapp_verify_token,
           c.openai_api_key, c.instagram_app_id, c.instagram_app_secret,
           c.instagram_access_token, c.instagram_verify_token
    FROM public.companies c
    WHERE c.id = public.get_user_company_id()
      AND public.has_role(auth.uid(), 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_agent_secrets(_agent_id uuid)
RETURNS TABLE(whatsapp_token text, whatsapp_verify_token text, zapi_token text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  RETURN QUERY
    SELECT a.whatsapp_token, a.whatsapp_verify_token, a.zapi_token
    FROM public.agents a
    WHERE a.id = _agent_id
      AND a.company_id = public.get_user_company_id()
      AND public.has_role(auth.uid(), 'admin');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_secrets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agent_secrets(uuid) TO authenticated;

-- Trigger functions (handle_new_user, assign_default_role, check_*_limit,
-- protect_profile_tenant_fields, update_updated_at_column) intentionally
-- receive no EXECUTE grant: they run via the trigger system, not via API.