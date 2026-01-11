-- Create agent-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-images', 'agent-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to agent images
DROP POLICY IF EXISTS "Public Access Agent Images" ON storage.objects;
CREATE POLICY "Public Access Agent Images" ON storage.objects
  FOR SELECT
  USING ( bucket_id = 'agent-images' );

-- Allow authenticated users (admins) to upload images
DROP POLICY IF EXISTS "Auth Upload Agent Images" ON storage.objects;
CREATE POLICY "Auth Upload Agent Images" ON storage.objects
  FOR INSERT
  WITH CHECK ( bucket_id = 'agent-images' AND auth.role() = 'authenticated' );

-- Allow authenticated users (admins) to update images
DROP POLICY IF EXISTS "Auth Update Agent Images" ON storage.objects;
CREATE POLICY "Auth Update Agent Images" ON storage.objects
  FOR UPDATE
  USING ( bucket_id = 'agent-images' AND auth.role() = 'authenticated' );

-- Allow authenticated users (admins) to delete images
DROP POLICY IF EXISTS "Auth Delete Agent Images" ON storage.objects;
CREATE POLICY "Auth Delete Agent Images" ON storage.objects
  FOR DELETE
  USING ( bucket_id = 'agent-images' AND auth.role() = 'authenticated' );
