-- Auto-fill workspace_id on leads/messages when omitted (edge functions use service_role and don't run the DEFAULT reliably in all clients)
CREATE OR REPLACE FUNCTION public.fill_lead_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    IF NEW.agent_id IS NOT NULL THEN
      SELECT workspace_id INTO NEW.workspace_id FROM public.agents WHERE id = NEW.agent_id;
    END IF;
    IF NEW.workspace_id IS NULL THEN
      SELECT id INTO NEW.workspace_id FROM public.workspaces
        WHERE company_id = NEW.company_id ORDER BY created_at ASC LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fill_lead_workspace ON public.leads;
CREATE TRIGGER trg_fill_lead_workspace BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.fill_lead_workspace();

CREATE OR REPLACE FUNCTION public.fill_message_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.lead_id IS NOT NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.leads WHERE id = NEW.lead_id;
  END IF;
  IF NEW.workspace_id IS NULL THEN
    SELECT id INTO NEW.workspace_id FROM public.workspaces
      WHERE company_id = NEW.company_id ORDER BY created_at ASC LIMIT 1;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fill_message_workspace ON public.messages;
CREATE TRIGGER trg_fill_message_workspace BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.fill_message_workspace();