-- Migration 039: Clusters Normalized View
-- Purpose: Create database view that pre-joins clusters with furniture-free photos
-- and normalizes visibility mappings (cluster IDs -> cluster names)
-- This eliminates runtime normalization logic duplication across endpoints

-- Function to normalize visibility mappings (Stage 4 format -> consumer format)
-- Stage 4 format: {visibility_mappings: [{photo_url, cluster_name, visible_clusters: [names], visibility_details}], cluster_adjacency: {...}}
-- Consumer format: {photo_url: {visible_rooms: [names]}}
CREATE OR REPLACE FUNCTION normalize_visibility_mappings(
  p_visibility_mappings JSONB,
  p_listing_id BIGINT
)
RETURNS JSONB AS $$
DECLARE
  normalized JSONB := '{}'::JSONB;
  visibility_mappings_array JSONB;
  mapping_item JSONB;
  photo_url TEXT;
  visible_clusters JSONB;
  visible_room_names TEXT[];
BEGIN
  -- Extract visibility_mappings array from Stage 4 format
  visibility_mappings_array := p_visibility_mappings->'visibility_mappings';
  
  -- If old format (legacy), return empty (will be migrated via promotion)
  IF visibility_mappings_array IS NULL THEN
    RETURN '{}'::JSONB;
  END IF;
    
  -- Iterate through each visibility mapping
  FOR mapping_item IN SELECT * FROM jsonb_array_elements(visibility_mappings_array)
  LOOP
    photo_url := mapping_item->>'photo_url';
    visible_clusters := mapping_item->'visible_clusters';
    
    IF photo_url IS NOT NULL AND visible_clusters IS NOT NULL THEN
      -- Extract visible cluster names (already in name format, no ID lookup needed)
      visible_room_names := ARRAY(
        SELECT jsonb_array_elements_text(visible_clusters)
      );
    
      -- Store normalized mapping: photo_url -> visible_rooms
    normalized := normalized || jsonb_build_object(
      photo_url,
      jsonb_build_object('visible_rooms', to_jsonb(visible_room_names))
    );
    END IF;
  END LOOP;
  
  RETURN normalized;
END;
$$ LANGUAGE plpgsql;

-- View that joins clusters with furniture-free photos and normalizes visibility mappings
CREATE OR REPLACE VIEW clusters_normalized AS
SELECT 
  c.id AS cluster_id,
  c.listing_id,
  c.cluster_name,
  c.room_type,
  c.display_order,
  c.created_at,
  c.updated_at,
  
  -- Original photo URLs (from cluster)
  c.photo_urls AS original_photo_urls,
  
  -- Furniture-free photo URLs (mapped from original, same order)
  ARRAY(
    SELECT COALESCE(ff.furniture_free_url, photo_url)
    FROM unnest(c.photo_urls) AS photo_url
    LEFT JOIN listing_photos_furniture_free ff 
      ON ff.original_photo_url = photo_url 
      AND ff.listing_id = c.listing_id::TEXT
    ORDER BY array_position(c.photo_urls, photo_url)
  ) AS furniture_free_photo_urls,
  
  -- Normalized visibility mappings (cluster IDs -> cluster names)
  -- Cast listing_id to BIGINT for function call
  normalize_visibility_mappings(
    COALESCE(c.visibility_mappings, '{}'::JSONB),
    c.listing_id::BIGINT
  ) AS visibility_mappings_normalized,
  
  -- Original visibility mappings (for reference)
  c.visibility_mappings AS visibility_mappings_original,
  
  -- Selected photo URL (from R1)
  c.selected_photo_url,
  
  -- Selected photo furniture-free URL (if selected_photo_url exists)
  (
    SELECT ff.furniture_free_url
    FROM listing_photos_furniture_free ff
    WHERE ff.original_photo_url = c.selected_photo_url
      AND ff.listing_id = c.listing_id::TEXT
    LIMIT 1
  ) AS selected_photo_furniture_free_url

FROM manual_photo_clusters c;

-- Add comments
COMMENT ON VIEW clusters_normalized IS 
'Normalized view of clusters with furniture-free URLs and visibility mappings (IDs -> names). 
Use this view instead of manual_photo_clusters for analysis endpoints.';

COMMENT ON FUNCTION normalize_visibility_mappings IS 
'Normalizes Stage 4 visibility format to consumer format. 
Input: {visibility_mappings: [{photo_url, visible_clusters: [names]}], cluster_adjacency: {...}}
Output: {photo_url: {visible_rooms: [names]}}
Uses cluster names directly (no ID lookups needed).';

-- Add indexes for performance (if they don't already exist)
CREATE INDEX IF NOT EXISTS idx_clusters_normalized_listing 
ON manual_photo_clusters(listing_id);

CREATE INDEX IF NOT EXISTS idx_furniture_free_photos_composite 
ON listing_photos_furniture_free(listing_id, original_photo_url);

