-- Add status and avatar columns
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'desativado' CHECK (status IN ('producao', 'teste', 'desativado'));

-- Create storage bucket for agent avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-avatars', 'agent-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload avatars
CREATE POLICY "Authenticated users can upload agent avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'agent-avatars');

-- Allow public read access
CREATE POLICY "Public can view agent avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'agent-avatars');

-- Allow authenticated users to update their avatars
CREATE POLICY "Authenticated users can update agent avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'agent-avatars');

-- Allow authenticated users to delete their avatars
CREATE POLICY "Authenticated users can delete agent avatars"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'agent-avatars');