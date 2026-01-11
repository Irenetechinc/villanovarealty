-- Create saved_properties table
CREATE TABLE IF NOT EXISTS saved_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, property_id)
);

-- Enable RLS
ALTER TABLE saved_properties ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view own saved properties" ON saved_properties;
CREATE POLICY "Users can view own saved properties" ON saved_properties
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can save properties" ON saved_properties;
CREATE POLICY "Users can save properties" ON saved_properties
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unsave properties" ON saved_properties;
CREATE POLICY "Users can unsave properties" ON saved_properties
    FOR DELETE
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_properties_user ON saved_properties(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_properties_property ON saved_properties(property_id);
