# Setup

## Local first result

Use Node 22.18+ in the Node 22 line and Python 3.10+. From the root, run `npm ci`, `python3 tools/sample-app.py build`, then `python3 tools/sample-app.py start`. Open http://127.0.0.1:3000. `python3 tools/sample-app.py dev` runs the same application in development.

The sample command explicitly selects local guest storage and clears inherited provider/cloud configuration. It rejects private dotenv files in the checkout. Eight authored listings, stored analysis and recovered generated images populate the original dashboard, recommendations, property, saved, viewing and profile screens. [Native workspace](native-workspace.md) describes its API and isolation contract.

Build and start with the same optional `--base-path /apps/home-matching`; a reverse proxy preserves that prefix. Use `--state-dir` for an absolute private directory outside source/static roots, and `--port`/`--hostname` for the listener. The standalone artifact in `.next/standalone` contains its own launcher, public files and required dependencies; deploy that artifact instead of the build dependency tree.

## Recipient configuration

Create a private directory outside the checkout:

```sh
install -d -m 700 "$HOME/.config/home-matching"
python3 tools/runtime-env.py configure --file "$HOME/.config/home-matching/runtime.env" --capability database
python3 tools/runtime-env.py doctor --file "$HOME/.config/home-matching/runtime.env"
```

`configure` reads hidden terminal input. `doctor` prints field-presence booleans. A recipient can populate the same mode-0600 file through their own secret store; each supported field uses `NAME=value` on one line. Values remain private to that runtime file and selected process.

| Capability | Configuration | Execution owner |
|---|---|---|
| Database/auth | `NEXT_PUBLIC_SUPABASE_URL`, public anon key, `SUPABASE_SERVICE_ROLE_KEY` | Recipient Supabase project and policies |
| Property analysis | `GEMINI_API_KEY` or the source’s Google API aliases | Recipient Google project |
| Vertex routes | project, location and explicit credential file | Recipient Google Cloud project |
| Catalogue/cache | explicit AWS access key, secret, optional session token and region | Recipient AWS account |
| Maps/location | Geoapify, Maps or Mapbox fields; own Nominatim URL where used | Recipient provider and data grant |
| Voice | ElevenLabs server API key and recipient agent IDs | Recipient ElevenLabs workspace |
| Scraping | Scrapfly or Scrapingdog key | Recipient provider and site permissions |
| Billing/communications | Stripe, Resend, WhatsApp, cron fields | Recipient service accounts |

Run a selected full-app command through that file:

```sh
python3 tools/runtime-env.py run --file "$HOME/.config/home-matching/runtime.env" -- npm run dev -- --hostname 127.0.0.1
```

The helper clears inherited credentials and cloud profiles; AWS metadata is disabled and Google ADC has a deliberate unconfigured-file guard. An explicitly selected Google credential file replaces that guard. NEXT_PUBLIC fields are browser-visible build inputs. Supabase service roles, Google/ElevenLabs API keys and cloud credentials belong in server-only fields.

## Full application

The root package retains the original Next application and server routes. Fresh root installation, full Next build and TypeScript checks pass in local sample mode. Optional cloud clients initialize when their selected feature runs, so building the full application works before provider configuration. The isolated `starter/` retains its smaller independent lockfile. See [status](../RELEASE-STATUS.md).

Provision a fresh recipient Supabase project from the retained SQL only after reviewing migration order, auth/RLS, storage and missing preexisting schema. The repository is a historical sequence of migrations rather than a demonstrated empty-database bootstrap. `src/scripts/aws/create-dynamodb-tables.ts` and the retained infrastructure code describe part of the AWS schema; review the actual table/index/key contract for each activated service before applying it.

The full product includes two distinguishable WPA cache consumers. `lib/wpa/cache.ts` uses a composite listing/mode key, a photo-URL fingerprint and 30-day TTL. `/api/wpa/score` performs a direct listing-key cache lookup. Reconcile the selected table schema for the chosen route; treating those contracts as identical would hide an original integration gap.

Use the retained `agent_configs/` prompts and tool schemas to commission owned voice agents. Provider identities and original origins are cleared or replaced with reserved examples. Review workflow references, tool endpoints, signed-session authorization and provider account limits before importing them. [Voice notes](../agent_configs/README.md) explain the retained versions.

Activate recipient integrations individually after reviewing authorization, rate limits, data rights, model support and provider acceptance. Sample mode exposes an allowlist of local workspace APIs and returns a setup response for provider-backed routes.
