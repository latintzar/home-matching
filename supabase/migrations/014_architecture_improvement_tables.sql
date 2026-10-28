-- Architecture Improvement: New Tables
-- Creates tables for improved diagnostic to prescriptive pipeline

-- Whole Property Analysis
CREATE TABLE IF NOT EXISTS public.whole_property_analysis (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  analysis_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whole_property_analysis_listing_id_unique UNIQUE (listing_id)
);

-- Room Analyses (array of room analyses)
CREATE TABLE IF NOT EXISTS public.room_analyses (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  analysis_data JSONB NOT NULL, -- Array of RoomAnalysis
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT room_analyses_listing_id_unique UNIQUE (listing_id)
);

-- Room Bullets (buyer-friendly bullets per room)
CREATE TABLE IF NOT EXISTS public.room_bullets (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  bullets_data JSONB NOT NULL, -- Array of RoomBullets
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT room_bullets_listing_id_unique UNIQUE (listing_id)
);

-- Research Aggregated Results (canonical tier evidence map)
CREATE TABLE IF NOT EXISTS public.research_aggregated_results (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('estandar', 'optimo', 'plus')),
  aggregated_data JSONB NOT NULL, -- AggregatedResearchResults
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT research_aggregated_results_listing_tier_unique UNIQUE (listing_id, tier)
);

-- Final Renovation Scope (UI-ready tiers)
CREATE TABLE IF NOT EXISTS public.final_renovation_scope (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  scope_data JSONB NOT NULL, -- FinalRenovationScope
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT final_renovation_scope_listing_id_unique UNIQUE (listing_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_whole_property_analysis_listing_id 
  ON public.whole_property_analysis (listing_id);

CREATE INDEX IF NOT EXISTS idx_room_analyses_listing_id 
  ON public.room_analyses (listing_id);

CREATE INDEX IF NOT EXISTS idx_room_bullets_listing_id 
  ON public.room_bullets (listing_id);

CREATE INDEX IF NOT EXISTS idx_research_aggregated_results_listing_id 
  ON public.research_aggregated_results (listing_id);

CREATE INDEX IF NOT EXISTS idx_research_aggregated_results_tier 
  ON public.research_aggregated_results (tier);

CREATE INDEX IF NOT EXISTS idx_final_renovation_scope_listing_id 
  ON public.final_renovation_scope (listing_id);

-- Comments
COMMENT ON TABLE public.whole_property_analysis IS 'Stores whole property photo analysis with 8 lenses';
COMMENT ON TABLE public.room_analyses IS 'Stores room-by-room photo analyses (array)';
COMMENT ON TABLE public.room_bullets IS 'Stores buyer-friendly room bullets (4-7 per room)';
COMMENT ON TABLE public.research_aggregated_results IS 'Stores aggregated research results per tier (canonical evidence map)';
COMMENT ON TABLE public.final_renovation_scope IS 'Stores UI-ready final renovation scope with refined pricing/timeline/permits';

-- Enable RLS
ALTER TABLE public.whole_property_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_bullets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_aggregated_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.final_renovation_scope ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public can view, service role can manage
CREATE POLICY "Public can view whole_property_analysis" 
  ON public.whole_property_analysis 
  FOR SELECT 
  USING (true);

CREATE POLICY "Service role can manage whole_property_analysis" 
  ON public.whole_property_analysis 
  FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Public can view room_analyses" 
  ON public.room_analyses 
  FOR SELECT 
  USING (true);

CREATE POLICY "Service role can manage room_analyses" 
  ON public.room_analyses 
  FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Public can view room_bullets" 
  ON public.room_bullets 
  FOR SELECT 
  USING (true);

CREATE POLICY "Service role can manage room_bullets" 
  ON public.room_bullets 
  FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Public can view research_aggregated_results" 
  ON public.research_aggregated_results 
  FOR SELECT 
  USING (true);

CREATE POLICY "Service role can manage research_aggregated_results" 
  ON public.research_aggregated_results 
  FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Public can view final_renovation_scope" 
  ON public.final_renovation_scope 
  FOR SELECT 
  USING (true);

CREATE POLICY "Service role can manage final_renovation_scope" 
  ON public.final_renovation_scope 
  FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role');

