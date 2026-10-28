-- Research Search Results table for Google Search grounding
-- Stores search queries and their results for property analysis

CREATE TABLE IF NOT EXISTS public.research_search_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  snippet TEXT,
  display_link TEXT,
  rank INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_research_search_results_listing_id 
  ON public.research_search_results(listing_id);

CREATE INDEX IF NOT EXISTS idx_research_search_results_created_at 
  ON public.research_search_results(created_at);

-- Enable RLS
ALTER TABLE public.research_search_results ENABLE ROW LEVEL SECURITY;

-- Public can view research search results
CREATE POLICY "Public can view research search results" 
  ON public.research_search_results 
  FOR SELECT 
  USING (true);

-- Only service role can insert/update/delete
CREATE POLICY "Service role can manage research search results" 
  ON public.research_search_results 
  FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role');

