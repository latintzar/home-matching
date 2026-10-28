ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS balcony_orientation TEXT, -- 'street', 'back', 'unknown'
ADD COLUMN IF NOT EXISTS terrace_orientation TEXT; -- 'street', 'back', 'unknown'

