-- Migration 008: Manual Photo Clusters Table
-- Purpose: Create dedicated table for manual photo clustering from UI
-- Replaces: Dependence on deepdive_photos table for clustering storage

CREATE TABLE IF NOT EXISTS manual_photo_clusters (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  cluster_name TEXT NOT NULL,
  room_type TEXT,  -- e.g., 'Kitchen', 'Living Room', 'Bedroom 1', 'Bathroom'
  photo_urls TEXT[] NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_manual_photo_clusters_listing ON manual_photo_clusters(listing_id);
CREATE INDEX idx_manual_photo_clusters_room_type ON manual_photo_clusters(room_type);

-- RLS Policy (if needed for security)
-- ALTER TABLE manual_photo_clusters ENABLE ROW LEVEL SECURITY;

-- Comments for documentation
COMMENT ON TABLE manual_photo_clusters IS 'Manual photo clusters created by users in the clustering UI';
COMMENT ON COLUMN manual_photo_clusters.listing_id IS 'Reference to the listing these photos belong to';
COMMENT ON COLUMN manual_photo_clusters.cluster_name IS 'User-defined name for the cluster (e.g., "Cocina", "Salón")';
COMMENT ON COLUMN manual_photo_clusters.room_type IS 'Standardized room type for analysis pipeline (e.g., "Kitchen", "Living Room")';
COMMENT ON COLUMN manual_photo_clusters.photo_urls IS 'Array of photo URLs in this cluster';
COMMENT ON COLUMN manual_photo_clusters.display_order IS 'Order for displaying clusters in UI';
