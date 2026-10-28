-- Restore core fields to listings table for efficient filtering
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS bedrooms INTEGER,
ADD COLUMN IF NOT EXISTS bathrooms DECIMAL(3, 1),
ADD COLUMN IF NOT EXISTS sqm INTEGER,
ADD COLUMN IF NOT EXISTS year_built INTEGER;

-- Add indexes for these fields
CREATE INDEX IF NOT EXISTS idx_listings_bedrooms ON listings (bedrooms);
CREATE INDEX IF NOT EXISTS idx_listings_bathrooms ON listings (bathrooms);
CREATE INDEX IF NOT EXISTS idx_listings_sqm ON listings (sqm);

-- Backfill data from scraped_data
UPDATE listings
SET 
  bedrooms = (scraped_data->>'bedrooms')::INTEGER,
  bathrooms = (scraped_data->>'bathrooms')::DECIMAL,
  sqm = COALESCE(
    (scraped_data->'areas'->>'constructed')::INTEGER,
    (scraped_data->'areas'->>'useful')::INTEGER,
    (scraped_data->>'sqm')::INTEGER,
    (scraped_data->>'m2_built')::INTEGER
  ),
  year_built = (scraped_data->>'year_built')::INTEGER
WHERE scraped_data IS NOT NULL;

