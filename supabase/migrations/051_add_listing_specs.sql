-- Add structured property specs to listings table for better filtering and lifestyle matching
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS floor_level TEXT, -- 'top', 'intermediate', 'ground', 'attic'
ADD COLUMN IF NOT EXISTS has_elevator BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_exterior BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_terrace BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_balcony BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_pool BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_garage BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_garden BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS condition TEXT; -- 'new', 'good', 'renovate'

-- Add indexes for common filter queries
CREATE INDEX IF NOT EXISTS idx_listings_floor_level ON listings (floor_level);
CREATE INDEX IF NOT EXISTS idx_listings_elevator ON listings (has_elevator);
CREATE INDEX IF NOT EXISTS idx_listings_terrace ON listings (has_terrace);
CREATE INDEX IF NOT EXISTS idx_listings_balcony ON listings (has_balcony);

