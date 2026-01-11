-- Create project-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to project images
DROP POLICY IF EXISTS "Public Access Project Images" ON storage.objects;
CREATE POLICY "Public Access Project Images" ON storage.objects
  FOR SELECT
  USING ( bucket_id = 'project-images' );

-- Allow authenticated users (admins) to upload images
DROP POLICY IF EXISTS "Auth Upload Project Images" ON storage.objects;
CREATE POLICY "Auth Upload Project Images" ON storage.objects
  FOR INSERT
  WITH CHECK ( bucket_id = 'project-images' AND auth.role() = 'authenticated' );

-- Allow authenticated users (admins) to update images
DROP POLICY IF EXISTS "Auth Update Project Images" ON storage.objects;
CREATE POLICY "Auth Update Project Images" ON storage.objects
  FOR UPDATE
  USING ( bucket_id = 'project-images' AND auth.role() = 'authenticated' );

-- Allow authenticated users (admins) to delete images
DROP POLICY IF EXISTS "Auth Delete Project Images" ON storage.objects;
CREATE POLICY "Auth Delete Project Images" ON storage.objects
  FOR DELETE
  USING ( bucket_id = 'project-images' AND auth.role() = 'authenticated' );
