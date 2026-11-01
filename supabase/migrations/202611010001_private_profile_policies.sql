-- Forward hardening for the retained Supabase schema. Apply after existing migrations.
-- Browser profiles use the auth.uid()/user_id policies from 006_user_profiles_auth.sql.
BEGIN;
DO $hardening$
BEGIN
  IF to_regclass('public.user_lifestyle_profiles') IS NOT NULL THEN
    ALTER TABLE public.user_lifestyle_profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public profiles read" ON public.user_lifestyle_profiles;
    DROP POLICY IF EXISTS "Public profiles insert" ON public.user_lifestyle_profiles;
    DROP POLICY IF EXISTS "Public profiles update" ON public.user_lifestyle_profiles;
    REVOKE ALL ON TABLE public.user_lifestyle_profiles FROM anon;
    -- Existing own-user policies remain. A historical session-only schema without
    -- user_id stays closed until the recipient reconciles its ownership schema.
  END IF;
  IF to_regclass('public.listing_map') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role full access map" ON public.listing_map;
    CREATE POLICY "Service role full access map" ON public.listing_map
      FOR ALL TO service_role USING (true) WITH CHECK (true);
    REVOKE INSERT, UPDATE, DELETE ON TABLE public.listing_map FROM anon, authenticated;
  END IF;
END
$hardening$;
COMMIT;
