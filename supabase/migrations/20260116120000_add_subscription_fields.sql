-- Add subscription fields to wallets table
ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 25,
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free', -- 'free', 'pro_monthly', 'pro_yearly'
ADD COLUMN IF NOT EXISTS subscription_cycle_start TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS subscription_cycle_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 month'),
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT TRUE;

-- Create table for tracking credit usage logs
CREATE TABLE IF NOT EXISTS credit_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- Negative for deduction, positive for refill
    action_type TEXT NOT NULL, -- 'generation', 'optimization', 'refill', 'bonus'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_credit_logs_wallet ON credit_usage_logs(wallet_id);

-- Function to handle credit deduction safely
CREATE OR REPLACE FUNCTION deduct_credits(
    p_wallet_id UUID,
    p_amount INTEGER,
    p_description TEXT
) RETURNS JSONB AS $$
DECLARE
    v_current_credits INTEGER;
    v_new_credits INTEGER;
BEGIN
    -- Lock row for update
    SELECT credits INTO v_current_credits FROM wallets WHERE id = p_wallet_id FOR UPDATE;
    
    IF v_current_credits < p_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient credits');
    END IF;

    v_new_credits := v_current_credits - p_amount;

    -- Update wallet
    UPDATE wallets SET credits = v_new_credits WHERE id = p_wallet_id;

    -- Log usage
    INSERT INTO credit_usage_logs (wallet_id, amount, action_type, description)
    VALUES (p_wallet_id, -p_amount, 'usage', p_description);

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_credits);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
