-- Migration 010: Update listing_photos table for Supabase Storage
-- Purpose: Add fields to support Supabase Storage URLs and original URLs

-- Add new columns to listing_photos table
ALTER TABLE listing_photos 
ADD COLUMN IF NOT EXISTS original_url TEXT,
ADD COLUMN IF NOT EXISTS filename TEXT;

-- Add index for filename lookups
CREATE INDEX IF NOT EXISTS idx_listing_photos_filename ON listing_photos(filename);

-- Add comment for documentation
COMMENT ON COLUMN listing_photos.original_url IS 'Original URL from Idealista (for reference)';
COMMENT ON COLUMN listing_photos.filename IS 'Filename in Supabase Storage';
COMMENT ON COLUMN listing_photos.url IS 'Supabase Storage URL (primary) or fallback URL';

