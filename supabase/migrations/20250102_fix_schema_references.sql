
-- Drop tables in dependency order
DROP TABLE IF EXISTS public.transactions;
DROP TABLE IF EXISTS public.posts;
DROP TABLE IF EXISTS public.campaigns;
DROP TABLE IF EXISTS public.gemini_usage;
DROP TABLE IF EXISTS public.wallets;
-- Optional: Drop admins table if it's not needed (since we use auth.users)
-- DROP TABLE IF EXISTS public.admins; 

-- Recreate tables with correct references to auth.users

-- Create wallets table
CREATE TABLE public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    balance DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'NGN',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT wallets_admin_id_key UNIQUE (admin_id)
);

-- Create transactions table
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE,
    type VARCHAR(50) CHECK (type IN ('deposit', 'ad_spend', 'gemini_usage')),
    amount DECIMAL(10,2) NOT NULL,
    fee DECIMAL(10,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'pending',
    flutterwave_ref VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create campaigns table
CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    strategy TEXT NOT NULL,
    budget DECIMAL(10,2) NOT NULL,
    duration_days INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'completed')),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create posts table
CREATE TABLE public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    platform_post_id VARCHAR(100),
    content TEXT NOT NULL,
    media_urls JSONB,
    post_type VARCHAR(20) CHECK (post_type IN ('organic', 'sponsored')),
    scheduled_time TIMESTAMP WITH TIME ZONE,
    posted_time TIMESTAMP WITH TIME ZONE,
    metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create gemini_usage table
CREATE TABLE public.gemini_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    request_type VARCHAR(50) NOT NULL,
    tokens_used INTEGER NOT NULL,
    cost DECIMAL(10,4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gemini_usage ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    -- Wallets
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'wallets' AND policyname = 'Users can view own wallet') THEN
        CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = admin_id);
    END IF;

    -- Transactions
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Users can view own transactions') THEN
        CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (wallet_id IN (SELECT id FROM public.wallets WHERE admin_id = auth.uid()));
    END IF;

    -- Campaigns
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'campaigns' AND policyname = 'Users can view own campaigns') THEN
        CREATE POLICY "Users can view own campaigns" ON public.campaigns FOR SELECT USING (auth.uid() = admin_id);
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'campaigns' AND policyname = 'Users can insert own campaigns') THEN
        CREATE POLICY "Users can insert own campaigns" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() = admin_id);
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'campaigns' AND policyname = 'Users can update own campaigns') THEN
        CREATE POLICY "Users can update own campaigns" ON public.campaigns FOR UPDATE USING (auth.uid() = admin_id);
    END IF;

    -- Gemini Usage
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'gemini_usage' AND policyname = 'Users can view own usage') THEN
        CREATE POLICY "Users can view own usage" ON public.gemini_usage FOR SELECT USING (auth.uid() = admin_id);
    END IF;
END $$;
