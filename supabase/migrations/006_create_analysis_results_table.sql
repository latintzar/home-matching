-- Create analysis_results table to store comprehensive property analysis
CREATE TABLE IF NOT EXISTS analysis_results (
    id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL DEFAULT 'integrated',
    analysis_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_analysis_results_listing_id ON analysis_results(listing_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_analysis_type ON analysis_results(analysis_type);
CREATE INDEX IF NOT EXISTS idx_analysis_results_created_at ON analysis_results(created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_analysis_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_analysis_results_updated_at
    BEFORE UPDATE ON analysis_results
    FOR EACH ROW
    EXECUTE FUNCTION update_analysis_results_updated_at();

-- Add RLS policies
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;

-- Allow public read access to analysis results
CREATE POLICY "Allow public read access to analysis_results" ON analysis_results
    FOR SELECT USING (true);

-- Allow service role to insert/update/delete analysis results
CREATE POLICY "Allow service role full access to analysis_results" ON analysis_results
    FOR ALL USING (auth.role() = 'service_role');
