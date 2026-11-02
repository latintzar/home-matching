# Database access boundaries

The sample app uses its local authored workspace. New connected installations use the [fresh household/search database](fresh-database.md), with explicit household ownership and service-only research writes. Dated migrations retain the historical schema and earlier policy definitions.

## Forward policy hardening

Apply the dated `202611010001_` migration after reconciling the existing schema in your own database. Review the target tables and their role grants first. This source change has not been applied to a hosted customer database.

The household profile keeps the original `auth.uid() = user_id` read/write policies from `006_user_profiles_auth.sql`. The later unconditional public profile policies are removed; anonymous access is revoked. The internal listing map is writable by `service_role` only. A session-only historical profile table without a reconciled `user_id` remains closed until the recipient establishes its authenticated ownership mapping. Existing profile rows need a verified owner mapping before enabling browser access.

## Acceptance

Run `python3 tools/test-database-policies.py` with Docker available. The security regression script replays the forward migration against synthetic fixtures matching the affected historical policies in an isolated PostgreSQL instance with synthetic roles and records. It verifies anonymous denial, own-user profile isolation, service writes and intended shared reads. This tests the stated policies and idempotent hardening; it is separate from a complete empty-database bootstrap or proof of an existing hosted Supabase configuration. A recipient should test two authenticated households plus `anon` and its backend service role against the reconciled schema.

Keep the service-role credential in the private backend. A browser anon key identifies a public client; authorization comes from the actual database grants, row policies and authenticated ownership checks.

## Professional clients

For an existing installation, review and apply `202611020001_private_pro_clients.sql`. It removes the original `shortlist_token IS NOT NULL` and `intake_token IS NOT NULL` public policies. Professional users keep access to their own client records; anonymous table enumeration is revoked. The current app contains no public token-bearing share/intake API, so the migration preserves its implemented contract. A future public share must validate an exact capability token through a bounded backend or RPC and return the intended fields.

`tools/test-database-bootstrap.py` reintroduces the actual historical policy statements against synthetic records, reproduces enumeration and then verifies the forward migration twice, anonymous denial, two professional owners, and backend valid/invalid token-equality selection. This is source-schema evidence; existing hosted policies remain unverified.

## Analytics identity

Apply `202611010002_analytics_actor_policies.sql` after the retained migrations on PostgreSQL15+. Browser analytics keeps anonymous events with a null user ID; authenticated events use their own ID or a null identity. The retained `track_event` SECURITY DEFINER helper is callable by the service role, which supplies the verified actor. The funnel view uses the caller’s row policies.

The isolated regression reproduces the historical public-RPC impersonation, then proves anonymous null events, authenticated own-user events, trusted service writes, RPC restrictions and per-user view results. Hosted schema state remains unverified.
