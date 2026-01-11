-- Create contact_info table
CREATE TABLE IF NOT EXISTS contact_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT,
  phone TEXT,
  email_info TEXT,
  email_sales TEXT,
  business_hours_weekdays TEXT,
  business_hours_saturday TEXT,
  business_hours_sunday TEXT,
  whatsapp_number TEXT,
  facebook_link TEXT,
  twitter_link TEXT,
  instagram_link TEXT,
  linkedin_link TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default row if not exists
INSERT INTO contact_info (
  address, phone, email_info, email_sales, 
  business_hours_weekdays, business_hours_saturday, business_hours_sunday, 
  whatsapp_number, facebook_link, twitter_link, instagram_link, linkedin_link
)
SELECT 
  '123 Luxury Lane, Victoria Island, Lagos, Nigeria',
  '+234 (0) 123 456 7890',
  'info@villanovarealty.com',
  'sales@villanovarealty.com',
  '9:00 AM - 6:00 PM',
  '10:00 AM - 4:00 PM',
  'Closed',
  '2341234567890',
  '#', '#', '#', '#'
WHERE NOT EXISTS (SELECT 1 FROM contact_info);

-- Enable RLS
ALTER TABLE contact_info ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Public can read contact info" ON contact_info;
CREATE POLICY "Public can read contact info" ON contact_info
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update contact info" ON contact_info;
CREATE POLICY "Admins can update contact info" ON contact_info
  FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin'
  );

DROP POLICY IF EXISTS "Admins can insert contact info" ON contact_info;
CREATE POLICY "Admins can insert contact info" ON contact_info
  FOR INSERT WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin'
  );
