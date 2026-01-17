
-- Create notifications table
CREATE TABLE IF NOT EXISTS adroom_notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'lead', 'inspection', 'system'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE adroom_notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view their own notifications"
    ON adroom_notifications FOR SELECT
    USING (auth.uid() = admin_id);

CREATE POLICY "Admins can update their own notifications"
    ON adroom_notifications FOR UPDATE
    USING (auth.uid() = admin_id);

-- Create reports table if not exists (for historical data)
CREATE TABLE IF NOT EXISTS adroom_report_snapshots (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID NOT NULL,
    snapshot_date DATE DEFAULT CURRENT_DATE,
    metrics JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE adroom_report_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view their own report snapshots"
    ON adroom_report_snapshots FOR SELECT
    USING (auth.uid() = admin_id);
