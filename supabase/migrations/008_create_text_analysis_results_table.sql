-- Migration: Create text_analysis_results table
-- This table stores the results of the A1-C2 text analysis pipeline
-- Each phase (a1_context, a2_facts, , etc.) gets its own row

CREATE TABLE IF NOT EXISTS text_analysis_results (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  results JSONB NOT NULL,
  status TEXT DEFAULT 'completed',
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one result per listing per phase
  UNIQUE(listing_id, phase)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_text_analysis_results_listing_id ON text_analysis_results(listing_id);
CREATE INDEX IF NOT EXISTS idx_text_analysis_results_phase ON text_analysis_results(phase);
CREATE INDEX IF NOT EXISTS idx_text_analysis_results_created_at ON text_analysis_results(created_at);

-- Enable RLS on new table
ALTER TABLE text_analysis_results ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Service role can manage text_analysis_results" ON text_analysis_results
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read text_analysis_results" ON text_analysis_results
  FOR SELECT USING (auth.role() = 'authenticated');

-- Add a comment to document the table
COMMENT ON TABLE text_analysis_results IS 'Text analysis pipeline results - stores A1-C2 phase results for each listing';

