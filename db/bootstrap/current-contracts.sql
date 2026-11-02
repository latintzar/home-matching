-- Current household/search call paths; dated SQL stays in supabase/migrations.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS operation_type text,
  ADD COLUMN IF NOT EXISTS agency_name text,
  ADD COLUMN IF NOT EXISTS photo_urls text[],
  ADD COLUMN IF NOT EXISTS pipeline_status text;
ALTER TABLE public.room_clusters
  ADD COLUMN IF NOT EXISTS room_type text,
  ADD COLUMN IF NOT EXISTS photo_urls text[];

-- The current source addresses properties from either Supabase or DynamoDB.
-- Household references are opaque text IDs, separate from numeric legacy FKs.
ALTER TABLE public.saved_properties
  ADD COLUMN IF NOT EXISTS fit_score integer,
  ADD COLUMN IF NOT EXISTS fit_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS user_notes text;
ALTER TABLE public.property_notes
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS extracted_signals jsonb;
CREATE TABLE public.user_viewings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id text NOT NULL,
  notes text,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,listing_id)
);
-- Older consumers use these names for the same saved/note workspace.
-- Invoker views preserve the underlying caller's row policies.
CREATE VIEW public.user_notes WITH (security_invoker=true) AS
  SELECT * FROM public.property_notes;
CREATE VIEW public.user_saved_properties WITH (security_invoker=true) AS
  SELECT * FROM public.saved_properties;
CREATE TABLE public.user_preference_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.user_lifestyle_profiles(id) ON DELETE CASCADE,
  source_type text CHECK (source_type IN ('note','followup_call','onboarding','vibe_check','manual')),
  source_id uuid,
  signal_type text NOT NULL CHECK (signal_type IN ('like','dislike','must_have','dealbreaker')),
  category text,
  description text,
  dimension text,
  value text,
  source text,
  raw_text text,
  confidence double precision CHECK (confidence BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_preference_signals_user ON public.user_preference_signals(user_id,created_at);
ALTER TABLE public.user_lifestyle_profiles
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS min_area integer,
  ADD COLUMN IF NOT EXISTS dimension_weights jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dimension_thresholds jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dimension_relevance jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS poi_preferences jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS anchors jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS city_familiarity text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS vibe_check_results jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS last_stock_check timestamptz,
  ADD COLUMN IF NOT EXISTS stock_status text DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS last_recommendations_at timestamptz,
  ADD COLUMN IF NOT EXISTS preference_weights jsonb NOT NULL DEFAULT '{}';
-- PostgREST's on_conflict=user_id,profile_type needs an unconditional unique key.
-- NULL user IDs retain PostgreSQL's normal distinct-NULL behavior.
ALTER TABLE public.user_lifestyle_profiles
  ADD CONSTRAINT user_lifestyle_profiles_user_type UNIQUE(user_id,profile_type);

CREATE TABLE public.deepdive_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id bigint REFERENCES public.listings(id) ON DELETE CASCADE,
  source_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Signup creates the source's free subscription and profile as one DB operation.
CREATE FUNCTION public.initialize_home_account() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  INSERT INTO public.user_profiles(id,email,role,full_name)
    VALUES(NEW.id,coalesce(NEW.email,''),
      CASE WHEN NEW.raw_user_meta_data->>'role'='professional' THEN 'professional' ELSE 'renter_buyer' END,
      NEW.raw_user_meta_data->>'full_name')
    ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.subscriptions(user_id,plan_id,status)
    VALUES(NEW.id,'free','active') ON CONFLICT(user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER initialize_home_account AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.initialize_home_account();
