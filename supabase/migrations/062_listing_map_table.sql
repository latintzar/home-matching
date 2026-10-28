
-- 🚜 The Harvest Engine - Phase 2: Mapping Layer

-- 3. Listing Map (The Ammo Dump)
-- Lightweight storage for millions of listing URLs without payload
-- This allows "Observation Mode" to run for free daily.
CREATE TABLE IF NOT EXISTS listing_map (
  url TEXT PRIMARY KEY,             -- Normalized URL (SSOT)
  domain TEXT NOT NULL REFERENCES scraping_rules(domain),
  
  -- Discovery Metadata
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Status Flow
  status TEXT DEFAULT 'discovered' CHECK (status IN ('discovered', 'queued', 'ingested', 'gone', 'ignored')),
  
  -- Minimal signals we get for free during crawling (from link text or sitemap)
  price_signal NUMERIC,             -- If sitemap/link text has price
  title_signal TEXT,                -- Link text
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for speed
CREATE INDEX IF NOT EXISTS idx_listing_map_domain ON listing_map(domain);
CREATE INDEX IF NOT EXISTS idx_listing_map_first_seen ON listing_map(first_seen);
CREATE INDEX IF NOT EXISTS idx_listing_map_status ON listing_map(status);

-- RLS
ALTER TABLE listing_map ENABLE ROW LEVEL SECURITY;

-- Service Role Policy
CREATE POLICY "Service role full access map" ON listing_map
  USING (true) WITH CHECK (true);

