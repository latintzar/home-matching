# Database access boundaries

The sample app uses its local authored workspace. The retained Supabase migration sequence is a historical schema, with recipient-owned database commissioning recorded separately.

## Forward policy hardening

Apply the dated `202611010001_` migration after reconciling the existing schema in your own database. Review the target tables and their role grants first. This source change has not been applied to a hosted customer database.

The household profile keeps the original `auth.uid() = user_id` read/write policies from `006_user_profiles_auth.sql`. The later unconditional public profile policies are removed; anonymous access is revoked. The internal listing map is writable by `service_role` only. A session-only historical profile table without a reconciled `user_id` remains closed until the recipient establishes its authenticated ownership mapping. Existing profile rows need a verified owner mapping before enabling browser access.

## Acceptance

Run `python3 tools/test-database-policies.py` with Docker available. The security regression script replays the forward migration against synthetic fixtures matching the affected historical policies in an isolated PostgreSQL instance with synthetic roles and records. It verifies anonymous denial, own-user profile isolation, service writes and intended shared reads. This tests the stated policies and idempotent hardening; it is separate from a complete empty-database bootstrap or proof of an existing hosted Supabase configuration. A recipient should test two authenticated households plus `anon` and its backend service role against the reconciled schema.

Keep the service-role credential in the private backend. A browser anon key identifies a public client; authorization comes from the actual database grants, row policies and authenticated ownership checks.
