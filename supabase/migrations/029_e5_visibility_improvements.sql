-- Migration: E5 Visibility Improvements
-- Adds enhanced visibility tracking columns to photo_pov table
-- Date: 2025-11-08

-- Add new columns for enhanced visibility detection
ALTER TABLE photo_pov 
  ADD COLUMN IF NOT EXISTS camera_perspective JSONB,
  ADD COLUMN IF NOT EXISTS not_visible_in_room JSONB;

-- Update comments
COMMENT ON COLUMN photo_pov.camera_perspective IS 'Enhanced camera perspective data: { angle, height, focal_point }';
COMMENT ON COLUMN photo_pov.not_visible_in_room IS 'Elements that should be in room but are NOT visible: [{ element, element_id, reason }]';
COMMENT ON COLUMN photo_pov.visible_in_room IS 'Enhanced visibility tracking: [{ element, element_id, element_type, surface, prominence, visibility_status, notes }]';

-- Update existing visible_in_room structure comment
COMMENT ON COLUMN photo_pov.visible_adjacent_rooms IS 'Enhanced adjacent rooms: [{ room_id, room_name, elements_visible, element_ids }]';

