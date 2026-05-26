
-- 1. Restrict agents UPDATE to admins
DROP POLICY IF EXISTS "Users can update company agents" ON public.agents;
CREATE POLICY "Admins can update company agents"
ON public.agents FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'));

-- 2. Restrict companies UPDATE to admins
DROP POLICY IF EXISTS "Users can update their own company" ON public.companies;
CREATE POLICY "Admins can update their own company"
ON public.companies FOR UPDATE TO authenticated
USING (id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'));

-- 3. Fix storage policies on agent-avatars to compare path to agent id correctly
DROP POLICY IF EXISTS "Agent avatars: company members can read" ON storage.objects;
DROP POLICY IF EXISTS "Agent avatars: company members can insert" ON storage.objects;
DROP POLICY IF EXISTS "Agent avatars: company members can update" ON storage.objects;
DROP POLICY IF EXISTS "Agent avatars: company members can delete" ON storage.objects;

CREATE POLICY "Agent avatars: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'agent-avatars');

CREATE POLICY "Agent avatars: company members can insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'agent-avatars'
  AND EXISTS (
    SELECT 1 FROM public.agents
    WHERE (agents.id)::text = (storage.foldername(storage.objects.name))[1]
      AND agents.company_id = public.get_user_company_id()
  )
);

CREATE POLICY "Agent avatars: company members can update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'agent-avatars'
  AND EXISTS (
    SELECT 1 FROM public.agents
    WHERE (agents.id)::text = (storage.foldername(storage.objects.name))[1]
      AND agents.company_id = public.get_user_company_id()
  )
);

CREATE POLICY "Agent avatars: company members can delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'agent-avatars'
  AND EXISTS (
    SELECT 1 FROM public.agents
    WHERE (agents.id)::text = (storage.foldername(storage.objects.name))[1]
      AND agents.company_id = public.get_user_company_id()
  )
);

-- 4. Add admin-scoped DELETE policy on sdr_config
CREATE POLICY "Admins can delete company sdr config"
ON public.sdr_config FOR DELETE TO authenticated
USING (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'));
