-- Core tables from reformia/supabase/schema.sql
-- Listings table
CREATE TABLE IF NOT EXISTS listings (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  postal_code TEXT,
  country TEXT DEFAULT 'Spain',
  price_eur DECIMAL(12, 2) NOT NULL,
  bedrooms INTEGER,
  bathrooms DECIMAL(3, 1),
  sqm INTEGER,
  lot_sqm INTEGER,
  property_type TEXT,
  listing_status TEXT DEFAULT 'active',
  lat DECIMAL(10, 7),
  lng DECIMAL(10, 7),
  description TEXT,
  year_built INTEGER,
  reference_number TEXT UNIQUE,
  source_url TEXT,
  scraped_property_id TEXT,
  scraped_at TIMESTAMPTZ,
  scraped_data JSONB DEFAULT '{}',
  processing_status TEXT DEFAULT 'pending',
  has_elevator BOOLEAN,
  has_terrace BOOLEAN,
  has_parking BOOLEAN,
  has_storage BOOLEAN,
  has_pool BOOLEAN,
  has_air_conditioning BOOLEAN,
  furnished BOOLEAN,
  pets_allowed BOOLEAN,
  last_reform INTEGER,
  energy_rating TEXT,
  property_condition TEXT,
  orientation TEXT,
  floor_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Listing photos
CREATE TABLE IF NOT EXISTS listing_photos (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Renovation scenarios (stores complete renovation data as JSONB)
CREATE TABLE IF NOT EXISTS listing_renovations (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT REFERENCES listings(id) ON DELETE CASCADE UNIQUE,
  renovation_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permit notes
CREATE TABLE IF NOT EXISTS permit_notes (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT REFERENCES listings(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Practical lessons
CREATE TABLE IF NOT EXISTS lessons (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT REFERENCES listings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Favorites (device-based, no auth required)
CREATE TABLE IF NOT EXISTS favorites (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT REFERENCES listings(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, device_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_listings_reference ON listings(reference_number);
CREATE INDEX IF NOT EXISTS idx_listings_scraped_property_id ON listings(scraped_property_id);
CREATE INDEX IF NOT EXISTS idx_listings_processing_status ON listings(processing_status);
CREATE INDEX IF NOT EXISTS idx_listing_photos_listing ON listing_photos(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_renovations_listing ON listing_renovations(listing_id);
CREATE INDEX IF NOT EXISTS idx_permit_notes_listing ON permit_notes(listing_id);
CREATE INDEX IF NOT EXISTS idx_lessons_listing ON lessons(listing_id);
CREATE INDEX IF NOT EXISTS idx_favorites_listing ON favorites(listing_id);
CREATE INDEX IF NOT EXISTS idx_favorites_device ON favorites(device_id);

-- Enable Row Level Security (RLS)
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_renovations ENABLE ROW LEVEL SECURITY;
ALTER TABLE permit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Public read access policies (no auth required)
CREATE POLICY "Public listings read" ON listings FOR SELECT USING (true);
CREATE POLICY "Public photos read" ON listing_photos FOR SELECT USING (true);
CREATE POLICY "Public renovations read" ON listing_renovations FOR SELECT USING (true);
CREATE POLICY "Public permits read" ON permit_notes FOR SELECT USING (true);
CREATE POLICY "Public lessons read" ON lessons FOR SELECT USING (true);
CREATE POLICY "Public favorites read" ON favorites FOR SELECT USING (true);
CREATE POLICY "Public favorites insert" ON favorites FOR INSERT WITH CHECK (true);
CREATE POLICY "Public favorites delete" ON favorites FOR DELETE USING (true);
