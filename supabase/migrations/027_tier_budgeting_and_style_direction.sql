-- Migration: Tier Budgeting and Style Direction Tables
-- Creates tables for T1.5 (Tier Budgeting) and T2.5 (Tier Style Direction)
-- Date: 2025-01-27

-- Tier Budgeting: Baseline budget brackets per tier (T1.5)
-- Runs before T2 (Tier Ideation) to provide budget context
CREATE TABLE IF NOT EXISTS tier_budgeting (
  listing_id TEXT NOT NULL,
  budgeting_data JSONB NOT NULL, -- { estandar: {...}, optimo: {...}, plus: {...}, property_value_eur, renovation_percentage_of_value }
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (listing_id),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tier_budgeting_listing ON tier_budgeting(listing_id);

COMMENT ON TABLE tier_budgeting IS 'T1.5: Baseline budget brackets per tier (Estándar, Óptimo, Plus) calculated before tier ideation';
COMMENT ON COLUMN tier_budgeting.budgeting_data IS 'Budget brackets with min_eur, max_eur, rationale per tier, plus property_value_eur and renovation_percentage_of_value';

-- Style Direction: Tier-specific style directions (T2.5)
-- Runs between T2 (Tier Ideation) and T3 (Apply to Groups)
-- Note: style_direction table already exists from Q1, but we'll ensure it supports tier-specific data
-- The existing table structure should work, but we add a comment to clarify the new usage

-- Verify style_direction table exists (it should from Q1 implementation)
-- If it doesn't exist, create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'style_direction') THEN
    CREATE TABLE style_direction (
      listing_id TEXT NOT NULL PRIMARY KEY,
      direction_data JSONB NOT NULL, -- { listing_id, generated_at, baseline: {...}, tiers: { estandar: {...}, optimo: {...}, plus: {...} } }
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_style_direction_listing ON style_direction(listing_id);
    
    COMMENT ON TABLE style_direction IS 'T2.5: Tier-specific style directions (replaces Q1 style direction). Generated between T2 and T3 to inform cost decisions';
    COMMENT ON COLUMN style_direction.direction_data IS 'Style direction data with baseline aesthetic and tier-specific directions (estandar, optimo, plus)';
  ELSE
    -- Table exists, just update comments
    COMMENT ON TABLE style_direction IS 'T2.5: Tier-specific style directions (replaces Q1 style direction). Generated between T2 and T3 to inform cost decisions';
    COMMENT ON COLUMN style_direction.direction_data IS 'Style direction data with baseline aesthetic and tier-specific directions (estandar, optimo, plus)';
  END IF;
END $$;

