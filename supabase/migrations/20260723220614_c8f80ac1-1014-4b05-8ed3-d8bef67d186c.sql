CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id),
  CONSTRAINT workspace_members_no_owner_role CHECK (role <> 'owner'::public.app_role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view access" ON public.workspace_members;
CREATE POLICY "Workspace members can view access"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()))
);

DROP POLICY IF EXISTS "Admins manage workspace members" ON public.workspace_members;
CREATE POLICY "Admins manage workspace members"
ON public.workspace_members
FOR ALL
TO authenticated
USING (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()))
WITH CHECK (
  company_id = public.get_user_company_id()
  AND public.is_admin_or_owner(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_members.workspace_id
      AND w.company_id = public.get_user_company_id()
  )
);

DROP TRIGGER IF EXISTS update_workspace_members_updated_at ON public.workspace_members;
CREATE TRIGGER update_workspace_members_updated_at
BEFORE UPDATE ON public.workspace_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.can_access_workspace(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE w.id = _workspace_id
      AND w.company_id = public.get_user_company_id()
      AND (
        public.is_admin_or_owner(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = w.id
            AND wm.user_id = auth.uid()
        )
      )
  )
$function$;

REVOKE EXECUTE ON FUNCTION public.can_access_workspace(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_workspace(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_active_workspace_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT p.active_workspace_id
     FROM public.profiles p
     WHERE p.user_id = auth.uid()
       AND p.active_workspace_id IS NOT NULL
       AND public.can_access_workspace(p.active_workspace_id)),
    (SELECT w.id FROM public.workspaces w
       WHERE w.company_id = public.get_user_company_id()
         AND public.can_access_workspace(w.id)
       ORDER BY w.created_at ASC LIMIT 1)
  )
$function$;

CREATE OR REPLACE FUNCTION public.protect_profile_tenant_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Não é permitido alterar o usuário do perfil.';
  END IF;

  IF NEW.company_id IS DISTINCT FROM OLD.company_id
     AND COALESCE(current_setting('app.workspace_invite_accept', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Não é permitido alterar a empresa do perfil.';
  END IF;

  IF NEW.active_workspace_id IS NOT NULL AND NOT public.can_access_workspace(NEW.active_workspace_id) THEN
    IF COALESCE(current_setting('app.workspace_invite_accept', true), '') <> 'on'
       OR NOT EXISTS (
         SELECT 1 FROM public.workspaces w
         WHERE w.id = NEW.active_workspace_id
           AND w.company_id = NEW.company_id
       ) THEN
      RAISE EXCEPTION 'Workspace inválido para esta conta.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS ws_select_company ON public.workspaces;
CREATE POLICY ws_select_company
ON public.workspaces
FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id() AND public.can_access_workspace(id));

DROP POLICY IF EXISTS ws_update_admin ON public.workspaces;
CREATE POLICY ws_update_admin
ON public.workspaces
FOR UPDATE
TO authenticated
USING ((company_id = public.get_user_company_id()) AND public.is_admin_or_owner(auth.uid()))
WITH CHECK ((company_id = public.get_user_company_id()) AND public.is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS agents_select_ws ON public.agents;
CREATE POLICY agents_select_ws
ON public.agents
FOR SELECT
TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (workspace_id IS NULL OR public.can_access_workspace(workspace_id))
);

DROP POLICY IF EXISTS "Admins create agents" ON public.agents;
CREATE POLICY "Admins create agents"
ON public.agents
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id()
  AND public.is_admin_or_owner(auth.uid())
  AND (workspace_id IS NULL OR public.can_access_workspace(workspace_id))
);

DROP POLICY IF EXISTS "Admins update agents" ON public.agents;
CREATE POLICY "Admins update agents"
ON public.agents
FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()))
WITH CHECK (
  company_id = public.get_user_company_id()
  AND public.is_admin_or_owner(auth.uid())
  AND (workspace_id IS NULL OR public.can_access_workspace(workspace_id))
);

