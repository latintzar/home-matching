-- Create index on reference_number to speed up deduplication checks
-- We use a raw index on the text column. 
-- In the future, if we store normalized refs, we might want a functional index,
-- but for now the application logic handles normalization before query.

CREATE INDEX IF NOT EXISTS idx_listings_reference_number 
ON listings(reference_number);

-- Optional: Comment explaining the index usage
COMMENT ON INDEX idx_listings_reference_number IS 'Used for Level 2 Deduplication (Reference Match) in ingestion pipeline';

