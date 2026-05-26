
-- 1) Add new roles to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
COMMIT;

-- 2) Promote each company's first admin to 'owner'
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (p.company_id) ur.user_id
    FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.role = 'admin'
    ORDER BY p.company_id, ur.created_at ASC
  LOOP
    INSERT INTO public.user_roles(user_id, role) VALUES (r.user_id, 'owner')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Update default-role trigger: first user of system becomes owner
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  user_count integer;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) Helper: has_any_role (admin OR owner) etc.
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='owner');
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('owner','admin'));
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_above(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('owner','admin','manager'));
$$;

-- 4) Lock down profiles UPDATE with strict WITH CHECK
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.get_user_company_id()
  );

-- 5) user_roles: only owner can manage
DROP POLICY IF EXISTS "Owners manage roles" ON public.user_roles;
CREATE POLICY "Owners manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (
    public.is_owner(auth.uid())
    -- Only owners can promote to owner/admin
  );

REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

-- 6) Agents: require admin/owner on INSERT/DELETE (UPDATE already admin)
DROP POLICY IF EXISTS "Admins can create company agents" ON public.agents;
DROP POLICY IF EXISTS "Admins can delete company agents" ON public.agents;
DROP POLICY IF EXISTS "Admins can update company agents" ON public.agents;

CREATE POLICY "Admins create agents" ON public.agents FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.is_admin_or_owner(auth.uid())
    AND (workspace_id IS NULL OR EXISTS(
      SELECT 1 FROM public.workspaces w WHERE w.id = agents.workspace_id AND w.company_id = public.get_user_company_id()
    ))
  );
CREATE POLICY "Admins update agents" ON public.agents FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()));
CREATE POLICY "Admins delete agents" ON public.agents FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()));

-- 7) Automations: admin/owner only on write
DROP POLICY IF EXISTS "Admins can create company automations" ON public.automations;
DROP POLICY IF EXISTS "Admins can update company automations" ON public.automations;
DROP POLICY IF EXISTS "Admins can delete company automations" ON public.automations;
CREATE POLICY "Admins create automations" ON public.automations FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()));
CREATE POLICY "Admins update automations" ON public.automations FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()));
CREATE POLICY "Admins delete automations" ON public.automations FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()));

-- 8) SDR config: admin/owner on write
DROP POLICY IF EXISTS "Admins can create company sdr config" ON public.sdr_config;
DROP POLICY IF EXISTS "Admins can update company sdr config" ON public.sdr_config;
DROP POLICY IF EXISTS "Admins can delete company sdr config" ON public.sdr_config;
CREATE POLICY "Admins create sdr" ON public.sdr_config FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()));
CREATE POLICY "Admins update sdr" ON public.sdr_config FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()));
CREATE POLICY "Admins delete sdr" ON public.sdr_config FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()));

-- 9) Storage bucket: restrict listing of agent-avatars to own company
UPDATE storage.buckets SET public = false WHERE id = 'agent-avatars';

DROP POLICY IF EXISTS "agent_avatars_public_read" ON storage.objects;
DROP POLICY IF EXISTS "agent_avatars_read_company" ON storage.objects;
DROP POLICY IF EXISTS "agent_avatars_write_admin" ON storage.objects;
DROP POLICY IF EXISTS "agent_avatars_delete_admin" ON storage.objects;

CREATE POLICY "agent_avatars_read_company" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'agent-avatars'
    AND EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.company_id = public.get_user_company_id()
        AND (storage.foldername(name))[1] = a.id::text
    )
  );

CREATE POLICY "agent_avatars_write_admin" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'agent-avatars'
    AND public.is_admin_or_owner(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.company_id = public.get_user_company_id()
        AND (storage.foldername(name))[1] = a.id::text
    )
  );

CREATE POLICY "agent_avatars_update_admin" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'agent-avatars'
    AND public.is_admin_or_owner(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.company_id = public.get_user_company_id()
        AND (storage.foldername(name))[1] = a.id::text
    )
  );

CREATE POLICY "agent_avatars_delete_admin" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'agent-avatars'
    AND public.is_admin_or_owner(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.company_id = public.get_user_company_id()
        AND (storage.foldername(name))[1] = a.id::text
    )
  );

-- 10) Unique WhatsApp phone id per workspace (prevent duplicate numbers)
CREATE UNIQUE INDEX IF NOT EXISTS agents_workspace_whatsapp_unique
  ON public.agents (workspace_id, whatsapp_phone_id)
  WHERE whatsapp_phone_id IS NOT NULL AND whatsapp_phone_id <> '';

-- 11) Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_company_created_idx ON public.audit_logs(company_id, created_at DESC);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view company audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()));

CREATE POLICY "Users insert their own audit logs" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id() AND user_id = auth.uid());

-- 12) oauth_states: ensure RLS denies everything to clients (service role only)
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.oauth_states FROM anon, authenticated;
GRANT ALL ON public.oauth_states TO service_role;
