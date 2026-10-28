-- Domain Credibility Cache
-- Stores credibility scores for domains to avoid re-computation

CREATE TABLE IF NOT EXISTS public.domain_credibility_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etld1 TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  source_url TEXT,
  credibility TEXT NOT NULL CHECK (credibility IN ('high', 'medium-high', 'medium', 'medium-low', 'low', 'unknown')),
  method TEXT NOT NULL,
  matched_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ttl_sec INTEGER NOT NULL DEFAULT 7776000, -- 90 days
  expires_at TIMESTAMPTZ,
  notes TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_domain_cred_cache_expires 
  ON public.domain_credibility_cache (expires_at);

CREATE INDEX IF NOT EXISTS idx_domain_cred_cache_domain 
  ON public.domain_credibility_cache (domain);

ALTER TABLE public.domain_credibility_cache ENABLE ROW LEVEL SECURITY;

-- Public can view
CREATE POLICY "Public can view domain credibility cache" 
  ON public.domain_credibility_cache 
  FOR SELECT 
  USING (true);

-- Service role can manage
CREATE POLICY "Service role can manage domain credibility cache" 
  ON public.domain_credibility_cache 
  FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role');

