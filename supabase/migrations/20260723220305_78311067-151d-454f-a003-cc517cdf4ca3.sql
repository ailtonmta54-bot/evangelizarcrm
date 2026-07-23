-- Harden profile tenant protection: the policy no longer tries to compare company_id via a re-read subquery.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

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

  IF NEW.active_workspace_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = NEW.active_workspace_id
      AND w.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Workspace inválido para esta conta.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_profile_company_id_change ON public.profiles;
DROP TRIGGER IF EXISTS protect_profile_tenant_fields_trigger ON public.profiles;
DROP TRIGGER IF EXISTS trg_protect_profile_tenant_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_tenant_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_tenant_fields();

REVOKE EXECUTE ON FUNCTION public.protect_profile_tenant_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_company_id_change() FROM PUBLIC, anon, authenticated;

-- Workspace access invitations.
CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_by uuid NOT NULL,
  accepted_user_id uuid NULL,
  accepted_at timestamptz NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_invites_email_not_blank CHECK (length(trim(email)) > 3),
  CONSTRAINT workspace_invites_no_owner_role CHECK (role <> 'owner'::public.app_role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invites TO authenticated;
GRANT ALL ON public.workspace_invites TO service_role;

ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage workspace invites" ON public.workspace_invites;
CREATE POLICY "Admins manage workspace invites"
ON public.workspace_invites
FOR ALL
TO authenticated
USING (company_id = public.get_user_company_id() AND public.is_admin_or_owner(auth.uid()))
WITH CHECK (
  company_id = public.get_user_company_id()
  AND public.is_admin_or_owner(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_invites.workspace_id
      AND w.company_id = public.get_user_company_id()
  )
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_company ON public.workspace_invites(company_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON public.workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email_status ON public.workspace_invites(lower(email), status);

DROP TRIGGER IF EXISTS update_workspace_invites_updated_at ON public.workspace_invites;
CREATE TRIGGER update_workspace_invites_updated_at
BEFORE UPDATE ON public.workspace_invites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.create_workspace_invite(
  _email text,
  _workspace_id uuid,
  _role public.app_role DEFAULT 'user'::public.app_role
)
RETURNS TABLE(invite_id uuid, invite_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _actor_company uuid;
  _workspace_company uuid;
  _clean_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  _actor_company := public.get_user_company_id();
  IF _actor_company IS NULL OR NOT public.is_admin_or_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  _clean_email := lower(trim(COALESCE(_email, '')));
  IF _clean_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Email inválido';
  END IF;

  IF _role = 'owner'::public.app_role THEN
    RAISE EXCEPTION 'Convites não podem conceder papel de owner';
  END IF;

  IF _role = 'admin'::public.app_role AND NOT public.is_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Somente owner pode convidar administradores';
  END IF;

  SELECT w.company_id INTO _workspace_company
  FROM public.workspaces w
  WHERE w.id = _workspace_id;

  IF _workspace_company IS NULL OR _workspace_company <> _actor_company THEN
    RAISE EXCEPTION 'Workspace inválido';
  END IF;

  UPDATE public.workspace_invites
  SET status = 'revoked'
  WHERE company_id = _actor_company
    AND workspace_id = _workspace_id
    AND lower(email) = _clean_email
    AND status = 'pending';

  RETURN QUERY
  INSERT INTO public.workspace_invites (company_id, workspace_id, email, role, invited_by)
  VALUES (_actor_company, _workspace_id, _clean_email, _role, auth.uid())
  RETURNING id, token;
END;
$function$;

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

REVOKE EXECUTE ON FUNCTION public.create_workspace_invite(text, uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_workspace_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_workspace_invite(text, uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(uuid) TO authenticated;

-- New users with a pending workspace invitation join that workspace instead of creating a separate company.
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

CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_default_role() FROM PUBLIC, anon, authenticated;