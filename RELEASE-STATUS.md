# Source beta · 2026-10-28

The release contains the original Leo.casa home-search application, server routes, recommender, voice-agent templates, catalogue/geo/harvest infrastructure, migrations, extension source and design specifications, plus a portable first-match entrypoint. Source authority: `latintzar/puedo_casa`, `master`, commit `d461e9556f09ad526030376ab58643298e3a1fc8`.

## Verified locally

- The original deterministic pre-WPA and V2 fit functions run on Node 22.23.2. Three authored homes share the same property/neighborhood evidence across two profiles; the top result changes from courtyard/84 to terrace/90, and the house-share fails its dealbreaker.
- Thirteen scoring/network-fence tests cover profile changes, missing evidence, required thresholds, household hazards, confidence, score bounds and ordering. Nine private-configuration tests cover masking, permissions, link rejection, field validation and account precedence.
- The isolated `starter/` Next build and TypeScript check pass, using the original result renderer and scorer. Chromium switches both profiles at 1600×1000 and 390×844, checks actual ranking/scores, excludes the rejected home, checks overflow and blocks foreign requests. Four actual screenshots and their source hashes are in `docs/assets/`.
- The root and starter lockfiles report zero npm audit findings at preparation time. Root source receives scoped dependency updates; unused DuckDB/PDF/AI scaffold dependencies are removed after reference checks. The original Google/Vertex/ElevenLabs adapters remain.
- Source import/syntax closure and generated symbol navigation are checked. Public-package secret scan and file-hash manifest are recorded in the release handoff.

The UI build reused an existing local dependency installation on the preparation host. The starter has its own reproducible lockfile; fresh `npm ci` is assigned to CI. The full root package was resolved and audited with lockfile-only operations, within host disk constraints.

## Recipient integration acceptance

The full root application’s fresh dependency installation/build, empty-account Supabase bootstrap/RLS, AWS tables/indexes, catalogue acquisition, cache schema reconciliation, model/photo analysis, measured commute, voice account/tool import, microphone permission, payments and outbound communication remain separate acceptance tasks. Preparation made zero model, paid provider, cloud-write or communication calls.

Two cache generations coexist: the generic cache service uses listing/mode keys with a photo fingerprint/TTL, while the score route uses a listing-only direct lookup. The scorer currently consumes four neighborhood contributions; the historical 20-dimension geo model is broader. The full product’s dashboard also retains an explicitly mocked random fit badge; the portable first-result route instead displays actual V2 scores. These boundaries are visible in source and [workflows](docs/workflows.md).

Original account bindings, credential literals and dotenv discovery paths are neutralized in this derivative. Diagnostic/test routes are retained outside the executable route tree. Listings, listing photos, exported databases, private operational records, unverified marketing media and commercial price references retain their separate owners. The runnable example uses authored fictional inputs. See [provenance](docs/provenance.md).

MIT covers Peter Neyra’s original code. Dependency and font terms remain in [third-party notices](THIRD-PARTY-NOTICES.md). This source beta is prepared for publication; repository publication and hosted deployment are recorded separately by the release operator.
