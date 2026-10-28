-- Migration 034: OMSRIA Processed Images Table
-- Purpose: Store OMSRIA-processed before-unfurnished images with space isolation metadata

CREATE TABLE IF NOT EXISTS omsria_processed_images (
  id BIGSERIAL PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL, -- e.g., "cluster_123"
  image_url TEXT NOT NULL, -- URL to before-unfurnished image
  image_type TEXT NOT NULL CHECK (image_type IN ('SINGLE_SPACE', 'DEAD_END', 'MULTI_SPACE')),
  visible_spaces JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of space names
  hidden_spaces JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of successfully hidden spaces
  unavoidable_spaces JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of spaces that couldn't be hidden
  editing_plan JSONB, -- Full OMSRIA output from Step 2
  retry_counts JSONB, -- Retry counts per editing step: {"step_1": 3, "step_2": 1}
  is_redundant BOOLEAN NOT NULL DEFAULT false, -- True if discarded in optimization pass
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(listing_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_omsria_listing ON omsria_processed_images(listing_id);
CREATE INDEX IF NOT EXISTS idx_omsria_room ON omsria_processed_images(room_id);
CREATE INDEX IF NOT EXISTS idx_omsria_type ON omsria_processed_images(image_type);
CREATE INDEX IF NOT EXISTS idx_omsria_redundant ON omsria_processed_images(is_redundant) WHERE is_redundant = false;

COMMENT ON TABLE omsria_processed_images IS 'Stores OMSRIA-processed before-unfurnished images with space isolation metadata';
COMMENT ON COLUMN omsria_processed_images.room_id IS 'Room/cluster ID (e.g., cluster_123)';
COMMENT ON COLUMN omsria_processed_images.image_url IS 'URL to the before-unfurnished image (OMSRIA-processed or furniture-free)';
COMMENT ON COLUMN omsria_processed_images.image_type IS 'SINGLE_SPACE: one room isolated, MULTI_SPACE: multiple rooms (no redundancy), DEAD_END: temporary state before optimization';
COMMENT ON COLUMN omsria_processed_images.visible_spaces IS 'Array of space names visible in the image';
COMMENT ON COLUMN omsria_processed_images.hidden_spaces IS 'Array of spaces successfully hidden through OMSRIA edits';
COMMENT ON COLUMN omsria_processed_images.unavoidable_spaces IS 'Array of spaces that could not be hidden organically (from Step 2 output)';
COMMENT ON COLUMN omsria_processed_images.editing_plan IS 'Full OMSRIA structured output from Step 2';
COMMENT ON COLUMN omsria_processed_images.retry_counts IS 'Retry counts per editing step: {"step_1": 3, "step_2": 1}';
COMMENT ON COLUMN omsria_processed_images.is_redundant IS 'True if image was discarded in Step 5 optimization pass';

-- Enable RLS
ALTER TABLE omsria_processed_images ENABLE ROW LEVEL SECURITY;

-- Public read access (for Deep Dive UI)
CREATE POLICY "omsria_processed_images_public_read" ON omsria_processed_images
  FOR SELECT USING (true);

-- Service role write access (for API endpoints)
CREATE POLICY "omsria_processed_images_service_write" ON omsria_processed_images
  FOR ALL USING (auth.role() = 'service_role');

