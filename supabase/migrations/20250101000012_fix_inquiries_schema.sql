-- Add missing columns to inquiries table if they don't exist
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS subject VARCHAR(255);
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'unread';
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS reply_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS admin_reply TEXT;

-- Add constraint for status if it doesn't exist (drop first to be safe/update it)
ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_status_check;
ALTER TABLE inquiries ADD CONSTRAINT inquiries_status_check 
    CHECK (status IN ('new', 'read', 'responded', 'archived', 'unread'));

-- Add constraint for reply_status
ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_reply_status_check;
ALTER TABLE inquiries ADD CONSTRAINT inquiries_reply_status_check 
    CHECK (reply_status IN ('pending', 'replied'));

-- Update RLS policies to ensure fields are writable
DROP POLICY IF EXISTS "Enable insert for everyone" ON inquiries;
CREATE POLICY "Enable insert for everyone" ON inquiries
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Ensure public/anon can insert into these new columns
GRANT INSERT (subject, user_agent, status, reply_status, replied_at, admin_reply) ON inquiries TO anon, authenticated;
GRANT SELECT (subject, user_agent, status, reply_status, replied_at, admin_reply) ON inquiries TO anon, authenticated;
