-- Migration: Furniture Staging Plans Table
-- Creates table for R4.5: Coherent whole-house furniture staging plans
-- Date: 2025-01-27

CREATE TABLE IF NOT EXISTS furniture_staging_plans (
  id BIGSERIAL PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('estandar', 'optimo', 'plus')),
  staging_plan JSONB NOT NULL, -- Coherent whole-house staging plan
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, tier)
);

CREATE INDEX IF NOT EXISTS idx_furniture_staging_plans_listing_tier 
  ON furniture_staging_plans(listing_id, tier);

ALTER TABLE furniture_staging_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "furniture_staging_plans_public_read" ON furniture_staging_plans
  FOR SELECT USING (true);
CREATE POLICY "furniture_staging_plans_service_write" ON furniture_staging_plans
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE furniture_staging_plans IS 'R4.5: Coherent whole-house furniture staging plans (not individual pieces per room)';
COMMENT ON COLUMN furniture_staging_plans.staging_plan IS 'JSONB containing coherent staging strategy: overall style, budget-appropriate furniture categories per room type, material/color palette, staging approach';

