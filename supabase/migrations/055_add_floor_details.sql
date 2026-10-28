ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS floor_number INTEGER,
ADD COLUMN IF NOT EXISTS floor_level TEXT; -- 'ground', 'mezzanine', 'intermediate', 'top'

