-- Migration: Add reference_snippet column to master_reference_images
-- Replaces expensive image generation with text-based reference snippets
-- Date: 2025-01-27

-- Add reference_snippet column to master_reference_images
ALTER TABLE master_reference_images 
ADD COLUMN IF NOT EXISTS reference_snippet TEXT;

COMMENT ON COLUMN master_reference_images.reference_snippet IS 'Descriptive text snippet for reference element (replaces expensive image generation). Used in R2b and R3 prompts instead of reference images.';

