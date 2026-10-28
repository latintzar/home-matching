-- Pipeline tables from reformia/supabase/schema-pipeline.sql
-- Pipeline jobs tracking
CREATE TABLE IF NOT EXISTS pipeline_jobs (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('segmentation', 'matching', 'analysis')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_listing ON pipeline_jobs(listing_id, stage);

-- Segmentation results (Grounded SAM 2)
CREATE TABLE IF NOT EXISTS segmentation_masks (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  image_id TEXT NOT NULL,
  mask_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL CHECK (label IN ('wall', 'floor', 'ceiling', 'window', 'door')),
  bbox JSONB NOT NULL,
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  mask_url TEXT NOT NULL,
  crop_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_segmentation_listing ON segmentation_masks(listing_id);
CREATE INDEX IF NOT EXISTS idx_segmentation_label ON segmentation_masks(listing_id, label);

-- Zone matches (LightGlue feature matching)
CREATE TABLE IF NOT EXISTS zone_matches (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  zone_a_id INTEGER REFERENCES segmentation_masks(id) ON DELETE CASCADE,
  zone_b_id INTEGER REFERENCES segmentation_masks(id) ON DELETE CASCADE,
  inlier_score FLOAT NOT NULL,
  num_matches INTEGER NOT NULL,
  match_viz_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT different_zones CHECK (zone_a_id < zone_b_id)
);

CREATE INDEX IF NOT EXISTS idx_zone_matches_listing ON zone_matches(listing_id);
CREATE INDEX IF NOT EXISTS idx_zone_matches_score ON zone_matches(listing_id, inlier_score DESC);

-- Room clusters (connected components from matches)
CREATE TABLE IF NOT EXISTS room_clusters (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  cluster_id TEXT NOT NULL,
  zone_ids INTEGER[] NOT NULL,
  confidence FLOAT NOT NULL,
  collage_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, cluster_id)
);

CREATE INDEX IF NOT EXISTS idx_room_clusters_listing ON room_clusters(listing_id);

-- Gemini analyses per cluster
CREATE TABLE IF NOT EXISTS room_analyses (
  id SERIAL PRIMARY KEY,
  cluster_id INTEGER REFERENCES room_clusters(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('Livable', 'Comfortable', 'Competitive')),
  summary TEXT NOT NULL,
  suggestions TEXT[] NOT NULL,
  confidence FLOAT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_analyses_cluster ON room_analyses(cluster_id);

-- Storage buckets (run separately if needed)
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('pipeline-segmentation', 'pipeline-segmentation', true),
  ('pipeline-matches', 'pipeline-matches', true),
  ('pipeline-clusters', 'pipeline-clusters', true)
ON CONFLICT (id) DO NOTHING;
