-- Migration: T6 Calibrated Scope Storage
-- Creates table for storing T6's revised final scope (budget-calibrated)
-- Date: 2025-11-08

-- Final Renovation Scope Calibrated: Stores T6's budget-calibrated revision of N's final scope
CREATE TABLE IF NOT EXISTS final_renovation_scope_calibrated (
  id BIGSERIAL PRIMARY KEY,
  listing_id TEXT NOT NULL, -- Match final_renovation_scope table structure (TEXT, not BIGINT)
  scope_data JSONB NOT NULL, -- FinalRenovationScope (same structure as final_renovation_scope)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT final_renovation_scope_calibrated_listing_id_unique UNIQUE (listing_id)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_final_renovation_scope_calibrated_listing_id 
  ON final_renovation_scope_calibrated (listing_id);

-- Comment for documentation
COMMENT ON TABLE final_renovation_scope_calibrated IS 'T6: Budget-calibrated revision of N''s final scope. Contains revised work items, cost, time, permits with budget adjustments applied. This is what goes to UI for display.';

-- Enable RLS
ALTER TABLE final_renovation_scope_calibrated ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public can view, service role can manage
CREATE POLICY "Public can view final_renovation_scope_calibrated" 
  ON final_renovation_scope_calibrated 
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage final_renovation_scope_calibrated" 
  ON final_renovation_scope_calibrated 
  FOR ALL USING (auth.role() = 'service_role');

