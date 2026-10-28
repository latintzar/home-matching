# Architecture

| Layer | Source | Contract |
|---|---|---|
| First-result CLI | `tools/first-match.mjs` | Frozen authored inputs, original scorer, private JSON receipt, network fence |
| First-result UI | `starter/app/page.tsx` | Profile switching runs the original scorer locally |
| Original results scene | `src/components/recommender/RecommendationResults.tsx` | Extracted original `/recommend` result markup and props |
| Household fit | `src/lib/recommender/fitScoringV2.ts` | Pure prefilter and weighted-fit functions |
| Shared WPA contract | `src/types/wpa-score.ts` | Original score interface separated from a provider route |
| Recommender orchestration | `src/lib/recommender/orchestratorV2.ts` | Prefilter, neighborhood lookup, WPA shortlist, fit, explanation |
| Analysis providers | `src/app/api/wpa/` | Describe, score, instant and explain endpoints |
| Cached property evidence | `src/lib/wpa/cache.ts` | Listing/mode, URL fingerprint and expiry |
| Household profiles | `src/types/recommender.ts`, Supabase migrations | LifeProfile and profile persistence |
| Neighborhood evidence | `src/lib/recommender/neighborhoodService.ts`, `src/lib/geo/h3-lookup.ts` | Cached geography lookup and fit input |
| Catalogue storage | `src/lib/data-adapter/`, `src/lib/dynamodb.ts` | Supabase/DynamoDB adapter paths |
| Intake and feedback | `src/components/recommender/`, `src/app/(app)/speak-with-leo/` | Text/voice, profile collection and reactions |
| Original product UI | `src/app/(app)/`, `src/components/` | Dashboard, recommendations, saved homes, profile, property and professional flows |
| Harvest/infrastructure | `src/lambda/`, `src/scripts/`, `scripts/`, `docker/` | Acquisition, export, schema and operator tools |

## Storage

Supabase holds authenticated users, household profiles, listings/photos, sessions, feedback and associated application records. DynamoDB and S3 support the catalogue, geographic intelligence and reusable analysis. The retained migrations and provisioning scripts document parts of that system; this release does not claim that they recreate every historical managed resource from an empty account.

The source contains overlapping cache implementations and generations of recommender orchestration. The guide chooses V2 fit for a clear portable first result. The full source remains available to study and reconcile those contracts rather than silently replacing the original system with a new general-purpose AI wrapper.

## Configuration boundary

`tools/runtime-env.py` owns the selected process environment. It accepts an allowlisted private file, masks diagnostics and blocks default cloud profile/metadata fallback. Root application modules read their actual environment variables. Service credentials remain server-only; public client IDs and browser map tokens remain visible to browsers and need recipient-side provider restrictions.

The isolated first-result app imports only the shared types, pure scorer, authored fixtures and original results scene. It has no cloud/provider adapter in its dependency path. Its browser regression blocks foreign requests and checks both rankings, the rejected share, page errors and responsive overflow.

## Navigation

[Workflows](workflows.md) trace actual calls. [Decisions](decisions.md) explain the separation. [Reference](reference/README.md) indexes original functions by module and supplies JSON symbols for agents and search tools.
