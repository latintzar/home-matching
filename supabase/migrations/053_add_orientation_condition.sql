-- Add orientation and property_condition columns to listings table

ALTER TABLE listings ADD COLUMN IF NOT EXISTS orientation TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS property_condition TEXT;

-- Add comments
COMMENT ON COLUMN listings.orientation IS 'Orientation of the property (e.g., Exterior, Interior, North, South)';
COMMENT ON COLUMN listings.property_condition IS 'Condition of the property (e.g., good, renew, new_development)';