DROP POLICY IF EXISTS leads_select_ws ON public.leads;
CREATE POLICY leads_select_ws ON public.leads FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id() AND public.can_access_workspace(workspace_id));
DROP POLICY IF EXISTS leads_insert_ws ON public.leads;
CREATE POLICY leads_insert_ws ON public.leads FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id() AND public.can_access_workspace(workspace_id));
DROP POLICY IF EXISTS leads_update_ws ON public.leads;
CREATE POLICY leads_update_ws ON public.leads FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id() AND public.can_access_workspace(workspace_id))
WITH CHECK (company_id = public.get_user_company_id() AND public.can_access_workspace(workspace_id));
DROP POLICY IF EXISTS leads_delete_ws ON public.leads;
CREATE POLICY leads_delete_ws ON public.leads FOR DELETE TO authenticated
USING (company_id = public.get_user_company_id() AND public.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS messages_select_ws ON public.messages;
CREATE POLICY messages_select_ws ON public.messages FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id() AND public.can_access_workspace(workspace_id));
DROP POLICY IF EXISTS messages_insert_ws ON public.messages;
CREATE POLICY messages_insert_ws ON public.messages FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id() AND public.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS products_select_ws ON public.products;
CREATE POLICY products_select_ws ON public.products FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id() AND public.can_access_workspace(workspace_id));
DROP POLICY IF EXISTS products_insert_ws ON public.products;
CREATE POLICY products_insert_ws ON public.products FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id() AND public.can_access_workspace(workspace_id));
DROP POLICY IF EXISTS products_update_ws ON public.products;
CREATE POLICY products_update_ws ON public.products FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id() AND public.can_access_workspace(workspace_id))
WITH CHECK (company_id = public.get_user_company_id() AND public.can_access_workspace(workspace_id));
DROP POLICY IF EXISTS products_delete_ws ON public.products;
CREATE POLICY products_delete_ws ON public.products FOR DELETE TO authenticated
USING (company_id = public.get_user_company_id() AND public.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS automations_select_ws ON public.automations;
CREATE POLICY automations_select_ws ON public.automations FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id() AND public.can_access_workspace(workspace_id));
DROP POLICY IF EXISTS automations_insert_ws ON public.automations;
CREATE POLICY automations_insert_ws ON public.automations FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()) AND public.can_access_workspace(workspace_id));
DROP POLICY IF EXISTS automations_update_ws ON public.automations;
CREATE POLICY automations_update_ws ON public.automations FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()) AND public.can_access_workspace(workspace_id))
WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()) AND public.can_access_workspace(workspace_id));
DROP POLICY IF EXISTS automations_delete_ws ON public.automations;
CREATE POLICY automations_delete_ws ON public.automations FOR DELETE TO authenticated
USING (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()) AND public.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS flows_select_ws ON public.flows;
CREATE POLICY flows_select_ws ON public.flows FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id() AND public.can_access_workspace(workspace_id));
DROP POLICY IF EXISTS flows_insert_ws ON public.flows;
CREATE POLICY flows_insert_ws ON public.flows FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()) AND public.can_access_workspace(workspace_id));
DROP POLICY IF EXISTS flows_update_ws ON public.flows;
CREATE POLICY flows_update_ws ON public.flows FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()) AND public.can_access_workspace(workspace_id))
WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()) AND public.can_access_workspace(workspace_id));
DROP POLICY IF EXISTS flows_delete_ws ON public.flows;
CREATE POLICY flows_delete_ws ON public.flows FOR DELETE TO authenticated
USING (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()) AND public.can_access_workspace(workspace_id));

