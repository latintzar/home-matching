-- Migration: 066_subscriptions.sql
-- Purpose: Create subscriptions table for Stripe billing integration
-- Part of Phase 0: Foundation

-- Subscriptions table
-- Tracks user subscription status from Stripe
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User reference
  user_id UUID NOT NULL UNIQUE,  -- References auth.users
  
  -- Stripe references
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  
  -- Plan info
  plan_id TEXT NOT NULL DEFAULT 'free' CHECK (plan_id IN (
    'free',           -- Free tier (limited alerts)
    'personal',       -- Personal subscription (unlimited alerts)
    'pro_solo',       -- Pro solo (1 seat)
    'pro_team',       -- Pro team (multiple seats)
    'enterprise'      -- Enterprise (custom)
  )),
  
  -- Status (from Stripe)
  status TEXT DEFAULT 'active' CHECK (status IN (
    'active',
    'trialing',
    'past_due',
    'canceled',
    'unpaid',
    'incomplete',
    'paused'
  )),
  
  -- Billing dates
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  
  -- Trial info
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  
  -- Usage limits
  alert_count_this_period INTEGER DEFAULT 0,
  client_count INTEGER DEFAULT 0,  -- For pro plans
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own subscription
CREATE POLICY "Users can view own subscription"
  ON subscriptions
  FOR SELECT
  USING (user_id = auth.uid());

-- Only service role can insert/update (from webhooks)
-- No policy needed for INSERT/UPDATE - handled by service role key

-- Update trigger
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

-- Function to check if user has active subscription
CREATE OR REPLACE FUNCTION has_active_subscription(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = p_user_id
    AND status IN ('active', 'trialing')
    AND (current_period_end IS NULL OR current_period_end > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's plan features
CREATE OR REPLACE FUNCTION get_plan_features(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_plan TEXT;
  v_features JSONB;
BEGIN
  SELECT plan_id INTO v_plan
  FROM subscriptions
  WHERE user_id = p_user_id
  AND status IN ('active', 'trialing');
  
  IF v_plan IS NULL THEN
    v_plan := 'free';
  END IF;
  
  CASE v_plan
    WHEN 'free' THEN
      v_features := '{
        "alerts_per_month": 5,
        "saved_searches": 1,
        "whatsapp_alerts": false,
        "viewing_notes": true,
        "shortlist_limit": 10,
        "pro_features": false
      }'::JSONB;
    WHEN 'personal' THEN
      v_features := '{
        "alerts_per_month": -1,
        "saved_searches": 5,
        "whatsapp_alerts": true,
        "viewing_notes": true,
        "shortlist_limit": -1,
        "pro_features": false
      }'::JSONB;
    WHEN 'pro_solo' THEN
      v_features := '{
        "alerts_per_month": -1,
        "saved_searches": -1,
        "whatsapp_alerts": true,
        "viewing_notes": true,
        "shortlist_limit": -1,
        "pro_features": true,
        "client_limit": 20,
        "team_members": 1
      }'::JSONB;
    WHEN 'pro_team' THEN
      v_features := '{
        "alerts_per_month": -1,
        "saved_searches": -1,
        "whatsapp_alerts": true,
        "viewing_notes": true,
        "shortlist_limit": -1,
        "pro_features": true,
        "client_limit": -1,
        "team_members": 5
      }'::JSONB;
    ELSE
      v_features := '{
        "alerts_per_month": -1,
        "saved_searches": -1,
        "whatsapp_alerts": true,
        "viewing_notes": true,
        "shortlist_limit": -1,
        "pro_features": true,
        "client_limit": -1,
        "team_members": -1
      }'::JSONB;
  END CASE;
  
  RETURN v_features;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create free subscription for new users (trigger)
CREATE OR REPLACE FUNCTION create_free_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (user_id, plan_id, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This trigger should be created on auth.users but that requires
-- a separate migration or manual setup in Supabase dashboard
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION create_free_subscription();

COMMENT ON TABLE subscriptions IS 'User subscription status and Stripe billing info';
COMMENT ON FUNCTION has_active_subscription IS 'Check if user has an active paid subscription';
COMMENT ON FUNCTION get_plan_features IS 'Get feature limits for user plan';

