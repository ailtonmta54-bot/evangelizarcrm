
-- Flows table
CREATE TABLE public.flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT false,
  trigger_type TEXT NOT NULL DEFAULT 'keyword',
  trigger_value TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Flow nodes table
CREATE TABLE public.flow_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL DEFAULT 'message',
  label TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}',
  position_x NUMERIC NOT NULL DEFAULT 0,
  position_y NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Flow edges table
CREATE TABLE public.flow_edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES public.flow_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES public.flow_nodes(id) ON DELETE CASCADE,
  source_handle TEXT DEFAULT '',
  label TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_edges ENABLE ROW LEVEL SECURITY;

-- Flows policies
CREATE POLICY "Users can view company flows" ON public.flows FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Users can create company flows" ON public.flows FOR INSERT WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "Users can update company flows" ON public.flows FOR UPDATE USING (company_id = get_user_company_id());
CREATE POLICY "Users can delete company flows" ON public.flows FOR DELETE USING (company_id = get_user_company_id());

-- Flow nodes policies (via flow's company_id)
CREATE POLICY "Users can view flow nodes" ON public.flow_nodes FOR SELECT USING (EXISTS (SELECT 1 FROM public.flows WHERE flows.id = flow_nodes.flow_id AND flows.company_id = get_user_company_id()));
CREATE POLICY "Users can create flow nodes" ON public.flow_nodes FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.flows WHERE flows.id = flow_nodes.flow_id AND flows.company_id = get_user_company_id()));
CREATE POLICY "Users can update flow nodes" ON public.flow_nodes FOR UPDATE USING (EXISTS (SELECT 1 FROM public.flows WHERE flows.id = flow_nodes.flow_id AND flows.company_id = get_user_company_id()));
CREATE POLICY "Users can delete flow nodes" ON public.flow_nodes FOR DELETE USING (EXISTS (SELECT 1 FROM public.flows WHERE flows.id = flow_nodes.flow_id AND flows.company_id = get_user_company_id()));

-- Flow edges policies (via flow's company_id)
CREATE POLICY "Users can view flow edges" ON public.flow_edges FOR SELECT USING (EXISTS (SELECT 1 FROM public.flows WHERE flows.id = flow_edges.flow_id AND flows.company_id = get_user_company_id()));
CREATE POLICY "Users can create flow edges" ON public.flow_edges FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.flows WHERE flows.id = flow_edges.flow_id AND flows.company_id = get_user_company_id()));
CREATE POLICY "Users can update flow edges" ON public.flow_edges FOR UPDATE USING (EXISTS (SELECT 1 FROM public.flows WHERE flows.id = flow_edges.flow_id AND flows.company_id = get_user_company_id()));
CREATE POLICY "Users can delete flow edges" ON public.flow_edges FOR DELETE USING (EXISTS (SELECT 1 FROM public.flows WHERE flows.id = flow_edges.flow_id AND flows.company_id = get_user_company_id()));

-- Updated at trigger
CREATE TRIGGER update_flows_updated_at BEFORE UPDATE ON public.flows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
