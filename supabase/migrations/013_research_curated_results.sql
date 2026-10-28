-- Research Curated Results
-- Stores curated and summarized research snippets by category

CREATE TABLE IF NOT EXISTS public.research_curated_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id TEXT NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  key_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  representative_snippets JSONB NOT NULL DEFAULT '[]'::jsonb,
  sources_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_level TEXT NOT NULL CHECK (confidence_level IN ('high', 'medium', 'low')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_curated_listing 
  ON public.research_curated_results (listing_id);

CREATE INDEX IF NOT EXISTS idx_research_curated_category 
  ON public.research_curated_results (category);

ALTER TABLE public.research_curated_results ENABLE ROW LEVEL SECURITY;

-- Public can view
CREATE POLICY "Public can view research curated results" 
  ON public.research_curated_results 
  FOR SELECT 
  USING (true);

-- Service role can manage
CREATE POLICY "Service role can manage research curated results" 
  ON public.research_curated_results 
  FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role');

