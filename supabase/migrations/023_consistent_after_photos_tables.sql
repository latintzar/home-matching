-- Migration: Consistent After Photos - Text-Driven Strategy
-- Creates tables for E5 (POV extraction), E2-After (tier layouts), and P1 (per-photo prompts)
-- Date: 2025-01-27

-- E5: Per-Photo POV Extraction
CREATE TABLE IF NOT EXISTS photo_pov (
  listing_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  camera_pov TEXT NOT NULL, -- "from bed toward terrace", "from sofa toward TV wall"
  orientation TEXT, -- cardinal or relative ("toward window wall")
  composition JSONB NOT NULL, -- { thirds: { left: [...], center: [...], right: [...] }, depth: { fg: [...], mg: [...], bg: [...] } }
  visible_in_room JSONB NOT NULL, -- [{ element, surface, prominence, notes }]
  visible_adjacent_rooms JSONB, -- [{ room_id, room_name, elements_visible: [...] }]
  watermark_present BOOLEAN DEFAULT false,
  uncertainties JSONB, -- { level: "low"|"med"|"high", notes: [...] }
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (listing_id, photo_url),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_photo_pov_listing_room ON photo_pov(listing_id, room_id);

-- E2-After: Tier-Specific Canonical Layouts
CREATE TABLE IF NOT EXISTS e2_after_layouts (
  listing_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('estandar', 'optimo', 'plus')),
  layout_after JSONB NOT NULL, -- tier-specific room invariants (surfaces, materials, colors)
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (listing_id, tier),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

-- P1: Per-Photo After Prompts
CREATE TABLE IF NOT EXISTS per_photo_after_prompts (
  listing_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('estandar', 'optimo', 'plus')),
  photo_url TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  tokens_estimate INT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (listing_id, tier, photo_url),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_per_photo_prompts_listing_tier ON per_photo_after_prompts(listing_id, tier);

-- Add comments for documentation
COMMENT ON TABLE photo_pov IS 'E5: Per-photo camera perspective and visible elements extraction';
COMMENT ON TABLE e2_after_layouts IS 'Tier-specific canonical "after" layouts with material invariants';
COMMENT ON TABLE per_photo_after_prompts IS 'P1: Coordinated per-photo prompts for after-image generation';

