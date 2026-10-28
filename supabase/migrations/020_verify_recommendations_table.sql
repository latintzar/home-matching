-- Verify Recommendations Table
-- Stores the "Qué verificar" checklist for property visits

CREATE TABLE IF NOT EXISTS public.verify_recommendations (
  id BIGSERIAL PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  recommendations JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT verify_recommendations_listing_id_unique UNIQUE (listing_id)
);

CREATE INDEX IF NOT EXISTS idx_verify_recommendations_listing_id 
  ON public.verify_recommendations (listing_id);

ALTER TABLE public.verify_recommendations ENABLE ROW LEVEL SECURITY;

-- Public can view
CREATE POLICY "Public can view verify recommendations" 
  ON public.verify_recommendations 
  FOR SELECT 
  USING (true);

-- Service role can manage
CREATE POLICY "Service role can manage verify recommendations" 
  ON public.verify_recommendations 
  FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role');

