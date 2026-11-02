# Fresh database

The native sample opens immediately with its local guest workspace. For your connected installation, use Supabase for household data and legacy numeric listings; use DynamoDB for harvested listings and model caches. These are separate storage contracts in the original app.

## Supabase

Create your own Supabase project and install the PostgreSQL client tools (`psql`). Save its Postgres connection URI through hidden input in a private terminal:

```sh
python3 tools/runtime-env.py configure \
  --file "$HOME/.config/home-matching/database.env" --capability database-admin
python3 tools/runtime-env.py run \
  --file "$HOME/.config/home-matching/database.env" -- \
  python3 tools/bootstrap-database.py
python3 tools/runtime-env.py run \
  --file "$HOME/.config/home-matching/database.env" -- \
  python3 tools/bootstrap-database.py --apply
```

The first bootstrap command checks local inputs. `--apply` installs [db/bootstrap.sql](../db/bootstrap.sql) atomically and refuses an existing application schema. The connection URI stays in libpq's environment, outside process arguments and output. TLS is required by default; an explicit URI SSL setting selects your own local test configuration. The SQL editor can apply the same file.

Then configure the `database` capability in your separate application runtime file: your project URL, browser anon key and server service-role key. Configure your [operator account](configured-api-security.md) before activating provider/admin APIs. Add the application's exact auth redirect origin in your Supabase project's auth configuration, then sign in through the app. A signup trigger creates the user's profile and free subscription.

| Product area | Installed contract |
|---|---|
| Account and intake | UUID user/lifestyle profiles, linked renter/buyer profiles, preferences and onboarding fields. |
| Main property screens | Numeric legacy listings, photographs, agents and listing-wide analysis storage. |
| Saved homes and notes | Text property references accept both legacy and harvested IDs; rows stay with the authenticated household. |
| Viewing history | Both retained viewing interfaces and their current tables. |
| Note processing | UUID note IDs match preference-signal references. Caller-RLS `user_notes` and `user_saved_properties` views connect retained consumers to the same note/save records. |
| Recommendations and feedback | Match records, daily recommendations, notification queue, vibe-check and preference storage. |
| Billing and professional clients | Free starting subscriptions, backend-maintained roles/billing fields, owned client records and participant-readable links. Link mutations stay with the backend while their consent flow is developed. |
| Measurement and ingestion | Actor-bound analytics and the retained harvest queue/rules/map. |

The original migrations contain competing profile definitions, obsolete cleanup branches and retired renovation experiments. This fresh profile selects the current household/search contracts, merges useful profile fields and preserves all original migration bytes. [sources.json](../db/bootstrap/sources.json) records the input order, hashes and each adaptation. Advanced renovation/research/rendering branches retain their original source and schema records; activating one involves its own contract review and provider acceptance.

## DynamoDB

After `npm ci`, [db/dynamodb/manifest.json](../db/dynamodb/manifest.json) lists generated AWS CLI inputs by module. Save your AWS credentials using `tools/runtime-env.py configure --capability aws` in your private runtime file. Choose the tables used by the modules you activate; apply each input with the official AWS CLI:

```sh
node tools/build-dynamodb-schema.mjs --check
python3 tools/runtime-env.py run \
  --file "$HOME/.config/home-matching/runtime.env" -- \
  aws dynamodb create-table --cli-input-json file://db/dynamodb/leo-wpa-cache.json
```

The AWS command creates resources in your selected account. The generator and its `--check` mode perform zero AWS calls. For existing tables, compare their key and index definitions with the input before using them; preserve existing records during an upgrade.

The four current WPA consumers keep their original payloads in separate tables:

| Table | Key | Consumer |
|---|---|---|
| `leo-wpa-cache` | `listing_id` + `wpa_mode`; `city-index` | Fingerprinted, 30-day mode cache in `src/lib/wpa/cache.ts`. |
| `leo-wpa-score-cache` | `listing_id` | `/api/wpa/score` text-to-dimension results. |
| `leo-wpa-shortlist-cache` | `listing_id` | Shortlist-specific vision analysis. |
| `leo-wpa-url-cache` | `listing_url`; `domain-index` | Harvested URL analysis in `src/lib/dynamodb.ts`. |

Earlier code assigned incompatible key/payload shapes to one table. Separate names preserve each algorithm and prevent those records from overwriting one another. Current cache/recommender and harvest inputs are grouped separately. The retained `src/lib/data-adapter/` generation has its own `puedo-casa-*` group; it keeps its distinct point/index contracts. These inputs create empty structures, while your permitted property data and cached model results remain your installation's inputs.

## Verify the installation contract

```sh
python3 tools/build-database-bootstrap.py --check
python3 tools/test-database-bootstrap.py
python3 -m unittest discover -s tests -p test_database_setup.py -v
node tools/build-dynamodb-schema.mjs --check
node --test tests/database/wpa-cache-contracts.test.mjs
```

The PostgreSQL test starts and removes a fresh, network-isolated database with synthetic Supabase auth/storage contracts. It verifies signup, profile upserts, numeric/harvested property IDs, notes/signals, two-household ownership, protected billing fields, two professional owners and the pro-client forward policy fix. Cache tests execute all four real cache implementations against strict local key definitions; provider/model calls are fenced. These are database/client-contract checks, followed by your own Supabase/PostgREST/auth/storage and AWS acceptance.

## Reached boundaries

The current source extracts simple preference signals from notes. Its legacy `recalculateFitScores` function logs the planned recalculation; it supplies a continuation point. The native guest example separately demonstrates the original deterministic ranking over authored evidence.

The old pro-client SQL treated the existence of a sharing token as public read permission. The forward migration [202611020001_private_pro_clients.sql](../supabase/migrations/202611020001_private_pro_clients.sql) removes those broad policies. The current app has an owned professional-client schema and backend token-equality selection is verified; a public token-bearing shortlist/intake API remains a planned module. Existing hosted database policies have separate verification, and this source release applies no hosted migrations.
