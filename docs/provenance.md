# Provenance

## Source authority

The original source is `latintzar/puedo_casa`, branch `master`, commit `d461e9556f09ad526030376ab58643298e3a1fc8`. The release is a clean derivative with no repository history. Original private source and its before-transform hashes remain in the owner’s recovery records. Git blobs used for extraction were verified before curation.

## Included

The retained application, server routes, recommender, data adapters, Lambda/ingestion/geo tools, Supabase migrations, extensions, voice prompts and deep product specifications preserve the original product. Original code carries MIT; fonts and data keep their [separate notices](../THIRD-PARTY-NOTICES.md).

The release adds an isolated first-result CLI/UI, private configuration helper, bounded synthetic inputs, tests, current guides, source references and CI. It extracts the existing results JSX and WPA type contract for reuse, clarifies neighborhood reason labels, aligns street-protection prompt polarity with the original positive scorer, and supplies scoped dependency/security repairs. Provider adapters retain their original roles.

## Excluded or separated

| Source scope | Treatment |
|---|---|
| `.git`, `.env*`, credentials, logs, backups, generated DB/data/HTML exports, build/cache/runtime directories | Excluded from source distribution |
| `Random Files I Want To Give Cursor/`, generated `.lambda-build/`, extension browser profiles and dependencies | Excluded historical/runtime material |
| Original `public/images/landing/`, large logos/favicon and listing/photo exports | Omitted pending media provenance; the tested screen uses its native empty-photo state |
| `src/data/lifestyle-test-results.json` | Generated original results omitted |
| `src/lib/mock-buyer-report.ts`, original test-buyer-report-variations page | Unverified listing/photo layout fixture omitted |
| `src/lib/geo/barcelona-heatmap-paths.ts` | Unverified generated geometry omitted; original renderer accepts recipient paths |
| `scripts/trim-visible-strengths.js` | Malformed one-off operator script omitted |
| Original `/test*` and `/debug*` pages/routes | Retained under `archive/diagnostics/app/`, outside executable Next routes |
| `sweetSpot.ts` example neighborhoods | Replaced with newly authored fictional names, purchase rates and commute inputs |
| Voice configurations | Prompts/schemas retained; provider identities cleared, origins/contact examples replaced, local workflow graph IDs preserved |
| Operator-owned literal credentials, account origins/ARNs/agent IDs, automatic dotenv paths | Removed or replaced with explicit recipient settings/reserved examples |
| Unused DuckDB, html2pdf and AI scaffold dependencies | Removed after code-reference checks; original executable providers retained |

The original source keeps its complete private lineage. This clean release distinguishes code reuse from rights to independent property/market/census/image datasets.

## Examples and captures

`tools/home-fixtures.mjs` contains authored homes, fictional EUR purchase amounts, authored WPA/neighborhood scores and two buyer profiles. These are neither sampled customer records nor a model inference receipt. The original scorer produces the displayed fit scores.

`docs/assets/` contains actual Chromium captures of the source-faithful recommendation scene, plus source/image hashes and a repeatable capture script in `starter/`. No raster mockup or substituted product screen was created. Source Sans 3/Playfair Display font files and OFL notices keep their acquisition provenance under `public/fonts/`.

The retained OpenStreetMap-derived schematic has its own [data license notice](data-licenses.md). Generated private citywide datasets are excluded. Historical specifications may describe planned integrations or past experiments; [release status](../RELEASE-STATUS.md) records current proof.
