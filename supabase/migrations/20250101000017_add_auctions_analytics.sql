-- 1. Create Auction Tables
CREATE TABLE IF NOT EXISTS auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    starting_bid DECIMAL(15, 2) NOT NULL,
    current_bid DECIMAL(15, 2) NOT NULL,
    min_increment DECIMAL(15, 2) DEFAULT 1000.00,
    status TEXT DEFAULT 'pending', -- pending, active, completed, cancelled
    winner_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Analytics Table
CREATE TABLE IF NOT EXISTS visitor_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path TEXT NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    user_id UUID REFERENCES users(id), -- Nullable for anonymous
    property_id UUID REFERENCES properties(id), -- Nullable
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_analytics ENABLE ROW LEVEL SECURITY;

-- 4. Policies

-- Auctions: Public can view, Admins can manage
CREATE POLICY "Public can view auctions" ON auctions FOR SELECT USING (true);
CREATE POLICY "Admins can manage auctions" ON auctions FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin');

-- Bids: Public can view, Users can insert (if authenticated)
CREATE POLICY "Public can view bids" ON bids FOR SELECT USING (true);
CREATE POLICY "Users can place bids" ON bids FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Analytics: Admins can view all, System inserts (via Edge Function or client)
CREATE POLICY "Admins can view analytics" ON visitor_analytics FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin');
CREATE POLICY "System can insert analytics" ON visitor_analytics FOR INSERT WITH CHECK (true); -- Ideally restricted to service role, but for client-side tracking 'true' is needed or use a function

-- 5. Seed Auctions (Realistic Data)
INSERT INTO auctions (property_id, title, start_time, end_time, starting_bid, current_bid, status)
SELECT 
    id, 
    'Exclusive Auction: ' || title,
    NOW() + INTERVAL '1 day',
    NOW() + INTERVAL '3 days',
    price * 0.8, -- Starting at 80% of price
    price * 0.8,
    'pending'
FROM properties
LIMIT 2;

-- Active Auction
INSERT INTO auctions (property_id, title, start_time, end_time, starting_bid, current_bid, status)
SELECT 
    id, 
    'Live Auction: ' || title,
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '23 hours',
    price * 0.9, 
    price * 0.95,
    'active'
FROM properties
OFFSET 2
LIMIT 1;
