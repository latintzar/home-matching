-- Migration 043: Rename manual_photo_clusters to clusters
-- Purpose: Simplify naming - clusters is now the single production table
-- Auto-clustering is the primary method, so "manual" naming is misleading

-- Rename table
ALTER TABLE manual_photo_clusters RENAME TO clusters;

-- Rename indexes
ALTER INDEX IF EXISTS idx_manual_photo_clusters_listing 
  RENAME TO idx_clusters_listing;

ALTER INDEX IF EXISTS idx_manual_photo_clusters_room_type 
  RENAME TO idx_clusters_room_type;

ALTER INDEX IF EXISTS idx_manual_photo_clusters_visibility 
  RENAME TO idx_clusters_visibility;

-- Update table comment
COMMENT ON TABLE clusters IS 'Production photo clusters (auto-clustering output). Single source of truth for all clustering data.';

-- Update column comments
COMMENT ON COLUMN clusters.cluster_name IS 'AI-generated cluster names (e.g., "Kitchen", "Bedroom 1", "Living Room")';
COMMENT ON COLUMN clusters.visibility_mappings IS 
'Stage 4 visibility format: {visibility_mappings: [{photo_url, cluster_name, visible_clusters: [names], visibility_details}], cluster_adjacency: {cluster_name: [adjacent_names]}}.
Uses cluster names directly (no ID lookups needed).';

COMMENT ON COLUMN clusters.selected_photo_url IS 'Best photo selected by R1 for renovation visualization';

