-- Drop potential conflicting check constraint
ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_status_check;

-- Ensure status column accepts 'unread'
ALTER TABLE inquiries ADD CONSTRAINT inquiries_status_check 
CHECK (status IN ('new', 'read', 'responded', 'archived', 'unread'));

-- Enable RLS
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on inquiries to ensure a clean slate
DROP POLICY IF EXISTS "Allow anonymous inserts" ON inquiries;
DROP POLICY IF EXISTS "Admins can view all inquiries" ON inquiries;
DROP POLICY IF EXISTS "Admins can update inquiries" ON inquiries;
DROP POLICY IF EXISTS "Enable insert for everyone" ON inquiries;
DROP POLICY IF EXISTS "Enable full access for admins" ON inquiries;

-- Create a permissive INSERT policy for everyone (anon + authenticated)
CREATE POLICY "Enable insert for everyone" ON inquiries
FOR INSERT
TO public
WITH CHECK (true);

-- Create a policy for Admins to do everything (SELECT, UPDATE, DELETE)
CREATE POLICY "Enable full access for admins" ON inquiries
FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Explicitly grant permissions to anon and authenticated roles
GRANT INSERT ON inquiries TO anon, authenticated;
GRANT SELECT ON inquiries TO anon, authenticated;
