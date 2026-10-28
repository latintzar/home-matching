-- Add pipeline checkpoints column to listings table
ALTER TABLE listings ADD COLUMN pipeline_checkpoints JSONB DEFAULT '{}';

-- Add index for better performance
CREATE INDEX idx_listings_pipeline_checkpoints ON listings USING GIN (pipeline_checkpoints);

-- Add comment for documentation
COMMENT ON COLUMN listings.pipeline_checkpoints IS 'Stores checkpoint data for each pipeline step (scrapfly, photos, a1, a2, etc.)';
