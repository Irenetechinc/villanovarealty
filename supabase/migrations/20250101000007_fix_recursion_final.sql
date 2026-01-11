-- 1. Enable RLS on users (safety)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 2. Drop ALL existing policies to ensure a clean slate and remove recursion
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Admins manage all properties" ON properties;
DROP POLICY IF EXISTS "Admins view inquiries" ON inquiries;

-- 3. Create NON-RECURSIVE policies for Users using JWT metadata
-- This bypasses the need to query the users table to check for admin status
CREATE POLICY "Admins can view all users" ON users
    FOR SELECT
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
        OR
        auth.uid() = id
    );

CREATE POLICY "Admins can update users" ON users
    FOR UPDATE
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
        OR
        auth.uid() = id
    );

-- 4. Create NON-RECURSIVE policies for Properties
CREATE POLICY "Admins manage all properties" ON properties
    FOR ALL
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
        OR
        agent_id = auth.uid()
    );

-- 5. Create NON-RECURSIVE policies for Inquiries
CREATE POLICY "Admins view inquiries" ON inquiries
    FOR ALL
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
        OR
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'agent'
    );
