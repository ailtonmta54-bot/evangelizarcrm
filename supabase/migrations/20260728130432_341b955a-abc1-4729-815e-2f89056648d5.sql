
-- Scope all workspace-owned data to the currently active workspace of the user.
-- get_active_workspace_id() already validates access via can_access_workspace().

-- AGENTS
DROP POLICY IF EXISTS "agents_select_ws" ON public.agents;
DROP POLICY IF EXISTS "Admins create agents" ON public.agents;
DROP POLICY IF EXISTS "Admins update agents" ON public.agents;
DROP POLICY IF EXISTS "Admins delete agents" ON public.agents;

CREATE POLICY "agents_select_ws" ON public.agents FOR SELECT TO authenticated
  USING (company_id = get_user_company_id() AND workspace_id = get_active_workspace_id());
CREATE POLICY "agents_insert_ws" ON public.agents FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND is_admin_or_owner(auth.uid())
             AND workspace_id = get_active_workspace_id());
CREATE POLICY "agents_update_ws" ON public.agents FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND is_admin_or_owner(auth.uid()) AND workspace_id = get_active_workspace_id())
  WITH CHECK (company_id = get_user_company_id() AND is_admin_or_owner(auth.uid()) AND workspace_id = get_active_workspace_id());
CREATE POLICY "agents_delete_ws" ON public.agents FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND is_admin_or_owner(auth.uid()) AND workspace_id = get_active_workspace_id());

-- LEADS
DROP POLICY IF EXISTS "leads_select_ws" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_ws" ON public.leads;
DROP POLICY IF EXISTS "leads_update_ws" ON public.leads;
DROP POLICY IF EXISTS "leads_delete_ws" ON public.leads;
CREATE POLICY "leads_select_ws" ON public.leads FOR SELECT TO authenticated
  USING (company_id = get_user_company_id() AND workspace_id = get_active_workspace_id());
CREATE POLICY "leads_insert_ws" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND workspace_id = get_active_workspace_id());
CREATE POLICY "leads_update_ws" ON public.leads FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND workspace_id = get_active_workspace_id())
  WITH CHECK (company_id = get_user_company_id() AND workspace_id = get_active_workspace_id());
CREATE POLICY "leads_delete_ws" ON public.leads FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND workspace_id = get_active_workspace_id());

-- MESSAGES
DROP POLICY IF EXISTS "messages_select_ws" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_ws" ON public.messages;
CREATE POLICY "messages_select_ws" ON public.messages FOR SELECT TO authenticated
  USING (company_id = get_user_company_id() AND workspace_id = get_active_workspace_id());
CREATE POLICY "messages_insert_ws" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND workspace_id = get_active_workspace_id());

-- PRODUCTS
DROP POLICY IF EXISTS "products_select_ws" ON public.products;
DROP POLICY IF EXISTS "products_insert_ws" ON public.products;
DROP POLICY IF EXISTS "products_update_ws" ON public.products;
DROP POLICY IF EXISTS "products_delete_ws" ON public.products;
CREATE POLICY "products_select_ws" ON public.products FOR SELECT TO authenticated
  USING (company_id = get_user_company_id() AND workspace_id = get_active_workspace_id());
CREATE POLICY "products_insert_ws" ON public.products FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND workspace_id = get_active_workspace_id());
CREATE POLICY "products_update_ws" ON public.products FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND workspace_id = get_active_workspace_id())
  WITH CHECK (company_id = get_user_company_id() AND workspace_id = get_active_workspace_id());
CREATE POLICY "products_delete_ws" ON public.products FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND workspace_id = get_active_workspace_id());

-- AUTOMATIONS
DROP POLICY IF EXISTS "automations_select_ws" ON public.automations;
DROP POLICY IF EXISTS "automations_insert_ws" ON public.automations;
DROP POLICY IF EXISTS "automations_update_ws" ON public.automations;
DROP POLICY IF EXISTS "automations_delete_ws" ON public.automations;
CREATE POLICY "automations_select_ws" ON public.automations FOR SELECT TO authenticated
  USING (company_id = get_user_company_id() AND workspace_id = get_active_workspace_id());