DROP POLICY IF EXISTS sdr_select_ws ON public.sdr_config;
CREATE POLICY sdr_select_ws ON public.sdr_config FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id() AND public.can_access_workspace(workspace_id));
DROP POLICY IF EXISTS sdr_insert_ws ON public.sdr_config;
CREATE POLICY sdr_insert_ws ON public.sdr_config FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()) AND public.can_access_workspace(workspace_id));
DROP POLICY IF EXISTS sdr_update_ws ON public.sdr_config;
CREATE POLICY sdr_update_ws ON public.sdr_config FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()) AND public.can_access_workspace(workspace_id))
WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()) AND public.can_access_workspace(workspace_id));
DROP POLICY IF EXISTS sdr_delete_ws ON public.sdr_config;
CREATE POLICY sdr_delete_ws ON public.sdr_config FOR DELETE TO authenticated
USING (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()) AND public.can_access_workspace(workspace_id));

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _invite public.workspace_invites%ROWTYPE;
  _user_email text;
  _full_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT lower(email), COALESCE(raw_user_meta_data->>'full_name', '')
  INTO _user_email, _full_name
  FROM auth.users
  WHERE id = auth.uid();

  SELECT * INTO _invite
  FROM public.workspace_invites
  WHERE token = _token
    AND status = 'pending'
    AND expires_at > now();

  IF _invite.id IS NULL THEN
    RAISE EXCEPTION 'Convite inválido ou expirado';
  END IF;

  IF lower(_invite.email) <> _user_email THEN
    RAISE EXCEPTION 'Este convite pertence a outro email';
  END IF;

  PERFORM set_config('app.workspace_invite_accept', 'on', true);

  INSERT INTO public.workspace_members (company_id, workspace_id, user_id, role)
  VALUES (_invite.company_id, _invite.workspace_id, auth.uid(), _invite.role)
  ON CONFLICT (workspace_id, user_id) DO UPDATE
  SET role = EXCLUDED.role, company_id = EXCLUDED.company_id;

  INSERT INTO public.profiles (user_id, full_name, company_id, active_workspace_id)
  VALUES (auth.uid(), _full_name, _invite.company_id, _invite.workspace_id)
  ON CONFLICT (user_id) DO UPDATE
  SET company_id = EXCLUDED.company_id,
      active_workspace_id = EXCLUDED.active_workspace_id,
      full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name);

  DELETE FROM public.user_roles WHERE user_id = auth.uid();
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), _invite.role)
  ON CONFLICT DO NOTHING;

  UPDATE public.workspace_invites
  SET status = 'accepted', accepted_at = now(), accepted_user_id = auth.uid()
  WHERE id = _invite.id;

  INSERT INTO public.audit_logs (company_id, user_id, action, resource_type, resource_id, metadata)
  VALUES (
    _invite.company_id,
    auth.uid(),
    'workspace_invite_accepted',
    'workspace',
    _invite.workspace_id,
    jsonb_build_object('invite_id', _invite.id, 'email', _invite.email, 'role', _invite.role)
  );

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_company_id uuid;
  new_workspace_id uuid;
  pending_invite public.workspace_invites%ROWTYPE;
  new_full_name text;
BEGIN
  new_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name','');

  SELECT * INTO pending_invite
  FROM public.workspace_invites
  WHERE lower(email) = lower(NEW.email)
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF pending_invite.id IS NOT NULL THEN
    INSERT INTO public.workspace_members (company_id, workspace_id, user_id, role)
    VALUES (pending_invite.company_id, pending_invite.workspace_id, NEW.id, pending_invite.role)
    ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, company_id = EXCLUDED.company_id;

    INSERT INTO public.profiles (user_id, full_name, company_id, active_workspace_id)
    VALUES (NEW.id, new_full_name, pending_invite.company_id, pending_invite.workspace_id);

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, pending_invite.role)
    ON CONFLICT DO NOTHING;

    UPDATE public.workspace_invites
    SET status = 'accepted', accepted_at = now(), accepted_user_id = NEW.id
    WHERE id = pending_invite.id;

    INSERT INTO public.audit_logs (company_id, user_id, action, resource_type, resource_id, metadata)
    VALUES (
      pending_invite.company_id,
      NEW.id,
      'workspace_invite_accepted_on_signup',
      'workspace',
      pending_invite.workspace_id,
      jsonb_build_object('invite_id', pending_invite.id, 'email', pending_invite.email, 'role', pending_invite.role)
    );

    RETURN NEW;
  END IF;

  INSERT INTO public.companies (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name','Minha Empresa') || ' - Empresa')
  RETURNING id INTO new_company_id;

  INSERT INTO public.workspaces (company_id, name)
  VALUES (new_company_id, 'Workspace principal')
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.profiles (user_id, full_name, company_id, active_workspace_id)
  VALUES (
    NEW.id,
    new_full_name,
    new_company_id,
    new_workspace_id
  );

  INSERT INTO public.sdr_config (company_id, workspace_id, prompt, tone, goal)
  VALUES (new_company_id, new_workspace_id, 'Você é um assistente de vendas. Seja cordial e objetivo.','amigavel','qualificar');

  RETURN NEW;
END;
$function$;

INSERT INTO public.workspace_members (company_id, workspace_id, user_id, role)
SELECT p.company_id, p.active_workspace_id, p.user_id,
  CASE WHEN COALESCE(ur.role, 'user'::public.app_role) = 'owner'::public.app_role THEN 'admin'::public.app_role ELSE COALESCE(ur.role, 'user'::public.app_role) END
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT role FROM public.user_roles ur
  WHERE ur.user_id = p.user_id
  ORDER BY CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'manager' THEN 3 ELSE 4 END
  LIMIT 1
) ur ON true
WHERE p.active_workspace_id IS NOT NULL
ON CONFLICT (workspace_id, user_id) DO NOTHING;