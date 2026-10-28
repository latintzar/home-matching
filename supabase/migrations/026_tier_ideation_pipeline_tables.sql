-- Migration: Tier Ideation Pipeline Tables
-- Creates tables for tier ideation pipeline: room families, tier philosophies, group directives, cohesion notes, and budget calibration
-- Date: 2025-01-27

-- Room Families: Groups similar rooms (e.g., all bathrooms, all bedrooms)
CREATE TABLE IF NOT EXISTS room_families (
  listing_id TEXT NOT NULL,
  family_id TEXT NOT NULL, -- e.g., "bathrooms", "bedrooms", "kitchens"
  family_name TEXT NOT NULL, -- e.g., "Bathrooms", "Bedrooms"
  room_ids JSONB NOT NULL, -- Array of room IDs in this family
  rationale TEXT, -- Why these rooms are grouped together
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (listing_id, family_id),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_room_families_listing ON room_families(listing_id);

-- Tier Philosophies: Whole-house tier definitions
CREATE TABLE IF NOT EXISTS tier_philosophies (
  listing_id TEXT NOT NULL,
  philosophies JSONB NOT NULL, -- { estandar: {...}, optimo: {...}, plus: {...} }
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (listing_id),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

-- Group Tier Directives: Per-family, per-tier directives
CREATE TABLE IF NOT EXISTS group_tier_directives (
  listing_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('estandar', 'optimo', 'plus')),
  family_id TEXT NOT NULL,
  directives JSONB NOT NULL, -- What this family changes in this tier
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (listing_id, tier, family_id),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_group_tier_directives_listing_tier ON group_tier_directives(listing_id, tier);
CREATE INDEX IF NOT EXISTS idx_group_tier_directives_listing_family ON group_tier_directives(listing_id, family_id);

-- Cohesion Notes: Glue A output - holistic notes ensuring unity
CREATE TABLE IF NOT EXISTS cohesion_notes (
  listing_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('estandar', 'optimo', 'plus')),
  cohesion JSONB NOT NULL, -- Holistic cohesion notes
  consistency_corrections JSONB, -- Array of corrections needed
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (listing_id, tier),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cohesion_notes_listing_tier ON cohesion_notes(listing_id, tier);

-- Tier Budget Calibration: Glue B output - budget adjustments
CREATE TABLE IF NOT EXISTS tier_budget_calibration (
  listing_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('estandar', 'optimo', 'plus')),
  calibration JSONB NOT NULL, -- Budget calibration data
  adjustments JSONB, -- Array of adjustments needed
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (listing_id, tier),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tier_budget_calibration_listing_tier ON tier_budget_calibration(listing_id, tier);

-- Add comments for documentation
COMMENT ON TABLE room_families IS 'Groups similar rooms (bathrooms, bedrooms, etc.) for consistent treatment';
COMMENT ON TABLE tier_philosophies IS 'Whole-house tier definitions: Estándar (lower passable), Óptimo (sweet spot), Plus (all-out with reason)';
COMMENT ON TABLE group_tier_directives IS 'Per-family, per-tier directives (what each family changes in each tier)';
COMMENT ON TABLE cohesion_notes IS 'Glue A: Holistic notes ensuring cross-room consistency and style harmony';
COMMENT ON TABLE tier_budget_calibration IS 'Glue B: Budget adjustments to hit tier targets (lower passable/sweet spot/all-out)';

