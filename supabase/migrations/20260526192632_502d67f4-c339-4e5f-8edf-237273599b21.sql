-- Prevent tenant hijacking through profiles updates
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
    SELECT 1
    FROM public.workspaces w
    WHERE w.id = NEW.active_workspace_id
      AND w.company_id = OLD.company_id
  ) THEN
    RAISE EXCEPTION 'Workspace inválido para esta conta.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_tenant_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_tenant_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_tenant_fields();

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND company_id = public.get_user_company_id());

-- Restrict agent creation/deletion to admins
DROP POLICY IF EXISTS "Users can create company agents" ON public.agents;
DROP POLICY IF EXISTS "Users can delete company agents" ON public.agents;

CREATE POLICY "Admins can create company agents"
ON public.agents
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id()
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND (
    workspace_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id
        AND w.company_id = public.get_user_company_id()
    )
  )
);

CREATE POLICY "Admins can delete company agents"
ON public.agents
FOR DELETE
TO authenticated
USING (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Restrict automation writes to admins
DROP POLICY IF EXISTS "Users can create company automations" ON public.automations;
DROP POLICY IF EXISTS "Users can update company automations" ON public.automations;
DROP POLICY IF EXISTS "Users can delete company automations" ON public.automations;

CREATE POLICY "Admins can create company automations"
ON public.automations
FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update company automations"
ON public.automations
FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete company automations"
ON public.automations
FOR DELETE
TO authenticated
USING (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Restrict SDR configuration writes to admins
DROP POLICY IF EXISTS "Users can create company sdr config" ON public.sdr_config;
DROP POLICY IF EXISTS "Users can update company sdr config" ON public.sdr_config;

CREATE POLICY "Admins can create company sdr config"
ON public.sdr_config
FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update company sdr config"
ON public.sdr_config
FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Explicitly deny direct user role mutations by anon/authenticated clients
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- Avoid public listing of all files in public agent avatar bucket
DROP POLICY IF EXISTS "Agent avatars: public read" ON storage.objects;
CREATE POLICY "Agent avatars: company members can read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'agent-avatars'
  AND EXISTS (
    SELECT 1 FROM public.agents
    WHERE (agents.id)::text = (storage.foldername(storage.objects.name))[1]
      AND agents.company_id = public.get_user_company_id()
  )
);