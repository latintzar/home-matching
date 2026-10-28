-- Migration: Phase 3 After-Image Pipeline Tables
-- Creates tables for the new room-based after-image generation pipeline with master references
-- Date: 2025-01-27

-- 1. Master Reference Images Table
CREATE TABLE IF NOT EXISTS master_reference_images (
  id BIGSERIAL PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('estandar', 'optimo', 'plus')),
  element_id TEXT NOT NULL,
  element_type TEXT NOT NULL CHECK (element_type IN ('architectural', 'furniture')),
  room_id TEXT,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL, -- Full URL to the reference image
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, tier, element_id, element_type)
);

CREATE INDEX IF NOT EXISTS idx_master_reference_images_listing_tier 
  ON master_reference_images(listing_id, tier);
CREATE INDEX IF NOT EXISTS idx_master_reference_images_element_type 
  ON master_reference_images(element_type);
CREATE INDEX IF NOT EXISTS idx_master_reference_images_room 
  ON master_reference_images(listing_id, tier, room_id) WHERE room_id IS NOT NULL;

ALTER TABLE master_reference_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "master_reference_images_public_read" ON master_reference_images
  FOR SELECT USING (true);
CREATE POLICY "master_reference_images_service_write" ON master_reference_images
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE master_reference_images IS 'Stores master reference images for architectural elements and furniture (backgroundless images for consistency)';
COMMENT ON COLUMN master_reference_images.element_type IS 'Type: architectural (walls, floors, fixtures) or furniture';
COMMENT ON COLUMN master_reference_images.element_id IS 'Unique identifier for the element (e.g., pool_fence, floor_kitchen)';

-- 2. Furniture Decisions Table
CREATE TABLE IF NOT EXISTS furniture_decisions (
  id BIGSERIAL PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('estandar', 'optimo', 'plus')),
  room_id TEXT NOT NULL,
  furniture_data JSONB NOT NULL, -- Structured like T6.5: furniture pieces with specs, costs
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, tier, room_id)
);

CREATE INDEX IF NOT EXISTS idx_furniture_decisions_listing_tier 
  ON furniture_decisions(listing_id, tier);
CREATE INDEX IF NOT EXISTS idx_furniture_decisions_room 
  ON furniture_decisions(listing_id, tier, room_id);

ALTER TABLE furniture_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "furniture_decisions_public_read" ON furniture_decisions
  FOR SELECT USING (true);
CREATE POLICY "furniture_decisions_service_write" ON furniture_decisions
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE furniture_decisions IS 'Stores furniture decisions per room per tier (similar structure to T6.5 element decisions)';
COMMENT ON COLUMN furniture_decisions.furniture_data IS 'JSONB containing furniture pieces with material, color, finish, size, cost specifications';

-- 3. Listing Photos Furniture Free Table
CREATE TABLE IF NOT EXISTS listing_photos_furniture_free (
  id BIGSERIAL PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  original_photo_url TEXT NOT NULL,
  furniture_free_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, original_photo_url)
);

CREATE INDEX IF NOT EXISTS idx_furniture_free_photos_listing 
  ON listing_photos_furniture_free(listing_id);
CREATE INDEX IF NOT EXISTS idx_furniture_free_photos_original_url 
  ON listing_photos_furniture_free(original_photo_url);

ALTER TABLE listing_photos_furniture_free ENABLE ROW LEVEL SECURITY;
CREATE POLICY "furniture_free_photos_public_read" ON listing_photos_furniture_free
  FOR SELECT USING (true);
CREATE POLICY "furniture_free_photos_service_write" ON listing_photos_furniture_free
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE listing_photos_furniture_free IS 'Stores furniture-free versions of listing photos (used by E pipeline and after-image generation)';

-- 4. Room Image Descriptions Table (R2a egocentric descriptions)
CREATE TABLE IF NOT EXISTS room_image_descriptions (
  id BIGSERIAL PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL,
  description_data JSONB NOT NULL, -- Egocentric descriptions from R2a
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_room_image_descriptions_listing 
  ON room_image_descriptions(listing_id);
CREATE INDEX IF NOT EXISTS idx_room_image_descriptions_room 
  ON room_image_descriptions(listing_id, room_id);

ALTER TABLE room_image_descriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "room_image_descriptions_public_read" ON room_image_descriptions
  FOR SELECT USING (true);
CREATE POLICY "room_image_descriptions_service_write" ON room_image_descriptions
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE room_image_descriptions IS 'Stores egocentric camera-centric descriptions from R2a (what camera sees, occlusion, visible sides)';

-- 5. Renovation Prompts Table (R2b detailed prompts)
CREATE TABLE IF NOT EXISTS renovation_prompts (
  id BIGSERIAL PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('estandar', 'optimo', 'plus')),
  room_id TEXT NOT NULL,
  prompt_text TEXT NOT NULL, -- Detailed renovation prompt from R2b (whole paragraphs per element)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, tier, room_id)
);

CREATE INDEX IF NOT EXISTS idx_renovation_prompts_listing_tier 
  ON renovation_prompts(listing_id, tier);
CREATE INDEX IF NOT EXISTS idx_renovation_prompts_room 
  ON renovation_prompts(listing_id, tier, room_id);

ALTER TABLE renovation_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "renovation_prompts_public_read" ON renovation_prompts
  FOR SELECT USING (true);
CREATE POLICY "renovation_prompts_service_write" ON renovation_prompts
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE renovation_prompts IS 'Stores detailed renovation prompts from R2b (super detailed paragraphs per element, references master images)';

-- 6. Update after_photos table to add has_furniture column
ALTER TABLE after_photos 
ADD COLUMN IF NOT EXISTS has_furniture BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_after_photos_has_furniture 
  ON after_photos(listing_id, tier, has_furniture);

COMMENT ON COLUMN after_photos.has_furniture IS 'True if image includes furniture, false if architectural changes only';

-- 7. Add selected_photo_url to manual_photo_clusters (for R1)
ALTER TABLE manual_photo_clusters
ADD COLUMN IF NOT EXISTS selected_photo_url TEXT;

CREATE INDEX IF NOT EXISTS idx_manual_photo_clusters_selected_photo 
  ON manual_photo_clusters(listing_id, selected_photo_url) WHERE selected_photo_url IS NOT NULL;

COMMENT ON COLUMN manual_photo_clusters.selected_photo_url IS 'URL of the selected best wide-angle image for this room (from R1)';

