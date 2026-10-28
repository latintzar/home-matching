-- Migration: 071_billing_tables.sql
-- Purpose: Add columns for Stripe billing integration

-- Add Stripe customer ID
ALTER TABLE user_lifestyle_profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add subscription status tracking
-- Values: 'none', 'active', 'paused', 'canceled', 'past_due'
ALTER TABLE user_lifestyle_profiles
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none';

-- Track when subscription was paused
ALTER TABLE user_lifestyle_profiles
ADD COLUMN IF NOT EXISTS subscription_paused_at TIMESTAMPTZ;

-- Track Stripe subscription ID
ALTER TABLE user_lifestyle_profiles
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Track current plan/price ID
ALTER TABLE user_lifestyle_profiles
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- Index for quick Stripe customer lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer 
ON user_lifestyle_profiles(stripe_customer_id);

-- Comments for documentation
COMMENT ON COLUMN user_lifestyle_profiles.stripe_customer_id IS 'Stripe customer ID';
COMMENT ON COLUMN user_lifestyle_profiles.subscription_status IS 'Subscription status: none|active|paused|canceled|past_due';
COMMENT ON COLUMN user_lifestyle_profiles.subscription_paused_at IS 'Timestamp when subscription was paused';
COMMENT ON COLUMN user_lifestyle_profiles.stripe_subscription_id IS 'Stripe subscription ID';
COMMENT ON COLUMN user_lifestyle_profiles.stripe_price_id IS 'Stripe price ID for current plan';

