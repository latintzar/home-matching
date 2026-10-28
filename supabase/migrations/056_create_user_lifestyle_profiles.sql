-- Create user_lifestyle_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_lifestyle_profiles (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  lifestyle_dna JSONB DEFAULT '{}',
  property_constraints JSONB DEFAULT '{}',
  trade_off_matrix JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_lifestyle_profiles ENABLE ROW LEVEL SECURITY;

-- Public policy (session-based)
CREATE POLICY "Public profiles read" ON user_lifestyle_profiles FOR SELECT USING (true);
CREATE POLICY "Public profiles insert" ON user_lifestyle_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Public profiles update" ON user_lifestyle_profiles FOR UPDATE USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_lifestyle_profiles_session ON user_lifestyle_profiles(session_id);

