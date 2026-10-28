-- Vibe Check Tables
-- Used for in-call property carousel and feedback tracking

-- ============================================================================
-- Vibe Check Sessions
-- ============================================================================
-- Stores carousel sessions pushed to frontend during calls

CREATE TABLE IF NOT EXISTS vibe_check_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  properties JSONB NOT NULL,  -- Array of PropertyForCarousel
  status TEXT DEFAULT 'active',  -- active, completed, expired
  has_feedback BOOLEAN DEFAULT false,
  last_feedback_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Index for user lookup
  CONSTRAINT vibe_check_sessions_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_vibe_check_sessions_user_id ON vibe_check_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_vibe_check_sessions_created_at ON vibe_check_sessions(created_at);

-- ============================================================================
-- Vibe Check Feedback
-- ============================================================================
-- Stores user reactions to individual properties in carousels

CREATE TABLE IF NOT EXISTS vibe_check_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES vibe_check_sessions(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL,
  reaction TEXT,  -- 'like', 'dislike', 'curious', 'skip'
  comment TEXT,   -- Optional free-text comment
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vibe_check_feedback_session_id ON vibe_check_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_vibe_check_feedback_listing_id ON vibe_check_feedback(listing_id);

-- ============================================================================
-- User Property Explanations
-- ============================================================================
-- Cached personalized explanations for properties (user-specific)

CREATE TABLE IF NOT EXISTS user_property_explanations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL,
  explanation TEXT NOT NULL,
  fit_score INTEGER,
  top_matches TEXT[],
  concerns TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique per user-listing pair
  UNIQUE(user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_user_property_explanations_user_id ON user_property_explanations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_property_explanations_listing_id ON user_property_explanations(listing_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE vibe_check_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibe_check_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_property_explanations ENABLE ROW LEVEL SECURITY;

-- Sessions: Users can see their own sessions
CREATE POLICY "Users can view own vibe check sessions" ON vibe_check_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert sessions
CREATE POLICY "Service can insert vibe check sessions" ON vibe_check_sessions
  FOR INSERT WITH CHECK (true);

-- Service role can update sessions
CREATE POLICY "Service can update vibe check sessions" ON vibe_check_sessions
  FOR UPDATE USING (true);

-- Feedback: Users can view and insert their own feedback
CREATE POLICY "Users can view own vibe check feedback" ON vibe_check_feedback
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM vibe_check_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert vibe check feedback" ON vibe_check_feedback
  FOR INSERT WITH CHECK (true);

-- Explanations: Users can view their own
CREATE POLICY "Users can view own property explanations" ON user_property_explanations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert property explanations" ON user_property_explanations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update property explanations" ON user_property_explanations
  FOR UPDATE USING (true);

-- ============================================================================
-- Enable Realtime
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE vibe_check_sessions;

COMMENT ON TABLE vibe_check_sessions IS 'Carousel sessions for in-call property showing';
COMMENT ON TABLE vibe_check_feedback IS 'User reactions to properties shown in carousels';
COMMENT ON TABLE user_property_explanations IS 'Cached personalized property explanations per user';

