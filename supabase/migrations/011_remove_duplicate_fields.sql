-- Remove duplicate fields from listings table
-- All parsed data should be in scraped_data JSONB only
-- Keep only: id, title, address, city, region, country, price_eur, source_url, created_at, updated_at, scraped_data, pipeline_checkpoints

-- First, let's see what we have
DO $$
BEGIN
  RAISE NOTICE 'Cleaning up duplicate fields in listings table';
END $$;

-- Remove columns that should be in scraped_data
ALTER TABLE listings 
  DROP COLUMN IF EXISTS sqm,
  DROP COLUMN IF EXISTS bedrooms,
  DROP COLUMN IF EXISTS bathrooms,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS lot_sqm,
  DROP COLUMN IF EXISTS property_type,
  DROP COLUMN IF EXISTS listing_status,
  DROP COLUMN IF EXISTS year_built,
  DROP COLUMN IF EXISTS reference_number,
  DROP COLUMN IF EXISTS scraped_property_id,
  DROP COLUMN IF EXISTS scraped_at,
  DROP COLUMN IF EXISTS floor_number,
  DROP COLUMN IF EXISTS has_elevator,
  DROP COLUMN IF EXISTS has_terrace,
  DROP COLUMN IF EXISTS has_parking,
  DROP COLUMN IF EXISTS has_storage,
  DROP COLUMN IF EXISTS has_pool,
  DROP COLUMN IF EXISTS has_air_conditioning,
  DROP COLUMN IF EXISTS furnished,
  DROP COLUMN IF EXISTS pets_allowed,
  DROP COLUMN IF EXISTS last_reform,
  DROP COLUMN IF EXISTS energy_rating,
  DROP COLUMN IF EXISTS property_condition,
  DROP COLUMN IF EXISTS orientation,
  DROP COLUMN IF EXISTS last_renovation_year,
  DROP COLUMN IF EXISTS community_fees_eur,
  DROP COLUMN IF EXISTS ibi_tax_eur,
  DROP COLUMN IF EXISTS has_balcony,
  DROP COLUMN IF EXISTS has_garden,
  DROP COLUMN IF EXISTS has_heating;

-- Add comments to clarify what should be in scraped_data
COMMENT ON COLUMN listings.scraped_data IS 'Complete scraped property data including: areas (constructed/useful), bedrooms, bathrooms, description, roomsAndAmenities, photos, HTML content, and all amenities';

COMMENT ON COLUMN listings.pipeline_checkpoints IS 'Pipeline processing status for: scraping, photo_storage, a1_context, a2_facts, , b2_merge, b3_snippets, b4_headlines, c1_unknowns, c2_followups';

COMMENT ON TABLE listings IS 'Core property listings with parsed data stored in scraped_data JSONB field';

