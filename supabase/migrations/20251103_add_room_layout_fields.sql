-- Add canonical room layout consistency fields to room_analyses
DO $$ BEGIN
  ALTER TABLE room_analyses
    ADD COLUMN IF NOT EXISTS canonical_layout_json JSONB,
    ADD COLUMN IF NOT EXISTS element_boxes_json JSONB,
    ADD COLUMN IF NOT EXISTS camera_angles_json JSONB,
    ADD COLUMN IF NOT EXISTS consensus_score NUMERIC;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'room_analyses table not found; skipping migration';
END $$;


