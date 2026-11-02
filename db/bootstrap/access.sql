-- Fresh configured app: service writes research; authenticated households own data.
-- Historical policies remain in dated files; these grants are the fresh profile.
DO $access$
DECLARE item record; policy record;
BEGIN
  FOR item IN SELECT tablename FROM pg_tables WHERE schemaname='public'
    AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass
      AND d.objid=format('public.%I',tablename)::regclass AND d.deptype='e') LOOP
    FOR policy IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=item.tablename LOOP
      EXECUTE format('DROP POLICY %I ON public.%I',policy.policyname,item.tablename);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',item.tablename);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',item.tablename);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',item.tablename);
  END LOOP;
END;
$access$;
DO $objects$
DECLARE item record;
BEGIN
  FOR item IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
    AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',item.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',item.signature);
  END LOOP;
  FOR item IN SELECT c.oid::regclass AS name FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S'
    AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e') LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC,anon,authenticated',item.name);
    EXECUTE format('GRANT ALL ON SEQUENCE %s TO service_role',item.name);
  END LOOP;
END;
$objects$;

DO $owners$
DECLARE tab text; owner_column text; columns text; sequence_name text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['user_profiles','user_lifestyle_profiles','saved_properties',
    'property_notes','property_views','user_viewings','user_preferences','user_preference_signals'] LOOP
    owner_column := CASE WHEN tab='user_profiles' THEN 'id' ELSE 'user_id' END;
    EXECUTE format('CREATE POLICY own_records ON public.%I FOR ALL TO authenticated USING(%I=auth.uid()) WITH CHECK(%I=auth.uid())',tab,owner_column,owner_column);
    EXECUTE format('GRANT SELECT,DELETE ON public.%I TO authenticated',tab);
    -- Provider billing identifiers and entitlements are server-maintained.
    SELECT string_agg(quote_ident(column_name),',' ORDER BY ordinal_position) INTO columns
      FROM information_schema.columns WHERE table_schema='public' AND table_name=tab
        AND column_name NOT LIKE 'stripe\_%' ESCAPE '\'
        AND column_name NOT LIKE 'subscription\_%' ESCAPE '\'
        AND column_name NOT IN ('role','is_admin','is_pro','permissions','entitlements','plan_id','subscription_plan');
    EXECUTE format('GRANT INSERT(%s),UPDATE(%s) ON public.%I TO authenticated',columns,columns,tab);
    sequence_name := NULL;
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=tab AND column_name='id') THEN
      sequence_name := pg_get_serial_sequence(format('public.%I',tab),'id');
    END IF;
    IF sequence_name IS NOT NULL THEN
      EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE %s TO authenticated',sequence_name);
    END IF;
  END LOOP;
END;
$owners$;

-- Profile names used by retained read/process consumers are caller-RLS views.
GRANT SELECT,UPDATE ON public.user_notes TO authenticated;
GRANT SELECT ON public.user_saved_properties TO authenticated;
GRANT ALL ON public.user_notes,public.user_saved_properties TO service_role;

-- Property research is readable after sign-in; only backend workflows write it.
DO $research$
DECLARE tab text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['listings','listing_photos','listing_renovations','permit_notes',
    'lessons','room_clusters','text_analysis_results','whole_property_analysis','room_analyses',
    'deepdives','intelligent_consideraciones','agents'] LOOP
    EXECUTE format('CREATE POLICY signed_in_research ON public.%I FOR SELECT TO authenticated USING(true)',tab);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',tab);
  END LOOP;
END;
$research$;

CREATE POLICY own_subscriptions ON public.subscriptions FOR SELECT TO authenticated USING(user_id=auth.uid());
GRANT SELECT ON public.subscriptions TO authenticated;
-- The original auth callback may establish only its own free starting row.
CREATE POLICY own_free_subscription ON public.subscriptions FOR INSERT TO authenticated
  WITH CHECK(user_id=auth.uid() AND plan_id='free' AND status='active'
    AND stripe_customer_id IS NULL AND stripe_subscription_id IS NULL);
