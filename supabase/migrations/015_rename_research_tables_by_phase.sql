-- Rename research tables to clearly indicate their phase
-- Analysis phase: analysis_*
-- Renovation phase: renovation_*

-- ============================================
-- ANALYSIS PHASE TABLES
-- ============================================

-- Rename research_curated_results → analysis_curated_results
ALTER TABLE IF EXISTS public.research_curated_results 
  RENAME TO analysis_curated_results;

-- Update indexes
ALTER INDEX IF EXISTS idx_research_curated_listing 
  RENAME TO idx_analysis_curated_listing;
ALTER INDEX IF EXISTS idx_research_curated_category 
  RENAME TO idx_analysis_curated_category;

-- Update policies
DROP POLICY IF EXISTS "Public can view research curated results" ON public.analysis_curated_results;
DROP POLICY IF EXISTS "Service role can manage research curated results" ON public.analysis_curated_results;

CREATE POLICY "Public can view analysis curated results" 
  ON public.analysis_curated_results 
  FOR SELECT 
  USING (true);

CREATE POLICY "Service role can manage analysis curated results" 
  ON public.analysis_curated_results 
  FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Rename research_search_results → analysis_search_results
-- Note: We'll create a new table since renovation also needs search results
-- and they have different metadata structures
CREATE TABLE IF NOT EXISTS public.analysis_search_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id TEXT NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  snippet TEXT,
  display_link TEXT,
  rank INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migrate existing analysis data (where metadata.source is null or doesn't have 'renovation_research')
-- Note: Generate new UUIDs for migrated rows since old table uses BIGINT
INSERT INTO public.analysis_search_results (
  id, listing_id, query, url, title, snippet, display_link, rank, metadata, created_at
)
SELECT 
  uuid_generate_v4() as id,  -- Generate new UUID (old table uses BIGINT)
  listing_id::text,  -- Already TEXT, just cast to be explicit
  query,
  url,
  title,
  snippet,
  display_link,
  rank,
  metadata,
  created_at
FROM public.research_search_results
WHERE (metadata->>'source' IS NULL 
   OR metadata->>'source' != 'renovation_research')
   AND listing_id IS NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_analysis_search_results_listing_id 
  ON public.analysis_search_results(listing_id);

CREATE INDEX IF NOT EXISTS idx_analysis_search_results_created_at 
  ON public.analysis_search_results(created_at);

-- Enable RLS
ALTER TABLE public.analysis_search_results ENABLE ROW LEVEL SECURITY;

-- Public can view
CREATE POLICY "Public can view analysis search results" 
  ON public.analysis_search_results 
  FOR SELECT 
  USING (true);

-- Service role can manage
CREATE POLICY "Service role can manage analysis search results" 
  ON public.analysis_search_results 
  FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- RENOVATION PHASE TABLES
-- ============================================

-- Create renovation_search_results table for renovation phase
CREATE TABLE IF NOT EXISTS public.renovation_search_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id TEXT NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  snippet TEXT,
  display_link TEXT,
  rank INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migrate existing renovation data (where metadata.source = 'renovation_research')
-- Note: Generate new UUIDs for migrated rows since old table uses BIGINT
INSERT INTO public.renovation_search_results (
  id, listing_id, query, url, title, snippet, display_link, rank, metadata, created_at
)
SELECT 
  uuid_generate_v4() as id,  -- Generate new UUID (old table uses BIGINT)
  listing_id::text,  -- Already TEXT, just cast to be explicit
  query,
  url,
  title,
  snippet,
  display_link,
  rank,
  metadata,
  created_at
FROM public.research_search_results
WHERE metadata->>'source' = 'renovation_research'
  AND listing_id IS NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_renovation_search_results_listing_id 
  ON public.renovation_search_results(listing_id);

CREATE INDEX IF NOT EXISTS idx_renovation_search_results_created_at 
  ON public.renovation_search_results(created_at);

CREATE INDEX IF NOT EXISTS idx_renovation_search_results_tier 
  ON public.renovation_search_results((metadata->>'tier'));

CREATE INDEX IF NOT EXISTS idx_renovation_search_results_category 
  ON public.renovation_search_results((metadata->>'category'));

-- Enable RLS
ALTER TABLE public.renovation_search_results ENABLE ROW LEVEL SECURITY;

-- Public can view
CREATE POLICY "Public can view renovation search results" 
  ON public.renovation_search_results 
  FOR SELECT 
  USING (true);

-- Service role can manage
CREATE POLICY "Service role can manage renovation search results" 
  ON public.renovation_search_results 
  FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- CLEANUP: Drop old shared table after migration
-- ============================================
-- Note: Only drop if all data has been migrated successfully
-- Commented out for safety - uncomment after verifying migration

-- DROP TABLE IF EXISTS public.research_search_results CASCADE;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.analysis_search_results IS 'Raw Google search results for analysis phase (property context research)';
COMMENT ON TABLE public.analysis_curated_results IS 'Curated research summaries for analysis phase (15 categories)';
COMMENT ON TABLE public.renovation_search_results IS 'Raw Google search results for renovation phase (tier-specific renovation research)';

