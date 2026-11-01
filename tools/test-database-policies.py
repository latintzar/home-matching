"""Execute retained-policy regression against a task-owned isolated Postgres."""
from pathlib import Path
import subprocess,time,json,uuid
ROOT=Path(__file__).resolve().parents[1];name='atelier-rls-audit-'+uuid.uuid4().hex[:8]
subprocess.run(['docker','run','--detach','--rm','--name',name,'--network','none','--memory','256m','--cpus','1','--pids-limit','128','-e','POSTGRES_HOST_AUTH_METHOD=trust','--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,size=192m','--tmpfs','/var/run/postgresql:rw,noexec,nosuid,size=16m','postgres:16-alpine'],check=True,stdout=subprocess.DEVNULL)
def sql(text,ok=True):
 p=subprocess.run(['docker','exec','-i',name,'psql','-X','-U','postgres','-v','ON_ERROR_STOP=1','-qAt'],input=text,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if ok and p.returncode:raise AssertionError(p.stderr)
 if not ok and not p.returncode:raise AssertionError('Expected database denial')
 return p.stdout.strip(),p.stderr
try:
 for _ in range(100):
  if 'PostgreSQL init process complete' in subprocess.check_output(['docker','logs',name],text=True,stderr=subprocess.STDOUT) and subprocess.run(['docker','exec',name,'pg_isready','-U','postgres'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
  time.sleep(.1)
 else:raise AssertionError('Isolated Postgres failed startup')
 sql('''CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE SQL STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
''')
 sql(''' CREATE TABLE public.user_lifestyle_profiles(id bigint primary key,user_id uuid,phone_number text);
 ALTER TABLE public.user_lifestyle_profiles ENABLE ROW LEVEL SECURITY;
 GRANT ALL ON public.user_lifestyle_profiles TO anon,authenticated,service_role;
 CREATE POLICY "Users can read own lifestyle profile" ON public.user_lifestyle_profiles FOR SELECT USING(auth.uid()=user_id);
 CREATE POLICY "Users can insert own lifestyle profile" ON public.user_lifestyle_profiles FOR INSERT WITH CHECK(auth.uid()=user_id);
 CREATE POLICY "Users can update own lifestyle profile" ON public.user_lifestyle_profiles FOR UPDATE USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);
 CREATE POLICY "Public profiles read" ON public.user_lifestyle_profiles FOR SELECT USING(true);
 CREATE POLICY "Public profiles insert" ON public.user_lifestyle_profiles FOR INSERT WITH CHECK(true);
 CREATE POLICY "Public profiles update" ON public.user_lifestyle_profiles FOR UPDATE USING(true);
 INSERT INTO public.user_lifestyle_profiles VALUES(1,'11111111-1111-1111-1111-111111111111','synthetic-A'),(2,'22222222-2222-2222-2222-222222222222','synthetic-B');
 CREATE TABLE public.listing_map(id int);ALTER TABLE public.listing_map ENABLE ROW LEVEL SECURITY;GRANT ALL ON public.listing_map TO anon,authenticated,service_role;
 CREATE POLICY "Service role full access map" ON public.listing_map FOR ALL USING(true)WITH CHECK(true);
 ''')
 # Demonstrate the historical broad policy really admits both households.
 before,_=sql("SET ROLE anon; SELECT count(*) FROM public.user_lifestyle_profiles;");assert before=='2'
 migration=(ROOT/'supabase/migrations/202611010001_private_profile_policies.sql').read_text();sql(migration);sql(migration)
 sql('SET ROLE anon;SELECT * FROM public.user_lifestyle_profiles;',ok=False)
 own,_=sql("SET ROLE authenticated;SET request.jwt.claim.sub='11111111-1111-1111-1111-111111111111';SELECT count(*) FROM public.user_lifestyle_profiles;");assert own=='1'
 other,_=sql("SET ROLE authenticated;SET request.jwt.claim.sub='11111111-1111-1111-1111-111111111111';UPDATE public.user_lifestyle_profiles SET phone_number='synthetic-change' WHERE id=2 RETURNING id;");assert not other
 sql('SET ROLE anon;INSERT INTO public.listing_map VALUES(1);',ok=False);sql('SET ROLE authenticated;INSERT INTO public.listing_map VALUES(1);',ok=False);sql('SET ROLE service_role;INSERT INTO public.listing_map VALUES(1);')
 # Exercise the actual retained analytics DDL, including its SECURITY DEFINER RPC.
 sql((ROOT/'supabase/migrations/067_analytics_events.sql').read_text())
 sql("GRANT ALL ON public.analytics_events TO anon,authenticated,service_role; GRANT SELECT ON public.funnel_signup_to_viewing TO anon,authenticated,service_role;")
 # The original public RPC can claim another person's identity regardless of RLS.
 before_rpc,_=sql("SET ROLE anon;SELECT public.track_event('22222222-2222-2222-2222-222222222222','synthetic-spoof');")
 assert before_rpc
 sql("INSERT INTO public.analytics_events(user_id,event_name)VALUES('11111111-1111-1111-1111-111111111111','synthetic-owned');")
 migration=(ROOT/'supabase/migrations/202611010002_analytics_actor_policies.sql').read_text();sql(migration);sql(migration)
 sql("SET ROLE anon;INSERT INTO public.analytics_events(user_id,event_name)VALUES(NULL,'synthetic-anonymous');")
 sql("SET ROLE anon;INSERT INTO public.analytics_events(user_id,event_name)VALUES('11111111-1111-1111-1111-111111111111','synthetic-impersonation');",ok=False)
 sql("SET ROLE authenticated;SET request.jwt.claim.sub='11111111-1111-1111-1111-111111111111';INSERT INTO public.analytics_events(user_id,event_name)VALUES('11111111-1111-1111-1111-111111111111','synthetic-own-event');")
 sql("SET ROLE authenticated;SET request.jwt.claim.sub='11111111-1111-1111-1111-111111111111';INSERT INTO public.analytics_events(user_id,event_name)VALUES('22222222-2222-2222-2222-222222222222','synthetic-other-event');",ok=False)
 sql("SET ROLE anon;SELECT public.track_event('22222222-2222-2222-2222-222222222222','synthetic-rpc-spoof');",ok=False)
 sql("SET ROLE authenticated;SELECT public.track_event('22222222-2222-2222-2222-222222222222','synthetic-rpc-spoof');",ok=False)
 sql("SET ROLE service_role;SELECT public.track_event('22222222-2222-2222-2222-222222222222','synthetic-trusted-api');")
 sql('SET ROLE anon;SELECT * FROM public.funnel_signup_to_viewing;',ok=False)
 funnel,_=sql("SET ROLE authenticated;SET request.jwt.claim.sub='11111111-1111-1111-1111-111111111111';SELECT user_id FROM public.funnel_signup_to_viewing;")
 assert funnel=='11111111-1111-1111-1111-111111111111'
 result={'project':'home-matching','engine':'PostgreSQL16-alpine','network':'none','synthetic_roles_only':True,'historical_policy_leak_reproduced':True,'own_user_isolation':True,'anonymous_access_denied':True,'service_writes':True,'idempotent_forward_migrations':True,'existing_hosted_db_touched':False,'anonymous_analytics_preserved':True,'analytics_actor_spoofing_denied':True,'public_definer_rpc_denied':True,'funnel_view_uses_caller_rls':True};print(json.dumps(result))
finally:subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
