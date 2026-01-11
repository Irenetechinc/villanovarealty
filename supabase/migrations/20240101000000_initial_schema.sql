-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'seeker' CHECK (role IN ('seeker', 'agent', 'admin')),
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Properties Table
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('house', 'apartment', 'condo', 'townhouse', 'commercial')),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'sold', 'pending', 'withdrawn')),
    address JSONB NOT NULL,
    specifications JSONB NOT NULL,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_agent ON properties(agent_id);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(type);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);

-- Property Images Table
CREATE TABLE IF NOT EXISTS property_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    sort_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_images_property ON property_images(property_id);
CREATE INDEX IF NOT EXISTS idx_images_primary ON property_images(is_primary);

-- View History Table
CREATE TABLE IF NOT EXISTS view_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_view_history_user ON view_history(user_id);
CREATE INDEX IF NOT EXISTS idx_view_history_property ON view_history(property_id);
CREATE INDEX IF NOT EXISTS idx_view_history_date ON view_history(viewed_at);

-- Security Implementation
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Allow all users to view active properties
DROP POLICY IF EXISTS "View active properties" ON properties;
CREATE POLICY "View active properties" ON properties
    FOR SELECT
    USING (status = 'available');

-- Allow agents to manage their own properties
DROP POLICY IF EXISTS "Agents manage own properties" ON properties;
CREATE POLICY "Agents manage own properties" ON properties
    FOR ALL
    USING (agent_id = auth.uid());

-- Allow admins to manage all properties
-- Note: This requires auth.uid() to be linked to users table which might need a trigger or careful management.
-- For now, we assume simple RLS.
DROP POLICY IF EXISTS "Admins manage all properties" ON properties;
CREATE POLICY "Admins manage all properties" ON properties
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- Permissions
GRANT SELECT ON properties TO anon;
GRANT SELECT ON property_images TO anon;
GRANT SELECT ON users TO anon;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;
