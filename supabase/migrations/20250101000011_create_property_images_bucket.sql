-- Create property-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to property images
DROP POLICY IF EXISTS "Public Access Property Images" ON storage.objects;
CREATE POLICY "Public Access Property Images" ON storage.objects
  FOR SELECT
  USING ( bucket_id = 'property-images' );

-- Allow authenticated users (admins/agents) to upload images
DROP POLICY IF EXISTS "Auth Upload Property Images" ON storage.objects;
CREATE POLICY "Auth Upload Property Images" ON storage.objects
  FOR INSERT
  WITH CHECK ( bucket_id = 'property-images' AND auth.role() = 'authenticated' );

-- Allow authenticated users to update images
DROP POLICY IF EXISTS "Auth Update Property Images" ON storage.objects;
CREATE POLICY "Auth Update Property Images" ON storage.objects
  FOR UPDATE
  USING ( bucket_id = 'property-images' AND auth.role() = 'authenticated' );

-- Allow authenticated users to delete images
DROP POLICY IF EXISTS "Auth Delete Property Images" ON storage.objects;
CREATE POLICY "Auth Delete Property Images" ON storage.objects
  FOR DELETE
  USING ( bucket_id = 'property-images' AND auth.role() = 'authenticated' );

-- Enable RLS on property_images table (it was created in initial schema but RLS might not be fully set)
ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;

-- Allow public read access to property_images table
DROP POLICY IF EXISTS "Public read property images" ON property_images;
CREATE POLICY "Public read property images" ON property_images
    FOR SELECT
    USING (true);

-- Allow authenticated users to insert/update/delete property_images
DROP POLICY IF EXISTS "Auth manage property images" ON property_images;
CREATE POLICY "Auth manage property images" ON property_images
    FOR ALL
    USING (auth.role() = 'authenticated');
