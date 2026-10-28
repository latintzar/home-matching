-- Add agent_notes column to listings table
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS agent_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN listings.agent_notes IS 'Notes from the buyer agent about the property, why it fits the client, etc.';

