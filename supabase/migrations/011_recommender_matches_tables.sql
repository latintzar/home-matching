-- User matches table (for saved recommendations)
-- Migration: 011_recommender_matches_tables.sql

CREATE TABLE IF NOT EXISTS user_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES user_lifestyle_profiles(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL,
  
  fit_score INTEGER CHECK (fit_score BETWEEN 0 AND 100),
  score_breakdown JSONB,
  top_reasons TEXT[] DEFAULT '{}',
  concerns TEXT[] DEFAULT '{}',
  
  status TEXT DEFAULT 'suggested' CHECK (status IN ('suggested', 'saved', 'dismissed', 'contacted')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_profile ON user_matches(profile_id);

CREATE TABLE IF NOT EXISTS match_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES user_matches(id) ON DELETE CASCADE,
  
  feedback_type TEXT CHECK (feedback_type IN ('like', 'dislike', 'save', 'dismiss', 'contact')),
  reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_user_matches_updated_at ON user_matches;
CREATE TRIGGER update_user_matches_updated_at
  BEFORE UPDATE ON user_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

