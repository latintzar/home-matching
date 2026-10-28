-- Migration 040: Auto Photo Clusters Test Table
-- Purpose: Store auto-clustering test results separately from manual clusters
-- Allows testing auto-clustering pipeline without affecting manual clusters

CREATE TABLE IF NOT EXISTS auto_photo_clusters (
  id BIGSERIAL PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  cluster_name TEXT NOT NULL,
  room_type TEXT,  -- e.g., 'Kitchen', 'Living Room', 'Bedroom 1', 'Bathroom'
  photo_urls TEXT[] NOT NULL,
  photo_indices INTEGER[] NOT NULL,  -- Original photo indices for reference
  display_order INTEGER DEFAULT 0,
  source_stage TEXT,  -- 'stage-2' (exemplar) or 'stage-3' (matched)
  confidence DECIMAL(3, 2),  -- 0.00 to 1.00
  test_run_id TEXT,  -- UUID to group clusters from same test run
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_auto_photo_clusters_listing ON auto_photo_clusters(listing_id);
CREATE INDEX idx_auto_photo_clusters_test_run ON auto_photo_clusters(test_run_id);
CREATE INDEX idx_auto_photo_clusters_room_type ON auto_photo_clusters(room_type);

-- Table for storing full pipeline test results metadata
CREATE TABLE IF NOT EXISTS auto_clustering_test_runs (
  id TEXT PRIMARY KEY,  -- UUID
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  test_type TEXT NOT NULL DEFAULT 'full',  -- 'full', 'stage-1', 'stage-2', etc.
  space_set JSONB,  -- Stage 1 output
  stage2_result JSONB,  -- Stage 2 output
  stage3_result JSONB,  -- Stage 3 output
  stage4_result JSONB,  -- Stage 4 output
  final_clusters JSONB,  -- Final cluster structure
  summary JSONB,  -- Pipeline summary
  total_duration_ms INTEGER,
  success BOOLEAN DEFAULT false,
  errors JSONB,  -- Array of errors
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auto_clustering_test_runs_listing ON auto_clustering_test_runs(listing_id);
CREATE INDEX idx_auto_clustering_test_runs_created ON auto_clustering_test_runs(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE auto_photo_clusters IS 'Auto-generated photo clusters from test pipeline (separate from manual clusters)';
COMMENT ON TABLE auto_clustering_test_runs IS 'Metadata for auto-clustering test runs';
COMMENT ON COLUMN auto_photo_clusters.test_run_id IS 'Links clusters to a specific test run';
COMMENT ON COLUMN auto_photo_clusters.source_stage IS 'Which pipeline stage created this cluster (stage-2 or stage-3)';
COMMENT ON COLUMN auto_photo_clusters.confidence IS 'Confidence score from AI model (0.00 to 1.00)';

