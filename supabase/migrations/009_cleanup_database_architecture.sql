-- Migration: Clean Database Architecture
-- This migration implements the clean 3-table architecture:
-- 1. text_analysis_results (A1-C2 text analysis pipeline)
-- 2. photo_analysis_results (photo analysis pipeline) 
-- 3. idealista_info_extraction (deprecated legacy table)

-- Step 1: Rename analysis_results to photo_analysis_results for clarity
ALTER TABLE analysis_results RENAME TO photo_analysis_results;

-- Step 2: Update indexes to reflect new table name
DROP INDEX IF EXISTS idx_analysis_results_listing_id;
DROP INDEX IF EXISTS idx_analysis_results_analysis_type;
DROP INDEX IF EXISTS idx_analysis_results_created_at;

CREATE INDEX IF NOT EXISTS idx_photo_analysis_results_listing_id ON photo_analysis_results(listing_id);
CREATE INDEX IF NOT EXISTS idx_photo_analysis_results_analysis_type ON photo_analysis_results(analysis_type);
CREATE INDEX IF NOT EXISTS idx_photo_analysis_results_created_at ON photo_analysis_results(created_at);

-- Step 3: Update RLS policies for new table name
DROP POLICY IF EXISTS "Allow public read access to analysis_results" ON photo_analysis_results;
DROP POLICY IF EXISTS "Allow service role full access to analysis_results" ON photo_analysis_results;

CREATE POLICY "Allow public read access to photo_analysis_results" ON photo_analysis_results
    FOR SELECT USING (true);

CREATE POLICY "Allow service role full access to photo_analysis_results" ON photo_analysis_results
    FOR ALL USING (auth.role() = 'service_role');

-- Step 4: Update trigger function name
ALTER FUNCTION update_analysis_results_updated_at() RENAME TO update_photo_analysis_results_updated_at;

-- Step 5: Update trigger
DROP TRIGGER IF EXISTS trigger_update_analysis_results_updated_at ON photo_analysis_results;
CREATE TRIGGER trigger_update_photo_analysis_results_updated_at
    BEFORE UPDATE ON photo_analysis_results
    FOR EACH ROW
    EXECUTE FUNCTION update_photo_analysis_results_updated_at();

-- Step 6: Add clear documentation comments
COMMENT ON TABLE photo_analysis_results IS 'Photo analysis pipeline results - stores whole-property, by-cluster, and integrated analysis results';
COMMENT ON TABLE text_analysis_results IS 'Text analysis pipeline results - stores A1-C2 phase results (a1_context, a2_facts, , etc.)';
COMMENT ON TABLE idealista_info_extraction IS 'DEPRECATED: Legacy table from old Text Analysis pipeline. Use text_analysis_results instead.';

-- Step 7: Remove the broken migration 007 reference
-- (The nl_mining_results table never existed, so no cleanup needed)

-- Step 8: Add table purpose documentation
COMMENT ON COLUMN photo_analysis_results.analysis_type IS 'Type of analysis: whole-property, by-cluster, or integrated';
COMMENT ON COLUMN text_analysis_results.phase IS 'Analysis phase: a1_context, a2_facts, , b2_merge, b3_snippets, b4_headlines, c1_unknowns, c2_followups';


