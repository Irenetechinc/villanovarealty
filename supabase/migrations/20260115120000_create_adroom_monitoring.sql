-- AdRoom Monitoring & Compliance Tables

-- 1. adroom_strategy_logs (Audit Trail)
CREATE TABLE IF NOT EXISTS adroom_strategy_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID REFERENCES adroom_strategies(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT CHECK (event_type IN ('check', 'fix', 'alert', 'update')),
    message TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. adroom_strategy_alerts (Active Alerts)
CREATE TABLE IF NOT EXISTS adroom_strategy_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID REFERENCES adroom_strategies(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    severity TEXT CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'ignored')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- RLS Policies
ALTER TABLE adroom_strategy_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE adroom_strategy_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own logs" ON adroom_strategy_logs
    FOR SELECT USING (auth.uid() = admin_id);

CREATE POLICY "Users can manage their own alerts" ON adroom_strategy_alerts
    FOR ALL USING (auth.uid() = admin_id);

GRANT ALL ON adroom_strategy_logs TO service_role;
GRANT ALL ON adroom_strategy_alerts TO service_role;
