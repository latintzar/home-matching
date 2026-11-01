# Configured API access

Home Matching has two explicit runtime modes. The native sample uses visitor-scoped local SQLite records and the included property examples. Configured mode connects the recipient’s own Supabase project and service providers.

## Set up the installation operator

1. Apply the recipient schema and its forward security migrations as described in [Setup](setup.md) and [Database security](database-security.md).
2. Sign in through your own Supabase project and obtain that account’s UUID from `auth.getUser().data.user.id`.
3. Save the project’s database credentials and operator UUID in the same private runtime file. `NEXT_PUBLIC_BASE_URL` is the exact browser application origin, such as `https://home.example.com`.

```sh
install -d -m 700 "$HOME/.config/home-matching"
python3 tools/runtime-env.py configure \
  --file "$HOME/.config/home-matching/runtime.env" --capability database
python3 tools/runtime-env.py configure \
  --file "$HOME/.config/home-matching/runtime.env" --capability operator
python3 tools/runtime-env.py doctor \
  --file "$HOME/.config/home-matching/runtime.env"
```

The operator capability saves `HOME_MATCHING_OPERATOR_USER_ID` and `NEXT_PUBLIC_BASE_URL`. The UUID is a server-owned role assignment. Identity is verified by Supabase with the public anon key, then compared with this assignment. Provider keys and Supabase service-role keys stay in the server’s private runtime configuration. `doctor` reports field-presence booleans; `configure` uses hidden terminal input.

Use the selected file for full-app commands:

```sh
python3 tools/runtime-env.py run \
  --file "$HOME/.config/home-matching/runtime.env" -- npm run dev
```

## Roles

| Caller | Scope |
| --- | --- |
| Native sample visitor | The declared sample API and the visitor’s own local records. |
| Verified household user | Saved properties, notes, viewings, settings, voice profile context/update, analytics and the user’s own billing account. |
| Verified installation operator | Retained property processing, AI/image generation, ingestion, analysis, backoffice and other provider tools. |
| Scheduled job | `/api/cron/*` with the recipient’s configured cron secret. |
| Stripe callback | `/api/stripe/webhook` with the recipient’s valid Stripe signature. |

The twelve household API paths are listed in [configured-api.ts](../src/lib/security/configured-api.ts). Their handlers bind private reads and writes to the provider-verified user ID. Bearer authentication keeps the caller’s token on the anon-key/RLS data client; browser sessions use the recipient’s Supabase cookies. Supabase’s `getUser` verifies identity against its auth service. A supplied `X-User-Id`, cookie user object or client-visible development flag is ordinary input rather than a role assignment.

Other retained API paths, including future additions, use the installation-operator boundary. Configure the operator UUID to use those tools. Adding a provider key supplies transport credentials; the operator assignment supplies permission to invoke it. Extending a provider workflow to household accounts requires explicit project-party and spend authorization before adding it to the household path set.

## Browser and agent requests

Browser mutations originate at `NEXT_PUBLIC_BASE_URL` and use their authenticated session. Agent/API clients send the signed-in user’s access token as `Authorization: Bearer …`. Keep that token in the recipient’s secret store and pass it through the client’s protected credential mechanism.

Household JSON requests have a 32 KiB limit. Operator requests have a 10 MiB limit, including image-upload JSON. The Stripe callback limit is 1 MiB. Origin and size checks run before provider work.

## Cron and Stripe

Save a cron secret of at least 32 characters through the `communications` capability and configure the scheduler to send `Authorization: Bearer …`. Every retained cron handler requires this secret. Stripe uses `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` from the recipient’s account. The webhook verifies the raw body’s cryptographic signature before privileged database access.

The privileged database constructor is explicitly named `createServiceClient`. Its callers are operator workflows or verified Stripe handlers. User-record clients remain bound to their verified session.

## Verify

```sh
node tools/test-configured-api-auth.mjs
npx tsc --noEmit
python3 -m unittest discover -s tests -p 'test_runtime_env.py'
```

The offline suite compiles the actual middleware and selected route handlers and uses real `NextRequest` objects, the actual Supabase SDK and Stripe’s signature verifier. A fake owned auth/database transport checks verified identities and query ownership. It denies outbound sockets and makes zero provider or hosted-database calls.

Coverage includes anonymous admission across all 183 retained API routes, forged bearer/cookie identities, operator permission, body/origin limits, mandatory cron authentication, signed Stripe callbacks, and direct image/deepdive/profile rejection. Real notes GET/POST requests show that forged body/query user IDs produce records for the verified caller through the caller’s anon/RLS token. SAMPLE_MODE retains its existing guest session and provider boundary.
