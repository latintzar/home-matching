-- Browser events preserve anonymous/null actors and verified per-user identity.
-- Apply after the retained historical migrations on PostgreSQL 15 or newer.
BEGIN;
DO $hardening$
BEGIN
  IF to_regclass('public.analytics_events') IS NOT NULL THEN
    ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow anonymous event inserts" ON public.analytics_events;
    DROP POLICY IF EXISTS "Users can view own events" ON public.analytics_events;
    DROP POLICY IF EXISTS "Anonymous events have no user identity" ON public.analytics_events;
    DROP POLICY IF EXISTS "Authenticated events use own identity" ON public.analytics_events;
    REVOKE ALL ON TABLE public.analytics_events FROM PUBLIC, anon, authenticated;
    GRANT INSERT ON TABLE public.analytics_events TO anon;
    GRANT SELECT, INSERT ON TABLE public.analytics_events TO authenticated;
    GRANT ALL ON TABLE public.analytics_events TO service_role;
    CREATE POLICY "Anonymous events have no user identity" ON public.analytics_events
      FOR INSERT TO anon WITH CHECK (user_id IS NULL);
    CREATE POLICY "Authenticated events use own identity" ON public.analytics_events
      FOR INSERT TO authenticated WITH CHECK (user_id IS NULL OR user_id = auth.uid());
    CREATE POLICY "Users can view own events" ON public.analytics_events
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF to_regprocedure('public.track_event(uuid,text,jsonb,text,text)') IS NOT NULL THEN
    -- The retained helper is SECURITY DEFINER; its API owner supplies the actor.
    REVOKE ALL ON FUNCTION public.track_event(uuid,text,jsonb,text,text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.track_event(uuid,text,jsonb,text,text) TO service_role;
    ALTER FUNCTION public.track_event(uuid,text,jsonb,text,text) SET search_path = public, pg_temp;
  END IF;
  IF to_regclass('public.funnel_signup_to_viewing') IS NOT NULL THEN
    ALTER VIEW public.funnel_signup_to_viewing SET (security_invoker = true);
    REVOKE ALL ON TABLE public.funnel_signup_to_viewing FROM PUBLIC, anon, authenticated;
    GRANT SELECT ON TABLE public.funnel_signup_to_viewing TO authenticated, service_role;
  END IF;
END
$hardening$;
COMMIT;
