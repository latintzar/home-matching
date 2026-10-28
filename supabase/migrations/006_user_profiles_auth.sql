-- Migration: User Profiles and Auth
-- Creates tables for user authentication and role-based access

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('renter_buyer', 'professional')),
  full_name TEXT,
  phone TEXT,
  language TEXT DEFAULT 'es' CHECK (language IN ('es', 'en')),
  delivery_preference TEXT CHECK (delivery_preference IN ('email', 'whatsapp')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for role-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (during signup)
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Service role can do anything (for admin operations)
CREATE POLICY "Service role full access"
  ON user_profiles FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Lifestyle profiles table (extends user_profiles)
CREATE TABLE IF NOT EXISTS user_lifestyle_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Life profile data (JSONB for flexibility)
  life_profile JSONB,
  
  -- Completeness tracking
  completeness_score FLOAT DEFAULT 0,
  minimum_met BOOLEAN DEFAULT false,
  missing_fields TEXT[] DEFAULT '{}',
  
  -- Delivery preferences
  delivery_preference TEXT CHECK (delivery_preference IN ('email', 'whatsapp')),
  phone_number TEXT,
  
  -- Follow-up tracking
  follow_up_sent_at TIMESTAMPTZ,
  
  -- Language
  language TEXT DEFAULT 'es' CHECK (language IN ('es', 'en')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Intake tracking
  intake_completed BOOLEAN DEFAULT false,
  intake_completed_at TIMESTAMPTZ,
  intake_source TEXT CHECK (intake_source IN ('voice', 'chat', 'form'))
);

-- Add index for user lookup
CREATE INDEX IF NOT EXISTS idx_user_lifestyle_profiles_user_id ON user_lifestyle_profiles(user_id);

-- Enable RLS
ALTER TABLE user_lifestyle_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for lifestyle profiles
CREATE POLICY "Users can read own lifestyle profile"
  ON user_lifestyle_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own lifestyle profile"
  ON user_lifestyle_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own lifestyle profile"
  ON user_lifestyle_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on lifestyle profiles"
  ON user_lifestyle_profiles FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Early access signups table
CREATE TABLE IF NOT EXISTS early_access_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  role TEXT CHECK (role IN ('renter_buyer', 'professional')),
  source TEXT,  -- Where they signed up from (homepage, landing page, etc.)
  language TEXT DEFAULT 'es',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  converted_at TIMESTAMPTZ,  -- When they became a real user
  converted_user_id UUID REFERENCES auth.users(id)
);

-- Add index for email lookup
CREATE INDEX IF NOT EXISTS idx_early_access_email ON early_access_signups(email);

-- Early access doesn't need RLS - service role only
ALTER TABLE early_access_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on early access"
  ON early_access_signups FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_lifestyle_profiles_updated_at ON user_lifestyle_profiles;
CREATE TRIGGER update_user_lifestyle_profiles_updated_at
  BEFORE UPDATE ON user_lifestyle_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE user_profiles IS 'User authentication profiles with role-based access';
COMMENT ON TABLE user_lifestyle_profiles IS 'Extended lifestyle profiles for the Recommender system';
COMMENT ON TABLE early_access_signups IS 'Email signups for early access waiting list';
COMMENT ON COLUMN user_profiles.role IS 'User role: renter_buyer (looking for a place) or professional (agent/agency)';
COMMENT ON COLUMN user_lifestyle_profiles.completeness_score IS 'Profile completeness 0-1, used for follow-up prioritization';
COMMENT ON COLUMN user_lifestyle_profiles.minimum_met IS 'Whether minimum required fields are filled for recommendations';

