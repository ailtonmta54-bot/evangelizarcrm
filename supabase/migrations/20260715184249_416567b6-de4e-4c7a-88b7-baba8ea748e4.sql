-- Helper
CREATE OR REPLACE FUNCTION public.get_active_workspace_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT p.active_workspace_id FROM public.profiles p WHERE p.user_id = auth.uid()),
    (SELECT w.id FROM public.workspaces w
       WHERE w.company_id = public.get_user_company_id()
       ORDER BY w.created_at ASC LIMIT 1)
  )
$$;

-- Add columns
ALTER TABLE public.leads       ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.messages    ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.products    ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.flows       ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.sdr_config  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Drop old unique on sdr_config.company_id BEFORE backfilling copies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sdr_config_company_id_key') THEN
    ALTER TABLE public.sdr_config DROP CONSTRAINT sdr_config_company_id_key;
  END IF;
END $$;

-- Backfill workspace_id (first workspace of company)
WITH first_ws AS (
  SELECT DISTINCT ON (company_id) company_id, id AS workspace_id
  FROM public.workspaces ORDER BY company_id, created_at ASC
)
UPDATE public.leads l SET workspace_id = f.workspace_id
FROM first_ws f WHERE l.company_id = f.company_id AND l.workspace_id IS NULL;

WITH first_ws AS (SELECT DISTINCT ON (company_id) company_id, id AS workspace_id FROM public.workspaces ORDER BY company_id, created_at ASC)
UPDATE public.messages m SET workspace_id = f.workspace_id FROM first_ws f WHERE m.company_id = f.company_id AND m.workspace_id IS NULL;

WITH first_ws AS (SELECT DISTINCT ON (company_id) company_id, id AS workspace_id FROM public.workspaces ORDER BY company_id, created_at ASC)
UPDATE public.products p SET workspace_id = f.workspace_id FROM first_ws f WHERE p.company_id = f.company_id AND p.workspace_id IS NULL;

WITH first_ws AS (SELECT DISTINCT ON (company_id) company_id, id AS workspace_id FROM public.workspaces ORDER BY company_id, created_at ASC)
UPDATE public.automations a SET workspace_id = f.workspace_id FROM first_ws f WHERE a.company_id = f.company_id AND a.workspace_id IS NULL;

WITH first_ws AS (SELECT DISTINCT ON (company_id) company_id, id AS workspace_id FROM public.workspaces ORDER BY company_id, created_at ASC)
UPDATE public.flows fl SET workspace_id = f.workspace_id FROM first_ws f WHERE fl.company_id = f.company_id AND fl.workspace_id IS NULL;

WITH first_ws AS (SELECT DISTINCT ON (company_id) company_id, id AS workspace_id FROM public.workspaces ORDER BY company_id, created_at ASC)
UPDATE public.sdr_config s SET workspace_id = f.workspace_id FROM first_ws f WHERE s.company_id = f.company_id AND s.workspace_id IS NULL;

WITH first_ws AS (SELECT DISTINCT ON (company_id) company_id, id AS workspace_id FROM public.workspaces ORDER BY company_id, created_at ASC)
UPDATE public.agents ag SET workspace_id = f.workspace_id FROM first_ws f WHERE ag.company_id = f.company_id AND ag.workspace_id IS NULL;

-- Duplicate sdr_config for the additional workspaces
INSERT INTO public.sdr_config (company_id, workspace_id, prompt, tone, goal)
SELECT s.company_id, w.id, s.prompt, s.tone, s.goal
FROM public.sdr_config s
JOIN public.workspaces w ON w.company_id = s.company_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.sdr_config s2
  WHERE s2.company_id = s.company_id AND s2.workspace_id = w.id
);

-- NOT NULL + DEFAULT
ALTER TABLE public.leads       ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.leads       ALTER COLUMN workspace_id SET DEFAULT public.get_active_workspace_id();
ALTER TABLE public.messages    ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.messages    ALTER COLUMN workspace_id SET DEFAULT public.get_active_workspace_id();
ALTER TABLE public.products    ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.products    ALTER COLUMN workspace_id SET DEFAULT public.get_active_workspace_id();
ALTER TABLE public.automations ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.automations ALTER COLUMN workspace_id SET DEFAULT public.get_active_workspace_id();
ALTER TABLE public.flows       ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.flows       ALTER COLUMN workspace_id SET DEFAULT public.get_active_workspace_id();
ALTER TABLE public.sdr_config  ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.sdr_config  ALTER COLUMN workspace_id SET DEFAULT public.get_active_workspace_id();

