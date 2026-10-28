-- Text Analysis tables from reformia/supabase/migrations/007_complete_pipeline_schema.sql
-- Create idealista_info_extraction table for Text Analysis pipeline
CREATE TABLE IF NOT EXISTS idealista_info_extraction (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  raw_compact_input TEXT NOT NULL,
  sentences JSONB,
  claims JSONB,
  claim_batches JSONB,
  b1_batch_results JSONB,
  merged_categories JSONB,
  category_snippets JSONB,
  headlines JSONB,
  unknowns_checklist JSONB,
  contextual_followups JSONB,
  debug_markdown TEXT,
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_idealista_info_extraction_listing_id ON idealista_info_extraction(listing_id);
CREATE INDEX IF NOT EXISTS idx_idealista_info_extraction_created_at ON idealista_info_extraction(created_at);

-- Enable RLS on new table
ALTER TABLE idealista_info_extraction ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Service role can manage idealista_info_extraction" ON idealista_info_extraction
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read idealista_info_extraction" ON idealista_info_extraction
  FOR SELECT USING (auth.role() = 'authenticated');
