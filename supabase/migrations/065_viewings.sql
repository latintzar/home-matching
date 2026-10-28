-- Migration: 065_viewings.sql
-- Purpose: Create viewings table for property viewing management and notes
-- Part of Phase 0: Foundation

-- Viewings table
-- Tracks user interest in properties and viewing appointments
CREATE TABLE IF NOT EXISTS viewings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who is viewing
  user_id UUID,  -- NULL if from pro_client
  pro_client_id UUID REFERENCES pro_clients(id),
  
  -- What property
  listing_id TEXT NOT NULL,  -- References listings table or DynamoDB ID
  
  -- Status tracking
  status TEXT DEFAULT 'interested' CHECK (status IN (
    'interested',      -- User clicked "Quiero verlo"
    'contacted',       -- User contacted agent
    'scheduled',       -- Viewing scheduled
    'completed',       -- Viewing done
    'cancelled'        -- Cancelled
  )),
  
  -- Agent contact info (captured at interest time)
  agent_phone TEXT,
  agent_whatsapp_url TEXT,
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Notes from user during/after viewing
  notes JSONB DEFAULT '[]'::JSONB,
  
  -- Overall impression (filled after viewing)
  impression TEXT CHECK (impression IN ('positive', 'neutral', 'negative')),
  impression_notes TEXT,
  
  -- Would they recommend? (for future matching)
  would_recommend BOOLEAN,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure either user_id or pro_client_id is set
  CONSTRAINT viewing_owner_check CHECK (
    (user_id IS NOT NULL AND pro_client_id IS NULL) OR
    (user_id IS NULL AND pro_client_id IS NOT NULL)
  )
);

-- Viewing notes structure (JSONB array)
-- Each note: { timestamp, category, content, photo_urls? }
-- Categories: general, positive, concern, question, must_verify

-- Indexes
CREATE INDEX IF NOT EXISTS idx_viewings_user_id ON viewings(user_id);
CREATE INDEX IF NOT EXISTS idx_viewings_pro_client_id ON viewings(pro_client_id);
CREATE INDEX IF NOT EXISTS idx_viewings_listing_id ON viewings(listing_id);
CREATE INDEX IF NOT EXISTS idx_viewings_status ON viewings(status);
CREATE INDEX IF NOT EXISTS idx_viewings_created_at ON viewings(created_at DESC);

-- Enable RLS
ALTER TABLE viewings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can manage their own viewings
CREATE POLICY "Users can manage own viewings"
  ON viewings
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Pros can see viewings for their clients
CREATE POLICY "Pros can see client viewings"
  ON viewings
  FOR SELECT
  USING (
    pro_client_id IN (
      SELECT id FROM pro_clients WHERE pro_user_id = auth.uid()
    )
  );

-- Pros can update client viewing notes (read-only for status)
CREATE POLICY "Pros can read client viewing notes"
  ON viewings
  FOR UPDATE
  USING (
    pro_client_id IN (
      SELECT id FROM pro_clients WHERE pro_user_id = auth.uid()
    )
  );

-- Update trigger
CREATE OR REPLACE FUNCTION update_viewings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_viewings_updated_at
  BEFORE UPDATE ON viewings
  FOR EACH ROW
  EXECUTE FUNCTION update_viewings_updated_at();

-- Function to add a note to a viewing
CREATE OR REPLACE FUNCTION add_viewing_note(
  p_viewing_id UUID,
  p_category TEXT,
  p_content TEXT,
  p_photo_urls TEXT[] DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_note JSONB;
  v_result JSONB;
BEGIN
  v_note := jsonb_build_object(
    'id', gen_random_uuid(),
    'timestamp', NOW(),
    'category', p_category,
    'content', p_content,
    'photo_urls', p_photo_urls
  );
  
  UPDATE viewings
  SET notes = notes || v_note
  WHERE id = p_viewing_id
  RETURNING notes INTO v_result;
  
  RETURN v_note;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE viewings IS 'Property viewing tracking and notes for users and pro clients';
COMMENT ON COLUMN viewings.notes IS 'JSONB array of notes: [{id, timestamp, category, content, photo_urls}]';

