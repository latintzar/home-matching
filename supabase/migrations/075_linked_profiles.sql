-- Migration: 075_linked_profiles.sql
-- Purpose: Enable multi-profile architecture (one user can have both Renter and Buyer profiles)
-- Part of: Linked Profile Architecture (see P0_LEAN_APP.md)

-- ============================================
-- 1. Add profile_type to user_lifestyle_profiles
-- ============================================

-- Add profile_type column (defaults to 'renter' for existing profiles)
ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS profile_type TEXT DEFAULT 'renter' 
  CHECK (profile_type IN ('renter', 'buyer'));

-- CRITICAL: One profile per type per user
-- (user_id + profile_type) is the logical primary key for lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_profile_type 
  ON user_lifestyle_profiles(user_id, profile_type)
  WHERE user_id IS NOT NULL;

-- ============================================
-- 2. Track active profile at user level
-- ============================================

-- Add active_profile_type to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS active_profile_type TEXT DEFAULT 'renter'
  CHECK (active_profile_type IN ('renter', 'buyer'));

-- ============================================
-- 3. Add profile_type to saved_properties
-- ============================================

-- Saved properties are PER PROFILE, not per user
ALTER TABLE saved_properties
ADD COLUMN IF NOT EXISTS profile_type TEXT DEFAULT 'renter'
  CHECK (profile_type IN ('renter', 'buyer'));

-- Drop old unique CONSTRAINT (not index) and create new one including profile_type
ALTER TABLE saved_properties DROP CONSTRAINT IF EXISTS saved_properties_user_id_listing_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_properties_unique 
  ON saved_properties(user_id, listing_id, profile_type);

-- ============================================
-- 4. Add profile_type to property_notes
-- ============================================

ALTER TABLE property_notes
ADD COLUMN IF NOT EXISTS profile_type TEXT DEFAULT 'renter'
  CHECK (profile_type IN ('renter', 'buyer'));

-- ============================================
-- 5. Add profile_type to property_views
-- ============================================

ALTER TABLE property_views
ADD COLUMN IF NOT EXISTS profile_type TEXT DEFAULT 'renter'
  CHECK (profile_type IN ('renter', 'buyer'));

-- Update unique constraint to include profile_type
ALTER TABLE property_views DROP CONSTRAINT IF EXISTS property_views_user_id_listing_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_property_views_unique 
  ON property_views(user_id, listing_id, profile_type);

-- ============================================
-- 6. Pro-Client Linking (to existing Leo users)
-- ============================================

-- Add link to existing Leo user (optional)
-- If set, the pro can view the client's profile
ALTER TABLE pro_clients
ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES auth.users(id);

-- Link request status
ALTER TABLE pro_clients
ADD COLUMN IF NOT EXISTS link_status TEXT DEFAULT 'none'
  CHECK (link_status IN ('none', 'pending', 'approved', 'rejected'));

-- When link was requested/approved
ALTER TABLE pro_clients
ADD COLUMN IF NOT EXISTS link_requested_at TIMESTAMPTZ;

ALTER TABLE pro_clients
ADD COLUMN IF NOT EXISTS link_approved_at TIMESTAMPTZ;

-- Index for linked user lookups
CREATE INDEX IF NOT EXISTS idx_pro_clients_linked_user 
  ON pro_clients(linked_user_id)
  WHERE linked_user_id IS NOT NULL;

-- ============================================
-- 7. Link Requests Table (for pending link approvals)
-- ============================================

CREATE TABLE IF NOT EXISTS pro_link_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_client_id UUID NOT NULL REFERENCES pro_clients(id) ON DELETE CASCADE,
  pro_user_id UUID NOT NULL REFERENCES auth.users(id),
  client_user_id UUID NOT NULL REFERENCES auth.users(id),
  client_email TEXT NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pro_link_requests_client ON pro_link_requests(client_user_id);
CREATE INDEX IF NOT EXISTS idx_pro_link_requests_pro ON pro_link_requests(pro_user_id);
CREATE INDEX IF NOT EXISTS idx_pro_link_requests_status ON pro_link_requests(status);

-- Enable RLS
ALTER TABLE pro_link_requests ENABLE ROW LEVEL SECURITY;

-- Pros can see their own link requests
DO $$ BEGIN
  CREATE POLICY "Pros can view own link requests"
    ON pro_link_requests FOR SELECT
    USING (pro_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Clients can see link requests sent to them
DO $$ BEGIN
  CREATE POLICY "Clients can view link requests to them"
    ON pro_link_requests FOR SELECT
    USING (client_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Clients can update (approve/reject) requests sent to them
DO $$ BEGIN
  CREATE POLICY "Clients can update link requests to them"
    ON pro_link_requests FOR UPDATE
    USING (client_user_id = auth.uid())
    WITH CHECK (client_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Pros can insert link requests
DO $$ BEGIN
  CREATE POLICY "Pros can create link requests"
    ON pro_link_requests FOR INSERT
    WITH CHECK (pro_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 8. Move billing to user_profiles (user level)
-- ============================================

-- Billing is per USER, not per profile
-- One subscription unlocks ONE profile type

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_type TEXT 
  CHECK (subscription_type IN ('renter', 'buyer', 'pro'));

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none'
  CHECK (subscription_status IN ('none', 'active', 'paused', 'canceled', 'past_due', 'trialing'));

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

-- Index for Stripe lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe 
  ON user_profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ============================================
-- 9. Comments for documentation
-- ============================================

COMMENT ON COLUMN user_lifestyle_profiles.profile_type IS 
  'Profile type: renter or buyer. One user can have both.';

COMMENT ON COLUMN user_profiles.active_profile_type IS 
  'Which profile the user is currently viewing (renter or buyer)';

COMMENT ON COLUMN user_profiles.subscription_type IS 
  'Which profile type is unlocked by subscription (renter, buyer, or pro)';

COMMENT ON COLUMN pro_clients.linked_user_id IS 
  'If set, links to an existing Leo user. Pro can view their profile.';

COMMENT ON COLUMN pro_clients.link_status IS 
  'Status of the account linking: none, pending, approved, rejected';

COMMENT ON TABLE pro_link_requests IS 
  'Pending requests from pros to link with existing Leo users';

-- ============================================
-- 10. Helper function: Get user's active profile
-- ============================================

CREATE OR REPLACE FUNCTION get_active_profile(p_user_id UUID)
RETURNS TABLE (
  profile_id UUID,
  profile_type TEXT,
  intake_completed BOOLEAN,
  budget_max INTEGER,
  preferred_areas TEXT[],
  needs_summary TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ulp.id,
    ulp.profile_type,
    ulp.intake_completed,
    ulp.budget_max,
    ulp.preferred_areas,
    ulp.needs_summary
  FROM user_lifestyle_profiles ulp
  JOIN user_profiles up ON up.id = p_user_id
  WHERE ulp.user_id = p_user_id
    AND ulp.profile_type = up.active_profile_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. Helper function: Get all user profiles
-- ============================================

CREATE OR REPLACE FUNCTION get_user_profiles(p_user_id UUID)
RETURNS TABLE (
  profile_id UUID,
  profile_type TEXT,
  intake_completed BOOLEAN,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ulp.id,
    ulp.profile_type,
    ulp.intake_completed,
    (ulp.profile_type = up.active_profile_type) AS is_active
  FROM user_lifestyle_profiles ulp
  CROSS JOIN user_profiles up
  WHERE ulp.user_id = p_user_id
    AND up.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


