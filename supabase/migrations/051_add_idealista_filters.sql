-- Add Idealista-aligned filter columns to listings table

-- 1. Housing Situation (Critical for "Safe and Sound")
-- Values: 'free' (default), 'rented', 'bare_ownership', 'squatted', 'auction'
ALTER TABLE listings ADD COLUMN IF NOT EXISTS housing_situation TEXT DEFAULT 'free';

-- 2. Property Sub-Type (Granular)
-- Values: 'flat', 'penthouse', 'duplex', 'studio', 'loft', 'chalet_detached', 'chalet_semi', 'rustic', 'country_house'
ALTER TABLE listings ADD COLUMN IF NOT EXISTS property_subtype TEXT;

-- 3. Missing Amenities/Characteristics
ALTER TABLE listings ADD COLUMN IF NOT EXISTS has_air_conditioning BOOLEAN DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS has_wardrobes BOOLEAN DEFAULT false; -- Built-in wardrobes
ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_accessible BOOLEAN DEFAULT false; -- Accessible housing
ALTER TABLE listings ADD COLUMN IF NOT EXISTS has_garden BOOLEAN DEFAULT false;    -- Garden
ALTER TABLE listings ADD COLUMN IF NOT EXISTS has_storage BOOLEAN DEFAULT false;   -- Storage room

-- 4. Ad Type
-- Values: 'standard', 'bank', 'private'
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ad_origin TEXT DEFAULT 'standard';

-- Add comments for clarity
COMMENT ON COLUMN listings.housing_situation IS 'Legal status: free, rented, bare_ownership (nuda propiedad), squatted, auction';
COMMENT ON COLUMN listings.property_subtype IS 'Granular type: penthouse, duplex, chalet_detached, etc.';
COMMENT ON COLUMN listings.ad_origin IS 'Origin of the listing (e.g., standard, bank)';
COMMENT ON COLUMN listings.has_air_conditioning IS 'Does the property have air conditioning?';
COMMENT ON COLUMN listings.has_wardrobes IS 'Does the property have built-in wardrobes?';
COMMENT ON COLUMN listings.is_accessible IS 'Is the property accessible for people with reduced mobility?';
COMMENT ON COLUMN listings.has_storage IS 'Does the property have a storage room?';
