-- Migration: Rename after image pipeline tables to Q2/Q3/Q4 naming
-- Date: 2025-01-27

-- Rename e2_after_layouts → after_layouts (Q2)
ALTER TABLE IF EXISTS e2_after_layouts RENAME TO after_layouts;

-- Rename per_photo_after_prompts → after_prompts (Q3)
ALTER TABLE IF EXISTS per_photo_after_prompts RENAME TO after_prompts;

-- Update comments
COMMENT ON TABLE after_layouts IS 'Q2: Tier-specific canonical "after" layouts with material invariants';
COMMENT ON TABLE after_prompts IS 'Q3: Coordinated per-photo prompts for after-image generation';

