-- User Lifestyle Profiles for Recommender System
-- Part of R1: Life Profile Intake
-- Migration: 010_recommender_tables.sql

-- Main profiles table
CREATE TABLE IF NOT EXISTS user_lifestyle_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,  -- References auth.users if auth is set up
  
  -- Household
  adults INTEGER DEFAULT 1,
  children JSONB DEFAULT '[]'::jsonb,  -- [{age: number}]
  pets JSONB DEFAULT '[]'::jsonb,       -- [{type: string, size: string}]
  work_situation TEXT CHECK (work_situation IN ('remote', 'hybrid', 'office', 'retired', 'other')),
  
  -- Lifestyle DNA
  morning_routine TEXT,
  evening_routine TEXT,
  weekend_activities TEXT[] DEFAULT '{}',
  dealbreakers TEXT[] DEFAULT '{}',
  must_haves TEXT[] DEFAULT '{}',
  
  -- Constraints
  max_budget INTEGER,
  max_commute_minutes INTEGER,
  commute_destination TEXT,
  move_in_date DATE,
  renovation_appetite TEXT CHECK (renovation_appetite IN ('turnkey', 'cosmetic', 'full', 'any')),
  
  -- Trade-offs (-5 to +5 scale)
  tradeoff_space_vs_location INTEGER DEFAULT 0 CHECK (tradeoff_space_vs_location BETWEEN -5 AND 5),
  tradeoff_new_vs_character INTEGER DEFAULT 0 CHECK (tradeoff_new_vs_character BETWEEN -5 AND 5),
  tradeoff_quiet_vs_vibrant INTEGER DEFAULT 0 CHECK (tradeoff_quiet_vs_vibrant BETWEEN -5 AND 5),
  tradeoff_views_vs_privacy INTEGER DEFAULT 0 CHECK (tradeoff_views_vs_privacy BETWEEN -5 AND 5),
  
  -- Location preferences (can be updated by sweet spot)
  preferred_locations TEXT[] DEFAULT '{}',
  avoid_locations TEXT[] DEFAULT '{}',
  
  -- Property type preferences
  property_types TEXT[] DEFAULT '{}',  -- ['piso', 'casa', 'chalet']
  min_bedrooms INTEGER,
  min_bathrooms INTEGER,
  min_sqm INTEGER,
  
  -- Metadata
  intake_completed BOOLEAN DEFAULT false,
  intake_step INTEGER DEFAULT 0,
  raw_conversation JSONB,  -- Store AI conversation for extraction
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick user lookup
CREATE INDEX IF NOT EXISTS idx_lifestyle_profiles_user ON user_lifestyle_profiles(user_id);

-- User matches table (for saved recommendations)
CREATE TABLE IF NOT EXISTS user_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES user_lifestyle_profiles(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL,  -- From DynamoDB
  
  fit_score INTEGER CHECK (fit_score BETWEEN 0 AND 100),
  score_breakdown JSONB,  -- {light: 80, noise: 70, space: 90, ...}
  top_reasons TEXT[] DEFAULT '{}',
  concerns TEXT[] DEFAULT '{}',
  
  status TEXT DEFAULT 'suggested' CHECK (status IN ('suggested', 'saved', 'dismissed', 'contacted')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for profile lookups
CREATE INDEX IF NOT EXISTS idx_matches_profile ON user_matches(profile_id);

-- Match feedback for flywheel
CREATE TABLE IF NOT EXISTS match_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES user_matches(id) ON DELETE CASCADE,
  
  feedback_type TEXT CHECK (feedback_type IN ('like', 'dislike', 'save', 'dismiss', 'contact')),
  reason TEXT,  -- Why they liked/disliked
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Updated at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_lifestyle_profiles_updated_at ON user_lifestyle_profiles;
CREATE TRIGGER update_lifestyle_profiles_updated_at
  BEFORE UPDATE ON user_lifestyle_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_matches_updated_at ON user_matches;
CREATE TRIGGER update_user_matches_updated_at
  BEFORE UPDATE ON user_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant access (for unauthenticated testing - remove in production)
-- Note: Proper RLS policies should be added when auth is fully set up