CREATE POLICY "automations_insert_ws" ON public.automations FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND is_admin_or_owner(auth.uid()) AND workspace_id = get_active_workspace_id());
CREATE POLICY "automations_update_ws" ON public.automations FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND is_admin_or_owner(auth.uid()) AND workspace_id = get_active_workspace_id())
  WITH CHECK (company_id = get_user_company_id() AND is_admin_or_owner(auth.uid()) AND workspace_id = get_active_workspace_id());
CREATE POLICY "automations_delete_ws" ON public.automations FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND is_admin_or_owner(auth.uid()) AND workspace_id = get_active_workspace_id());

-- FLOWS
DROP POLICY IF EXISTS "flows_select_ws" ON public.flows;
DROP POLICY IF EXISTS "flows_insert_ws" ON public.flows;
DROP POLICY IF EXISTS "flows_update_ws" ON public.flows;
DROP POLICY IF EXISTS "flows_delete_ws" ON public.flows;
CREATE POLICY "flows_select_ws" ON public.flows FOR SELECT TO authenticated
  USING (company_id = get_user_company_id() AND workspace_id = get_active_workspace_id());
CREATE POLICY "flows_insert_ws" ON public.flows FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND is_admin_or_owner(auth.uid()) AND workspace_id = get_active_workspace_id());
CREATE POLICY "flows_update_ws" ON public.flows FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND is_admin_or_owner(auth.uid()) AND workspace_id = get_active_workspace_id())
  WITH CHECK (company_id = get_user_company_id() AND is_admin_or_owner(auth.uid()) AND workspace_id = get_active_workspace_id());
CREATE POLICY "flows_delete_ws" ON public.flows FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND is_admin_or_owner(auth.uid()) AND workspace_id = get_active_workspace_id());

-- SDR CONFIG
DROP POLICY IF EXISTS "sdr_select_ws" ON public.sdr_config;
DROP POLICY IF EXISTS "sdr_insert_ws" ON public.sdr_config;
DROP POLICY IF EXISTS "sdr_update_ws" ON public.sdr_config;
DROP POLICY IF EXISTS "sdr_delete_ws" ON public.sdr_config;
CREATE POLICY "sdr_select_ws" ON public.sdr_config FOR SELECT TO authenticated
  USING (company_id = get_user_company_id() AND workspace_id = get_active_workspace_id());
CREATE POLICY "sdr_insert_ws" ON public.sdr_config FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND is_admin_or_owner(auth.uid()) AND workspace_id = get_active_workspace_id());
CREATE POLICY "sdr_update_ws" ON public.sdr_config FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND is_admin_or_owner(auth.uid()) AND workspace_id = get_active_workspace_id())
  WITH CHECK (company_id = get_user_company_id() AND is_admin_or_owner(auth.uid()) AND workspace_id = get_active_workspace_id());
CREATE POLICY "sdr_delete_ws" ON public.sdr_config FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND is_admin_or_owner(auth.uid()) AND workspace_id = get_active_workspace_id());

-- Auto-fill workspace_id from active workspace on INSERT when omitted
CREATE OR REPLACE FUNCTION public.set_workspace_from_active()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    NEW.workspace_id := public.get_active_workspace_id();
  END IF;
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_user_company_id();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_ws_agents ON public.agents;
CREATE TRIGGER trg_set_ws_agents BEFORE INSERT ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_active();

DROP TRIGGER IF EXISTS trg_set_ws_products ON public.products;
CREATE TRIGGER trg_set_ws_products BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_active();

DROP TRIGGER IF EXISTS trg_set_ws_automations ON public.automations;
CREATE TRIGGER trg_set_ws_automations BEFORE INSERT ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_active();

DROP TRIGGER IF EXISTS trg_set_ws_flows ON public.flows;
CREATE TRIGGER trg_set_ws_flows BEFORE INSERT ON public.flows
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_active();

DROP TRIGGER IF EXISTS trg_set_ws_sdr ON public.sdr_config;
CREATE TRIGGER trg_set_ws_sdr BEFORE INSERT ON public.sdr_config
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_active();
