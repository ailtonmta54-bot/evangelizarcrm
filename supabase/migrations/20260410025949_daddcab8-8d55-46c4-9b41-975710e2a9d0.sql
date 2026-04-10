-- Create agent_products junction table
CREATE TABLE public.agent_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agent_id, product_id)
);

ALTER TABLE public.agent_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agent products of their company"
ON public.agent_products FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.agents WHERE agents.id = agent_products.agent_id AND agents.company_id = get_user_company_id()
));

CREATE POLICY "Users can create agent products for their company"
ON public.agent_products FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.agents WHERE agents.id = agent_products.agent_id AND agents.company_id = get_user_company_id()
));

CREATE POLICY "Users can delete agent products of their company"
ON public.agent_products FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.agents WHERE agents.id = agent_products.agent_id AND agents.company_id = get_user_company_id()
));

-- Add new lead statuses
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'qualificado';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'negociacao';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'perdido';
