-- Backend-only storage for per-agent integration credentials
CREATE TABLE IF NOT EXISTS public.agent_credentials (
  agent_id uuid PRIMARY KEY REFERENCES public.agents(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  whatsapp_token text NOT NULL DEFAULT '',
  whatsapp_verify_token text NOT NULL DEFAULT '',
  zapi_token text NOT NULL DEFAULT '',
  zapi_instance_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.agent_credentials TO service_role;
ALTER TABLE public.agent_credentials ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS agent_credentials_company_idx ON public.agent_credentials(company_id);
CREATE INDEX IF NOT EXISTS agent_credentials_whatsapp_verify_idx ON public.agent_credentials(whatsapp_verify_token) WHERE whatsapp_verify_token <> '';

INSERT INTO public.agent_credentials (agent_id, company_id, whatsapp_token, whatsapp_verify_token, zapi_token, zapi_instance_id)
SELECT id, company_id, COALESCE(whatsapp_token, ''), COALESCE(whatsapp_verify_token, ''), COALESCE(zapi_token, ''), COALESCE(zapi_instance_id, '')
FROM public.agents
ON CONFLICT (agent_id) DO UPDATE SET
  company_id = EXCLUDED.company_id,
  whatsapp_token = COALESCE(NULLIF(public.agent_credentials.whatsapp_token, ''), EXCLUDED.whatsapp_token),
  whatsapp_verify_token = COALESCE(NULLIF(public.agent_credentials.whatsapp_verify_token, ''), EXCLUDED.whatsapp_verify_token),
  zapi_token = COALESCE(NULLIF(public.agent_credentials.zapi_token, ''), EXCLUDED.zapi_token),
  zapi_instance_id = COALESCE(NULLIF(public.agent_credentials.zapi_instance_id, ''), EXCLUDED.zapi_instance_id),
  updated_at = now();

REVOKE SELECT (whatsapp_token, whatsapp_verify_token, zapi_token, zapi_instance_id) ON public.agents FROM anon, authenticated, public;
REVOKE UPDATE (whatsapp_token, whatsapp_verify_token, zapi_token, zapi_instance_id) ON public.agents FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.mask_secret(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(_value, '') = '' THEN ''
    WHEN length(_value) <= 4 THEN '••••••' || _value
    ELSE '••••••' || right(_value, 4)
  END
$$;
REVOKE EXECUTE ON FUNCTION public.mask_secret(text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.mask_secret(text) TO service_role;

DROP FUNCTION IF EXISTS public.get_agent_secrets(uuid);
CREATE OR REPLACE FUNCTION public.get_agent_secrets(_agent_id uuid)
RETURNS TABLE (
  whatsapp_token text,
  whatsapp_verify_token text,
  zapi_token text,
  zapi_instance_id text,
  has_whatsapp_token boolean,
  has_whatsapp_verify_token boolean,
  has_zapi_token boolean,
  has_zapi_instance_id boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.mask_secret(ac.whatsapp_token),
    public.mask_secret(ac.whatsapp_verify_token),
    public.mask_secret(ac.zapi_token),
    public.mask_secret(ac.zapi_instance_id),
    COALESCE(ac.whatsapp_token, '') <> '',
    COALESCE(ac.whatsapp_verify_token, '') <> '',
    COALESCE(ac.zapi_token, '') <> '',
    COALESCE(ac.zapi_instance_id, '') <> ''
  FROM public.agent_credentials ac
  JOIN public.agents a ON a.id = ac.agent_id
  WHERE ac.agent_id = _agent_id
    AND ac.company_id = public.get_user_company_id()
    AND public.is_admin_or_owner(auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.get_agent_secrets(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_agent_secrets(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_agent_secret(_agent_id uuid, _field text, _value text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _clean_value text := COALESCE(_value, '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT a.company_id INTO _company_id
  FROM public.agents a
  WHERE a.id = _agent_id
    AND a.company_id = public.get_user_company_id();

  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Agent not found';
  END IF;

  INSERT INTO public.agent_credentials (agent_id, company_id)
  VALUES (_agent_id, _company_id)
  ON CONFLICT (agent_id) DO NOTHING;

  IF _field = 'whatsapp_token' THEN
    UPDATE public.agent_credentials SET whatsapp_token = _clean_value, updated_at = now() WHERE agent_id = _agent_id;
  ELSIF _field = 'whatsapp_verify_token' THEN
    UPDATE public.agent_credentials SET whatsapp_verify_token = _clean_value, updated_at = now() WHERE agent_id = _agent_id;
  ELSIF _field = 'zapi_token' THEN
    UPDATE public.agent_credentials SET zapi_token = _clean_value, updated_at = now() WHERE agent_id = _agent_id;
  ELSIF _field = 'zapi_instance_id' THEN
    UPDATE public.agent_credentials SET zapi_instance_id = _clean_value, updated_at = now() WHERE agent_id = _agent_id;
  ELSE
    RAISE EXCEPTION 'Unsupported secret field';
  END IF;

  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.save_agent_secret(uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.save_agent_secret(uuid, text, text) TO authenticated;

-- Lock company ownership on profiles after creation
CREATE OR REPLACE FUNCTION public.protect_profile_tenant_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Não é permitido alterar o usuário do perfil.';
  END IF;

  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'Não é permitido alterar a empresa do perfil.';
  END IF;

  IF NEW.active_workspace_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = NEW.active_workspace_id
      AND w.company_id = OLD.company_id
  ) THEN
    RAISE EXCEPTION 'Workspace inválido para esta conta.';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_profile_tenant_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_tenant_fields_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_tenant_fields();

-- Client users cannot directly grant roles; use secure function only
DROP POLICY IF EXISTS "Owners manage roles" ON public.user_roles;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated, public;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

CREATE OR REPLACE FUNCTION public.set_user_role(_target_user_id uuid, _role app_role, _grant boolean DEFAULT true)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_company uuid;
  _target_company uuid;
  _actor_is_owner boolean;
  _actor_is_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Não é permitido alterar o próprio papel.';
  END IF;

  SELECT company_id INTO _actor_company FROM public.profiles WHERE user_id = auth.uid();
  SELECT company_id INTO _target_company FROM public.profiles WHERE user_id = _target_user_id;

  IF _actor_company IS NULL OR _target_company IS NULL OR _actor_company <> _target_company THEN
    RAISE EXCEPTION 'Usuário fora da empresa.';
  END IF;

  _actor_is_owner := public.is_owner(auth.uid());
  _actor_is_admin := public.is_admin_or_owner(auth.uid());

  IF NOT _actor_is_admin THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF _role = 'owner' AND NOT _actor_is_owner THEN
    RAISE EXCEPTION 'Somente owner pode gerenciar owner.';
  END IF;

  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_target_user_id, _role)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = _target_user_id AND role = _role;
  END IF;

  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, app_role, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, app_role, boolean) TO authenticated;

-- Remove conflicting avatar storage rules and create a single clear policy set
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        policyname ILIKE '%agent%avatar%'
        OR policyname IN (
          'Agent avatars: public read',
          'Agent avatars: company members can read',
          'Agent avatars: company members can insert',
          'Agent avatars: company members can update',
          'Agent avatars: company members can delete',
          'agent_avatars_public_read',
          'agent_avatars_read_company',
          'agent_avatars_write_admin',
          'agent_avatars_update_admin',
          'agent_avatars_delete_admin'
        )
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

UPDATE storage.buckets SET public = false WHERE id = 'agent-avatars';

CREATE POLICY "agent_avatars_read_company"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'agent-avatars'
  AND EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.company_id = public.get_user_company_id()
      AND (storage.foldername(name))[1] = a.id::text
  )
);

CREATE POLICY "agent_avatars_insert_admin"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'agent-avatars'
  AND public.is_admin_or_owner(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.company_id = public.get_user_company_id()
      AND (storage.foldername(name))[1] = a.id::text
  )
);

CREATE POLICY "agent_avatars_update_admin"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'agent-avatars'
  AND public.is_admin_or_owner(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.company_id = public.get_user_company_id()
      AND (storage.foldername(name))[1] = a.id::text
  )
)
WITH CHECK (
  bucket_id = 'agent-avatars'
  AND public.is_admin_or_owner(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.company_id = public.get_user_company_id()
      AND (storage.foldername(name))[1] = a.id::text
  )
);

CREATE POLICY "agent_avatars_delete_admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'agent-avatars'
  AND public.is_admin_or_owner(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.company_id = public.get_user_company_id()
      AND (storage.foldername(name))[1] = a.id::text
  )
);

-- Ensure exposed tenant tables enforce row-level protection
ALTER TABLE public.agent_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;