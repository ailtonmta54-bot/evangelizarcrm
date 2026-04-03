
-- Create enum for lead status
CREATE TYPE public.lead_status AS ENUM ('novo', 'atendimento', 'proposta', 'fechado');

-- Create enum for message type
CREATE TYPE public.message_type AS ENUM ('enviada', 'recebida');

-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Minha Empresa',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  status lead_status NOT NULL DEFAULT 'novo',
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type message_type NOT NULL DEFAULT 'enviada',
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  external_link TEXT DEFAULT '',
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create automations table
CREATE TABLE public.automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'novo_lead',
  message TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

-- Create sdr_config table (one per company)
CREATE TABLE public.sdr_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT 'amigavel',
  goal TEXT NOT NULL DEFAULT 'qualificar',
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.sdr_config ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's company_id (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_automations_updated_at BEFORE UPDATE ON public.automations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sdr_config_updated_at BEFORE UPDATE ON public.sdr_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create company and profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_company_id UUID;
BEGIN
  -- Create a company for the new user
  INSERT INTO public.companies (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', 'Minha Empresa') || ' - Empresa')
  RETURNING id INTO new_company_id;

  -- Create profile linked to the company
  INSERT INTO public.profiles (user_id, full_name, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    new_company_id
  );

  -- Create default SDR config for the company
  INSERT INTO public.sdr_config (company_id, prompt, tone, goal)
  VALUES (
    new_company_id,
    'Você é um assistente de vendas. Seja cordial e objetivo.',
    'amigavel',
    'qualificar'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS POLICIES

-- Companies: users can only see their own company
CREATE POLICY "Users can view their own company" ON public.companies
  FOR SELECT USING (id = public.get_user_company_id());

CREATE POLICY "Users can update their own company" ON public.companies
  FOR UPDATE USING (id = public.get_user_company_id());

-- Profiles: users can see/update their own profile
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

-- Leads: scoped by company
CREATE POLICY "Users can view company leads" ON public.leads
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can create company leads" ON public.leads
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update company leads" ON public.leads
  FOR UPDATE USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can delete company leads" ON public.leads
  FOR DELETE USING (company_id = public.get_user_company_id());

-- Messages: scoped by company
CREATE POLICY "Users can view company messages" ON public.messages
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can create company messages" ON public.messages
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id());

-- Products: scoped by company
CREATE POLICY "Users can view company products" ON public.products
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can create company products" ON public.products
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update company products" ON public.products
  FOR UPDATE USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can delete company products" ON public.products
  FOR DELETE USING (company_id = public.get_user_company_id());

-- Automations: scoped by company
CREATE POLICY "Users can view company automations" ON public.automations
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can create company automations" ON public.automations
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update company automations" ON public.automations
  FOR UPDATE USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can delete company automations" ON public.automations
  FOR DELETE USING (company_id = public.get_user_company_id());

-- SDR Config: scoped by company
CREATE POLICY "Users can view company sdr config" ON public.sdr_config
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can update company sdr config" ON public.sdr_config
  FOR UPDATE USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can create company sdr config" ON public.sdr_config
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id());