-- Unique per workspace
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sdr_config_workspace_id_unique') THEN
    ALTER TABLE public.sdr_config ADD CONSTRAINT sdr_config_workspace_id_unique UNIQUE (workspace_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS leads_workspace_idx       ON public.leads(workspace_id);
CREATE INDEX IF NOT EXISTS messages_workspace_idx    ON public.messages(workspace_id);
CREATE INDEX IF NOT EXISTS products_workspace_idx    ON public.products(workspace_id);
CREATE INDEX IF NOT EXISTS automations_workspace_idx ON public.automations(workspace_id);
CREATE INDEX IF NOT EXISTS flows_workspace_idx       ON public.flows(workspace_id);

-- Policies
DROP POLICY IF EXISTS "Users can view company agents" ON public.agents;
CREATE POLICY "agents_select_ws" ON public.agents FOR SELECT
  USING (company_id = public.get_user_company_id()
         AND (workspace_id IS NULL OR workspace_id = public.get_active_workspace_id()));

DROP POLICY IF EXISTS "Users can view company leads"   ON public.leads;
DROP POLICY IF EXISTS "Users can create company leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update company leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete company leads" ON public.leads;
CREATE POLICY "leads_select_ws" ON public.leads FOR SELECT
  USING (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id());
CREATE POLICY "leads_insert_ws" ON public.leads FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id());
CREATE POLICY "leads_update_ws" ON public.leads FOR UPDATE
  USING (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id());
CREATE POLICY "leads_delete_ws" ON public.leads FOR DELETE
  USING (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id());

DROP POLICY IF EXISTS "Users can view company messages"   ON public.messages;
DROP POLICY IF EXISTS "Users can create company messages" ON public.messages;
CREATE POLICY "messages_select_ws" ON public.messages FOR SELECT
  USING (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id());
CREATE POLICY "messages_insert_ws" ON public.messages FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id());

DROP POLICY IF EXISTS "Users can view company products"   ON public.products;
DROP POLICY IF EXISTS "Users can create company products" ON public.products;
DROP POLICY IF EXISTS "Users can update company products" ON public.products;
DROP POLICY IF EXISTS "Users can delete company products" ON public.products;
CREATE POLICY "products_select_ws" ON public.products FOR SELECT
  USING (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id());
CREATE POLICY "products_insert_ws" ON public.products FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id());
CREATE POLICY "products_update_ws" ON public.products FOR UPDATE
  USING (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id());
CREATE POLICY "products_delete_ws" ON public.products FOR DELETE
  USING (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id());

DROP POLICY IF EXISTS "Users can view company automations" ON public.automations;
DROP POLICY IF EXISTS "Admins create automations"          ON public.automations;
DROP POLICY IF EXISTS "Admins update automations"          ON public.automations;
DROP POLICY IF EXISTS "Admins delete automations"          ON public.automations;
CREATE POLICY "automations_select_ws" ON public.automations FOR SELECT
  USING (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id());
CREATE POLICY "automations_insert_ws" ON public.automations FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id() AND public.is_admin_or_owner(auth.uid()));
CREATE POLICY "automations_update_ws" ON public.automations FOR UPDATE
  USING (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id() AND public.is_admin_or_owner(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id() AND public.is_admin_or_owner(auth.uid()));
CREATE POLICY "automations_delete_ws" ON public.automations FOR DELETE
  USING (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id() AND public.is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can view company flows"   ON public.flows;
DROP POLICY IF EXISTS "Users can create company flows" ON public.flows;
DROP POLICY IF EXISTS "Users can update company flows" ON public.flows;
DROP POLICY IF EXISTS "Users can delete company flows" ON public.flows;
CREATE POLICY "flows_select_ws" ON public.flows FOR SELECT
  USING (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id());
CREATE POLICY "flows_insert_ws" ON public.flows FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id());
CREATE POLICY "flows_update_ws" ON public.flows FOR UPDATE
  USING (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id());
CREATE POLICY "flows_delete_ws" ON public.flows FOR DELETE
  USING (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id());

DROP POLICY IF EXISTS "Users can view company sdr config" ON public.sdr_config;
DROP POLICY IF EXISTS "Admins create sdr"                 ON public.sdr_config;
DROP POLICY IF EXISTS "Admins update sdr"                 ON public.sdr_config;
DROP POLICY IF EXISTS "Admins delete sdr"                 ON public.sdr_config;
CREATE POLICY "sdr_select_ws" ON public.sdr_config FOR SELECT
  USING (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id());
CREATE POLICY "sdr_insert_ws" ON public.sdr_config FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id() AND public.is_admin_or_owner(auth.uid()));
CREATE POLICY "sdr_update_ws" ON public.sdr_config FOR UPDATE
  USING (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id() AND public.is_admin_or_owner(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id() AND public.is_admin_or_owner(auth.uid()));
CREATE POLICY "sdr_delete_ws" ON public.sdr_config FOR DELETE
  USING (company_id = public.get_user_company_id() AND workspace_id = public.get_active_workspace_id() AND public.is_admin_or_owner(auth.uid()));