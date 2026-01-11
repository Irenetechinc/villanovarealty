-- 1. Enable RLS on users to be safe (idempotent)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 2. Drop potential recursive/broken policies on users
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;

-- 3. Create non-recursive policies using JWT metadata for Users
-- This is much faster and safer than querying the table
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

-- 4. Update Properties policies to use JWT metadata
DROP POLICY IF EXISTS "Admins manage all properties" ON properties;
CREATE POLICY "Admins manage all properties" ON properties
    FOR ALL
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
        OR
        agent_id = auth.uid()
    );

-- 5. Update Inquiries policies to use JWT metadata
DROP POLICY IF EXISTS "Admins view inquiries" ON inquiries;
CREATE POLICY "Admins view inquiries" ON inquiries
    FOR ALL
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
        OR
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'agent'
    );
