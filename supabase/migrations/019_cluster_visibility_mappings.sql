-- Migration 019: Cluster Visibility Mappings
-- Purpose: Store inter-cluster visibility relationships (e.g., Kitchen visible from Living Room through arch)
-- Maps: photo_url -> [visible_cluster_ids]

ALTER TABLE manual_photo_clusters 
ADD COLUMN IF NOT EXISTS visibility_mappings JSONB DEFAULT '{}'::jsonb;

-- Index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_manual_photo_clusters_visibility 
ON manual_photo_clusters USING GIN (visibility_mappings);

COMMENT ON COLUMN manual_photo_clusters.visibility_mappings IS 
'Stage 4 visibility format: {visibility_mappings: [{photo_url, cluster_name, visible_clusters: [names], visibility_details}], cluster_adjacency: {cluster_name: [adjacent_names]}}.
Uses cluster names directly (no ID lookups needed).';

