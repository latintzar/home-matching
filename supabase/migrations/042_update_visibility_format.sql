-- Migration 042: Update Visibility Format to Stage 4 Format
-- Purpose: Update visibility_mappings column to use Stage 4 format (names, not IDs)
-- Format: {visibility_mappings: [{photo_url, cluster_name, visible_clusters: [names], visibility_details}], cluster_adjacency: {...}}

-- Update column comment to reflect new format
COMMENT ON COLUMN manual_photo_clusters.visibility_mappings IS 
'Stage 4 visibility format: {visibility_mappings: [{photo_url, cluster_name, visible_clusters: [names], visibility_details}], cluster_adjacency: {cluster_name: [adjacent_names]}}.
Uses cluster names directly (no ID lookups needed).';

-- Note: Existing data will need to be migrated via promotion endpoint
-- This migration only updates the documentation/comment

