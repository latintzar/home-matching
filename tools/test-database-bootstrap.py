#!/usr/bin/env python3
"""Replay the fresh household schema and privacy contracts in isolated PostgreSQL16."""
from pathlib import Path
import json
import re
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
NAME = "home-bootstrap-" + uuid.uuid4().hex[:12]
A = "11111111-1111-1111-1111-111111111111"
B = "22222222-2222-2222-2222-222222222222"


def sql(text, allowed=True):
    result = subprocess.run(["docker","exec","-i",NAME,"psql","-X","-U","postgres","-v","ON_ERROR_STOP=1","-qAt"],input=text,text=True,capture_output=True)
    if allowed and result.returncode: raise AssertionError(result.stderr)
    if not allowed and not result.returncode: raise AssertionError("Expected database refusal")
    return result.stdout.strip()


def caller(identity):
    return "SET ROLE authenticated;SET request.jwt.claim.sub='" + identity + "';"


def main():
    subprocess.run(["python3",str(ROOT/"tools/build-database-bootstrap.py"),"--check"],check=True)
    subprocess.run(["docker","run","--detach","--rm","--name",NAME,"--network","none","--memory","384m","--cpus","1","--pids-limit","128","-e","POSTGRES_HOST_AUTH_METHOD=trust","--tmpfs","/var/lib/postgresql/data:rw,noexec,nosuid,size=256m","--tmpfs","/var/run/postgresql:rw,noexec,nosuid,size=16m","postgres:16-alpine"],check=True,stdout=subprocess.DEVNULL)
    try:
        for _ in range(150):
            logs=subprocess.check_output(["docker","logs",NAME],text=True,stderr=subprocess.STDOUT)
            ready=subprocess.run(["docker","exec",NAME,"pg_isready","-U","postgres"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            if "PostgreSQL init process complete" in logs and ready.returncode==0: break
            time.sleep(.1)
        else: raise AssertionError("Disposable database did not become ready")
        sql("""CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
          CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
          CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
          CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
          CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_user::text$$;
          GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
          CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
          CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text,metadata jsonb);
          CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$SELECT string_to_array($1,'/')$$;
        """)
        bootstrap=(ROOT/"db/bootstrap.sql").read_text()
        sql("CREATE EXTENSION hstore WITH SCHEMA public;")
        extension_acl=sql("SELECT coalesce(proacl::text,'default') FROM pg_proc WHERE oid='public.hstore(text,text)'::regprocedure;")
        sql(bootstrap);sql(bootstrap,allowed=False)
        assert sql("SELECT coalesce(proacl::text,'default') FROM pg_proc WHERE oid='public.hstore(text,text)'::regprocedure;")==extension_acl
        sql("INSERT INTO auth.users(id,email,raw_user_meta_data)VALUES('"+A+"','household-a@example.test','{\"full_name\":\"Household A\"}'),('"+B+"','household-b@example.test','{\"full_name\":\"Household B\"}');")
        assert sql("SELECT count(*) FROM public.user_profiles;")=="2"
        assert sql("SELECT count(*) FROM public.subscriptions WHERE plan_id='free' AND status='active';")=="2"
        for identity in [A,B]:
            sql(caller(identity)+"INSERT INTO public.user_lifestyle_profiles(user_id,profile_type,life_profile,lifestyle_dna,property_constraints,trade_off_matrix,adults,budget_max)VALUES('"+identity+"','renter','{}','{}','{}','{}',1,1500) ON CONFLICT(user_id,profile_type)DO UPDATE SET budget_max=excluded.budget_max;")
            # Both numeric legacy and harvested IDs are valid in household collections.
            for listing in ["1000000001","example.test_house_7"]:
                sql(caller(identity)+"INSERT INTO public.saved_properties(user_id,listing_id,profile_type)VALUES('"+identity+"','"+listing+"','renter');")
            sql(caller(identity)+"INSERT INTO public.property_notes(user_id,listing_id,note_type,content,profile_type)VALUES('"+identity+"','example.test_house_7','text','Authored note','renter');")
            sql(caller(identity)+"INSERT INTO public.user_viewings(user_id,listing_id,notes)VALUES('"+identity+"','example.test_house_7','Authored viewing');")
        assert sql(caller(A)+"SELECT count(*) FROM public.user_lifestyle_profiles;")=="1"
        assert sql(caller(A)+"SELECT count(*) FROM public.user_saved_properties;")=="2"
        assert sql(caller(A)+"SELECT count(*) FROM public.user_notes;")=="1"
        note=sql(caller(A)+"SELECT id FROM public.user_notes;")
        sql(caller(A)+"UPDATE public.user_notes SET processed_at=now(),extracted_signals='[]' WHERE id='"+note+"';")
        sql(caller(A)+"INSERT INTO public.user_preference_signals(user_id,source_type,source_id,signal_type,category,description,confidence)VALUES('"+A+"','note','"+note+"','like','light','Authored signal',0.8);")
        assert sql(caller(B)+"SELECT count(*) FROM public.user_preference_signals;")=="0"
        sql("SET ROLE anon;SELECT * FROM public.user_lifestyle_profiles;",allowed=False)
        sql("SET ROLE anon;SELECT * FROM public.user_notes;",allowed=False)
        sql(caller(A)+"INSERT INTO public.saved_properties(user_id,listing_id)VALUES('"+B+"','foreign-owner');",allowed=False)
        assert sql(caller(A)+"UPDATE public.property_notes SET content='foreign edit' WHERE user_id='"+B+"' RETURNING id;")==""
        sql(caller(A)+"UPDATE public.user_profiles SET stripe_customer_id='authored-reserved' WHERE id='"+A+"';",allowed=False)
        sql(caller(A)+"UPDATE public.user_profiles SET role='professional' WHERE id='"+A+"';",allowed=False)
        sql(caller(A)+"UPDATE public.user_lifestyle_profiles SET subscription_status='active' WHERE user_id='"+A+"';",allowed=False)
        sql(caller(A)+"INSERT INTO public.subscriptions(user_id,plan_id,status)VALUES('"+A+"','enterprise','active');",allowed=False)
        # Reproduce the retained pro-client policies before testing the forward fix.
        sql("SET ROLE service_role;INSERT INTO public.pro_clients(pro_user_id,name,email,shortlist_token,intake_token)VALUES('"+A+"','Client A','client-a@example.test','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab'),('"+B+"','Client B','client-b@example.test','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbc');")
        sql("INSERT INTO public.pro_link_requests(pro_client_id,pro_user_id,client_user_id,client_email)SELECT id,'"+A+"','"+B+"','household-b@example.test' FROM public.pro_clients WHERE pro_user_id='"+A+"';")
        sql(caller(B)+"UPDATE public.pro_link_requests SET pro_user_id='"+B+"';",allowed=False)
        sql(caller(B)+"UPDATE public.pro_link_requests SET status='approved';",allowed=False)
        historical=(ROOT/"supabase/migrations/064_pro_clients.sql").read_text()
        policies=re.findall(r'CREATE POLICY "Public access via (?:shortlist|intake) token".*?;',historical,re.S)
        assert len(policies)==2;sql("\n".join(policies)+"\nGRANT SELECT ON public.pro_clients TO anon;")
        assert sql("SET ROLE anon;SELECT count(*) FROM public.pro_clients;")=="2"
        forward=(ROOT/"supabase/migrations/202611020001_private_pro_clients.sql").read_text();sql(forward);sql(forward)
        sql("SET ROLE anon;SELECT * FROM public.pro_clients;",allowed=False)
        assert sql(caller(A)+"SELECT count(*) FROM public.pro_clients;")=="1"
        assert sql(caller(B)+"SELECT count(*) FROM public.pro_clients WHERE shortlist_token='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';")=="0"
        assert sql("SET ROLE service_role;SELECT name FROM public.pro_clients WHERE shortlist_token='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';")=="Client A"
        assert sql("SET ROLE service_role;SELECT name FROM public.pro_clients WHERE intake_token='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab';")=="Client A"
        assert sql("SET ROLE service_role;SELECT count(*) FROM public.pro_clients WHERE shortlist_token='unknown-token' OR intake_token='unknown-token';")=="0"
        # Public definer functions cannot bypass caller privacy in the fresh profile.
        sql(caller(A)+"SELECT * FROM public.get_user_profiles('"+B+"');",allowed=False)
        sql("SET ROLE anon;SELECT public.track_event('"+A+"','spoof');",allowed=False)
        sql("SET ROLE anon;INSERT INTO public.analytics_events(user_id,event_name)VALUES(NULL,'authored-anonymous');")
        sql("SET ROLE anon;INSERT INTO public.analytics_events(user_id,event_name)VALUES('"+A+"','spoof');",allowed=False)
        sql(caller(A)+"INSERT INTO public.analytics_events(user_id,event_name)VALUES('"+B+"','spoof');",allowed=False)
        print(json.dumps({"engine":"PostgreSQL16","network":"none","fresh_bootstrap":True,"existing_project_refused":True,"signup_profile_and_free_plan":True,"merged_uuid_profile":True,"numeric_and_harvested_saved_ids":True,"note_view_and_signal_uuid_contract":True,"two_household_isolation":True,"reserved_billing_columns_protected":True,"historical_pro_client_enumeration_reproduced":True,"forward_migration_idempotent":True,"two_pro_isolation":True,"anon_enumeration_denied":True,"backend_token_equality_selection":True,"public_share_api_implemented":False,"hosted_databases_touched":False}))
    finally:
        subprocess.run(["docker","rm","-f",NAME],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)


if __name__=="__main__":main()
