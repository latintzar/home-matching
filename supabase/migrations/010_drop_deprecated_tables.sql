-- Migration: Drop Deprecated Tables
-- Date: 2025-10-27
-- Purpose: Remove deprecated tables that are no longer used

-- 1. Drop idealista_info_extraction (replaced by text_analysis_results)
-- Verification: Checked - no foreign keys pointing to this table
DROP TABLE IF EXISTS idealista_info_extraction CASCADE;

-- 2. Drop room_clusters (replaced by manual_photo_clusters)
-- Verification: Checked - no foreign keys pointing to this table
DROP TABLE IF EXISTS room_clusters CASCADE;

-- 3. Drop image_clusters (not used)
-- Verification: Checked - no foreign keys pointing to this table
DROP TABLE IF EXISTS image_clusters CASCADE;

-- 4. Drop segmentation_masks (not used in current pipeline)
-- Verification: Checked - no foreign keys pointing to this table
DROP TABLE IF EXISTS segmentation_masks CASCADE;

-- Add comment to remind about cleanup
DO $$
BEGIN
  RAISE NOTICE 'Successfully dropped deprecated tables: idealista_info_extraction, room_clusters, image_clusters, segmentation_masks';
END $$;

