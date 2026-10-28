-- Migration 044: Update clusters_normalized view to use clusters table
-- Purpose: Update view after table rename from manual_photo_clusters to clusters

-- Recreate view with new table name
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
  
  -- Normalized visibility mappings (Stage 4 format -> consumer format)
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

FROM clusters c;

-- Update view comment
COMMENT ON VIEW clusters_normalized IS 
'Normalized view of clusters with furniture-free URLs and visibility mappings (Stage 4 format -> consumer format). 
Use this view instead of clusters table directly for analysis endpoints.';

