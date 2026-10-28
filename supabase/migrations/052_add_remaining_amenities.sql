-- Add remaining boolean amenities to listings table

ALTER TABLE listings ADD COLUMN IF NOT EXISTS has_elevator BOOLEAN DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS has_terrace BOOLEAN DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS has_balcony BOOLEAN DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS has_pool BOOLEAN DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS has_parking BOOLEAN DEFAULT false; -- Corresponds to has_garage in scraper

-- Add comments
COMMENT ON COLUMN listings.has_elevator IS 'Does the building have an elevator?';
COMMENT ON COLUMN listings.has_terrace IS 'Does the property have a terrace?';
COMMENT ON COLUMN listings.has_balcony IS 'Does the property have a balcony?';
COMMENT ON COLUMN listings.has_pool IS 'Does the property/complex have a swimming pool?';
COMMENT ON COLUMN listings.has_parking IS 'Does the property include parking/garage?';

