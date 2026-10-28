-- Migration: Add OMSRIA reference fields to listing_photos_furniture_free table
-- Purpose: Support F0 running after R1.5 (OMSRIA) to track which OMSRIA room each furniture-free image belongs to
-- Date: 2025-01-27

-- Add OMSRIA reference columns
ALTER TABLE listing_photos_furniture_free
ADD COLUMN IF NOT EXISTS omsria_room_id TEXT,
ADD COLUMN IF NOT EXISTS omsria_image_url TEXT;

-- Create index for OMSRIA room lookups (used by R2a, R2b, R3)
CREATE INDEX IF NOT EXISTS idx_furniture_free_omsria_room 
ON listing_photos_furniture_free(omsria_room_id);

-- Add comment explaining the new fields
COMMENT ON COLUMN listing_photos_furniture_free.omsria_room_id IS 'Reference to the OMSRIA room_id that this furniture-free image was generated from. NULL for legacy records (before F0 moved after R1.5).';
COMMENT ON COLUMN listing_photos_furniture_free.omsria_image_url IS 'The original OMSRIA image URL that was used as input for furniture removal. NULL for legacy records.';

-- Create unique constraint on (listing_id, omsria_room_id) for F0 conflict resolution
-- This allows one furniture-free image per OMSRIA room per listing
-- PostgreSQL unique constraints allow multiple NULLs, so legacy records with NULL omsria_room_id are fine
ALTER TABLE listing_photos_furniture_free
ADD CONSTRAINT listing_photos_furniture_free_listing_id_omsria_room_id_key 
UNIQUE (listing_id, omsria_room_id);

-- Note: We keep the existing unique constraint on (listing_id, original_photo_url) for backward compatibility
-- New F0 runs will use (listing_id, omsria_room_id) for conflict resolution via upsert
-- Existing records will have NULL omsria_room_id, which is OK for backward compatibility

