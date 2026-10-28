-- 🚜 The Harvest Engine - Database Schema

-- 1. Scraping Rules (The Brain)
-- Stores learned CSS selectors and regex patterns for each domain
CREATE TABLE IF NOT EXISTS scraping_rules (
  domain TEXT PRIMARY KEY,          -- e.g., 'savills.com' (normalized, no www)
  
  -- The Rules (JSON structure matches Cheerio logic)
  -- Structure: { 
  --   "list_container": ".property-list",
  --   "item_selector": ".property-card",
  --   "link_selector": "a.details-link",
  --   "fields": { "price": ".price", "title": "h3" } 
  -- }
  selectors JSONB,
  
  -- Metadata
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'broken', 'learning', 'deprecated')),
  confidence_score FLOAT DEFAULT 0.0, -- 0.0 to 1.0
  
  -- Stats
  successful_runs INT DEFAULT 0,
  last_success TIMESTAMP WITH TIME ZONE,
  failure_count INT DEFAULT 0,
  last_failure TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  
  -- Versioning
  version INT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Harvest Queue (The ToDo List)
-- Manages daily crawling schedule for 1000+ domains
CREATE TABLE IF NOT EXISTS harvest_queue (
  id BIGSERIAL PRIMARY KEY,
  
  -- Target
  domain TEXT NOT NULL REFERENCES scraping_rules(domain),
  seed_url TEXT NOT NULL,           -- The "All Properties" or "New Listings" page
  
  -- Scheduling
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Default to "run now"
  schedule_interval INTERVAL DEFAULT '24 hours',
  
  -- Execution State
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'paused')),
  retry_count INT DEFAULT 0,
  
  -- Priority (1=Standard, 10=High Value)
  priority INT DEFAULT 1,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for speed
CREATE INDEX IF NOT EXISTS idx_harvest_queue_next_run ON harvest_queue(next_run) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_harvest_queue_domain ON harvest_queue(domain);

-- RLS Policies (Admin Only for now)
ALTER TABLE scraping_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE harvest_queue ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for API/Cron)
CREATE POLICY "Service role full access rules" ON scraping_rules
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access queue" ON harvest_queue
  USING (true) WITH CHECK (true);

