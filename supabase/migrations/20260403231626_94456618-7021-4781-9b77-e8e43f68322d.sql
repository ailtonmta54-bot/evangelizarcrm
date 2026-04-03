
-- Create agent_type enum
CREATE TYPE public.agent_type AS ENUM ('vendas', 'atendimento', 'suporte', 'qualificacao', 'agendamento', 'custom');

-- Create agents table
CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  agent_type agent_type NOT NULL DEFAULT 'vendas',
  prompt text NOT NULL DEFAULT '',
  tone text NOT NULL DEFAULT 'amigavel',
  goal text NOT NULL DEFAULT 'qualificar',
  temperature numeric NOT NULL DEFAULT 0.7,
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  knowledge text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view company agents"
  ON public.agents FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create company agents"
  ON public.agents FOR INSERT
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update company agents"
  ON public.agents FOR UPDATE
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can delete company agents"
  ON public.agents FOR DELETE
  USING (company_id = get_user_company_id());

-- Add agent_id to leads so each lead can be assigned to an agent
ALTER TABLE public.leads ADD COLUMN agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL;

-- Updated_at trigger for agents
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
