-- 1. Tabela workspaces
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Novo workspace',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_workspaces_company ON public.workspaces(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select_company" ON public.workspaces
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "ws_insert_admin" ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id() AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "ws_update_admin" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "ws_delete_admin" ON public.workspaces
  FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.has_role(auth.uid(),'admin'));

-- 2. Limite de 5 workspaces por conta
CREATE OR REPLACE FUNCTION public.check_workspace_limit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.workspaces WHERE company_id = NEW.company_id) >= 5 THEN
    RAISE EXCEPTION 'Você atingiu o limite de 5 workspaces para esta conta.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_workspace_limit
  BEFORE INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.check_workspace_limit();

CREATE TRIGGER trg_workspaces_updated
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Coluna workspace_id em agents
ALTER TABLE public.agents ADD COLUMN workspace_id uuid;
CREATE INDEX idx_agents_workspace ON public.agents(workspace_id);

-- 4. Migrar dados existentes
INSERT INTO public.workspaces (company_id, name)
SELECT id, 'Workspace principal' FROM public.companies;

UPDATE public.agents a
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.company_id = a.company_id AND a.workspace_id IS NULL;

-- 5. Limite de 5 robôs por workspace
CREATE OR REPLACE FUNCTION public.check_agent_limit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.workspace_id IS NOT NULL
     AND (SELECT count(*) FROM public.agents WHERE workspace_id = NEW.workspace_id) >= 5 THEN
    RAISE EXCEPTION 'Este workspace já atingiu o limite de 5 robôs.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_agent_limit
  BEFORE INSERT ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.check_agent_limit();

-- 6. Workspace ativo no perfil
ALTER TABLE public.profiles ADD COLUMN active_workspace_id uuid;
UPDATE public.profiles p
SET active_workspace_id = w.id
FROM public.workspaces w
WHERE w.company_id = p.company_id AND p.active_workspace_id IS NULL;

-- 7. Atualiza handle_new_user para criar workspace inicial
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_company_id uuid;
  new_workspace_id uuid;
BEGIN
  INSERT INTO public.companies (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name','Minha Empresa') || ' - Empresa')
  RETURNING id INTO new_company_id;

  INSERT INTO public.workspaces (company_id, name)
  VALUES (new_company_id, 'Workspace principal')
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.profiles (user_id, full_name, company_id, active_workspace_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    new_company_id,
    new_workspace_id
  );

  INSERT INTO public.sdr_config (company_id, prompt, tone, goal)
  VALUES (new_company_id,'Você é um assistente de vendas. Seja cordial e objetivo.','amigavel','qualificar');

  RETURN NEW;
END;
$$;