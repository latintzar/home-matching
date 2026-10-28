-- Create after_photos table to mirror before photos structure
-- This stores generated "after" renovation photos for each tier

CREATE TABLE IF NOT EXISTS after_photos (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('livable', 'comfortable', 'competitive')),
  index INTEGER NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique combination of listing, tier, and index
  UNIQUE(listing_id, tier, index)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_after_photos_listing_tier ON after_photos(listing_id, tier);
CREATE INDEX IF NOT EXISTS idx_after_photos_listing_tier_index ON after_photos(listing_id, tier, index);

-- Enable RLS
ALTER TABLE after_photos ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for public read access (same as before photos)
CREATE POLICY "after_photos_public_read" ON after_photos
  FOR SELECT USING (true);

-- Create RLS policy for service role insert/update (for generation endpoint)
CREATE POLICY "after_photos_service_write" ON after_photos
  FOR ALL USING (auth.role() = 'service_role');

-- Add comment for documentation
COMMENT ON TABLE after_photos IS 'Stores generated "after" renovation photos for each tier, indexed by listing_id, tier, and photo index';
COMMENT ON COLUMN after_photos.tier IS 'Renovation tier: livable, comfortable, or competitive';
COMMENT ON COLUMN after_photos.index IS 'Photo index matching the corresponding "before" photo for 1:1 pairing';