GRANT INSERT(user_id,plan_id,status) ON public.subscriptions TO authenticated;

CREATE POLICY own_daily_recommendations ON public.daily_recommendations FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY own_daily_recommendation_response ON public.daily_recommendations FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
GRANT SELECT,UPDATE(viewed_at,reaction) ON public.daily_recommendations TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_recommendation_viewed(uuid),public.react_to_recommendation(uuid,text) TO authenticated;

CREATE POLICY own_explanations ON public.user_property_explanations FOR SELECT TO authenticated USING(user_id=auth.uid());
GRANT SELECT ON public.user_property_explanations TO authenticated;
CREATE POLICY own_vibe_sessions ON public.vibe_check_sessions FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY own_vibe_feedback ON public.vibe_check_feedback FOR ALL TO authenticated
  USING(EXISTS(SELECT 1 FROM public.vibe_check_sessions s WHERE s.id=session_id AND s.user_id=auth.uid()))
  WITH CHECK(EXISTS(SELECT 1 FROM public.vibe_check_sessions s WHERE s.id=session_id AND s.user_id=auth.uid()));
GRANT SELECT ON public.vibe_check_sessions TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.vibe_check_feedback TO authenticated;

CREATE POLICY own_pro_clients ON public.pro_clients FOR ALL TO authenticated USING(pro_user_id=auth.uid()) WITH CHECK(pro_user_id=auth.uid());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.pro_clients TO authenticated;
CREATE POLICY own_viewings ON public.viewings FOR ALL TO authenticated
  USING(user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.pro_clients c WHERE c.id=pro_client_id AND c.pro_user_id=auth.uid()))
  WITH CHECK(user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.pro_clients c WHERE c.id=pro_client_id AND c.pro_user_id=auth.uid()));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.viewings TO authenticated;
CREATE POLICY participants_read_links ON public.pro_link_requests FOR SELECT TO authenticated
  USING(pro_user_id=auth.uid() OR client_user_id=auth.uid());
-- Link-request mutations remain backend-only until a public consent flow exists.
GRANT SELECT ON public.pro_link_requests TO authenticated;

CREATE POLICY own_matches ON public.user_matches FOR ALL TO authenticated
  USING(EXISTS(SELECT 1 FROM public.user_lifestyle_profiles p WHERE p.id=profile_id AND p.user_id=auth.uid()))
  WITH CHECK(EXISTS(SELECT 1 FROM public.user_lifestyle_profiles p WHERE p.id=profile_id AND p.user_id=auth.uid()));
CREATE POLICY own_match_feedback ON public.match_feedback FOR ALL TO authenticated
  USING(EXISTS(SELECT 1 FROM public.user_matches m JOIN public.user_lifestyle_profiles p ON p.id=m.profile_id WHERE m.id=match_id AND p.user_id=auth.uid()))
  WITH CHECK(EXISTS(SELECT 1 FROM public.user_matches m JOIN public.user_lifestyle_profiles p ON p.id=m.profile_id WHERE m.id=match_id AND p.user_id=auth.uid()));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.user_matches,public.match_feedback TO authenticated;

-- Anonymous measurement carries no user identity; authenticated events bind uid.
CREATE POLICY own_analytics_read ON public.analytics_events FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY own_analytics_insert ON public.analytics_events FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY anonymous_analytics_insert ON public.analytics_events FOR INSERT TO anon WITH CHECK(user_id IS NULL);
GRANT SELECT,INSERT ON public.analytics_events TO authenticated;
GRANT INSERT ON public.analytics_events TO anon;
ALTER VIEW public.funnel_signup_to_viewing SET(security_invoker=true);
REVOKE ALL ON public.funnel_signup_to_viewing FROM PUBLIC,anon;
GRANT SELECT ON public.funnel_signup_to_viewing TO authenticated,service_role;
