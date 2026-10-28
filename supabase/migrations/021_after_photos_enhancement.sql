-- Migration: Enhance after_photos table for Q1-Q5 pipeline
-- Adds room_id, photo_url, is_anchor, harmonized columns for full pipeline support

-- Add new columns
ALTER TABLE public.after_photos
ADD COLUMN IF NOT EXISTS room_id TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS is_anchor BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS harmonized BOOLEAN DEFAULT false;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_after_photos_room_id ON public.after_photos(listing_id, tier, room_id);
CREATE INDEX IF NOT EXISTS idx_after_photos_photo_url ON public.after_photos(photo_url);
CREATE INDEX IF NOT EXISTS idx_after_photos_anchor ON public.after_photos(listing_id, tier, room_id, is_anchor) WHERE is_anchor = true;
CREATE INDEX IF NOT EXISTS idx_after_photos_harmonized ON public.after_photos(listing_id, tier, harmonized) WHERE harmonized = false;

-- Update unique constraint to include room_id and photo_url
ALTER TABLE public.after_photos
DROP CONSTRAINT IF EXISTS after_photos_listing_id_tier_index_key;

-- New unique constraint: (listing_id, tier, room_id, photo_url) for Q3-Q5 pipeline
-- Keep old constraint for backward compatibility if index is still used
ALTER TABLE public.after_photos
ADD CONSTRAINT after_photos_listing_tier_room_photo_unique 
UNIQUE(listing_id, tier, room_id, photo_url);

-- Comments
COMMENT ON COLUMN public.after_photos.room_id IS 'Room/cluster ID (from manual_photo_clusters)';
COMMENT ON COLUMN public.after_photos.photo_url IS 'Original photo URL (from manual_photo_clusters.photo_urls)';
COMMENT ON COLUMN public.after_photos.is_anchor IS 'True if this is the anchor image generated in Q3 (one per room per tier)';
COMMENT ON COLUMN public.after_photos.harmonized IS 'True if Q5 cross-room consistency has been applied';

