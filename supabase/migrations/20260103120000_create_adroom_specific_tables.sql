-- AdRoom Specific Tables

-- 1. adroom_settings
CREATE TABLE IF NOT EXISTS adroom_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    facebook_page_id TEXT,
    facebook_access_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. adroom_strategies
CREATE TABLE IF NOT EXISTS adroom_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('paid', 'free')),
    content JSONB,
    expected_outcome TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. adroom_posts
CREATE TABLE IF NOT EXISTS adroom_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID REFERENCES adroom_strategies(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    image_url TEXT,
    scheduled_time TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'failed')),
    facebook_post_id TEXT,
    metrics JSONB DEFAULT '{}'::jsonb,
    posted_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. adroom_reports
CREATE TABLE IF NOT EXISTS adroom_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT,
    content JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE adroom_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE adroom_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE adroom_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE adroom_reports ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own settings
CREATE POLICY "Users can manage their own settings" ON adroom_settings
    FOR ALL USING (auth.uid() = admin_id);

-- Allow users to manage their own strategies
CREATE POLICY "Users can manage their own strategies" ON adroom_strategies
    FOR ALL USING (auth.uid() = admin_id);

-- Allow users to manage their own posts via strategies
CREATE POLICY "Users can manage their own posts" ON adroom_posts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM adroom_strategies s
            WHERE s.id = adroom_posts.strategy_id
            AND s.admin_id = auth.uid()
        )
    );

-- Allow users to view their own reports
CREATE POLICY "Users can view their own reports" ON adroom_reports
    FOR SELECT USING (auth.uid() = admin_id);

-- Grant access to service role (for cron jobs)
GRANT ALL ON adroom_settings TO service_role;
GRANT ALL ON adroom_strategies TO service_role;
GRANT ALL ON adroom_posts TO service_role;
GRANT ALL ON adroom_reports TO service_role;
