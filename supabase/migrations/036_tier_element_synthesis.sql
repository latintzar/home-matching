-- Migration 036: Tier Element Synthesis Table
-- Phase 2: Pipeline Simplification - Consolidated tier generation (T3+T4+T5+T5.5+T6.5)

CREATE TABLE IF NOT EXISTS tier_element_synthesis (
  id BIGSERIAL PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('estandar', 'optimo', 'plus')),
  synthesis_data JSONB NOT NULL, -- TierElementSynthesis
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(listing_id, tier)
);

CREATE INDEX IF NOT EXISTS idx_tier_element_synthesis_listing ON tier_element_synthesis(listing_id);
CREATE INDEX IF NOT EXISTS idx_tier_element_synthesis_tier ON tier_element_synthesis(tier);
CREATE INDEX IF NOT EXISTS idx_tier_element_synthesis_listing_tier ON tier_element_synthesis(listing_id, tier);

COMMENT ON TABLE tier_element_synthesis IS 'Phase 2: Consolidated tier element synthesis - canonical, additive list of renovation works per tier (replaces T3, T4, T5, T5.5, T6.5)';
COMMENT ON COLUMN tier_element_synthesis.synthesis_data IS 'TierElementSynthesis JSON - complete synthesis with works, cohesion summary, and statistics';

-- Enable RLS
ALTER TABLE tier_element_synthesis ENABLE ROW LEVEL SECURITY;

-- Public read access (for Deep Dive UI)
CREATE POLICY "tier_element_synthesis_public_read" ON tier_element_synthesis
  FOR SELECT USING (true);

-- Service role write access (for API endpoints)
CREATE POLICY "tier_element_synthesis_service_write" ON tier_element_synthesis
  FOR ALL USING (auth.role() = 'service_role');

