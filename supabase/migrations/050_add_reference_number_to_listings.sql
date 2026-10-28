ALTER TABLE listings ADD COLUMN IF NOT EXISTS reference_number TEXT;

-- Add a comment to the column
COMMENT ON COLUMN listings.reference_number IS 'External reference number for the listing (e.g. from the agency or portal)';

