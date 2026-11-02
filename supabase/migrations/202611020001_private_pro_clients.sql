-- A non-null sharing token identifies a record, not a caller's authorization.
-- A future public share/intake must validate its exact token in a bounded backend.
BEGIN;
DROP POLICY IF EXISTS "Public access via shortlist token" ON public.pro_clients;
DROP POLICY IF EXISTS "Public access via intake token" ON public.pro_clients;
DROP POLICY IF EXISTS "Pros can manage own clients" ON public.pro_clients;
CREATE POLICY "Pros can manage own clients" ON public.pro_clients
  FOR ALL TO authenticated
  USING (pro_user_id = auth.uid())
  WITH CHECK (pro_user_id = auth.uid());
REVOKE ALL ON public.pro_clients FROM PUBLIC,anon;
GRANT ALL ON public.pro_clients TO service_role;
COMMIT;
