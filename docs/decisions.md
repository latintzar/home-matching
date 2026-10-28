# Decisions

This is a retrospective source reading and extraction record, dated 2026-10-28. Original plans remain historical design records; these notes describe choices visible in code and choices made for this release.

## Reuse property evidence across households

**Original source:** `src/lib/recommender/orchestratorV2.ts`, `fitScoringV2.ts`, `src/app/api/wpa/describe/route.ts`, `score/route.ts`.

Description and structured property scores precede household matching. Household weights, requirements and circumstances feed an algorithmic fit stage. This makes preference changes inexpensive to recompute and inspect. The tradeoff is dependence on the quality, calibration and freshness of the upstream evidence.

## Keep missing evidence distinct from a poor score

**Original source:** `fitScoringV2.ts`.

Null dimensions are omitted from the weighted mean; explicit flags and known must-have failures have separate treatment. This preserves partial analysis. A high score on sparse input still needs the source’s confidence treatment and clear product explanation; it is a heuristic rather than a guarantee about a property.

## Preserve intake as a household conversation

**Original source:** `VoiceIntake.tsx`, `IntakeChat.tsx`, `SpeakWithLeoContent.tsx`, `agent_configs/`.

Buyer/renter and intake/what-if/follow-up roles express different stages of choosing a home. The release preserves those prompts and UI paths, while replacing operator-owned agent identities with recipient settings. The tradeoff is a separate account/tool commissioning step before real voice acceptance.

## Start with a deterministic useful result

**Release choice:** `tools/first-match.mjs`, `starter/`.

The original fit calculation can run on Node 22 without npm or a cloud account. The browser example reuses the original recommendation-result scene and the same authored evidence. This proves a concrete property-analysis-to-fit boundary while keeping full managed-resource acceptance explicit.

## Extract a shared type and results renderer

**Release choice:** `src/types/wpa-score.ts`, `RecommendationResults.tsx`.

The scorer’s old type import pointed into a server API route, pulling cloud dependencies into type checking. The original interface now lives in a shared type module and remains re-exported by the route. The original results JSX is a reusable component; the original route calls it too. Numerical function bodies stay unchanged; four raw neighborhood reason names gain readable labels.

## Own the runtime configuration

**Release choice:** `tools/runtime-env.py`.

Provider values are read through a selected private file outside the checkout. Inherited cloud profiles and metadata fallback are blocked by the helper. This adds a deliberate setup step and prevents a new install from accidentally using an unrelated account already present on a shared host.

## Separate code, data and historical experiments

**Release choice:** `docs/provenance.md`, `archive/diagnostics/`.

The code remains broad enough to study the original product. Unverified listing/photo examples and generated private data stay with the original source authority. Fictional inputs replace the MVP neighborhood examples. Diagnostic/test routes move outside Next’s executable tree. The first-result entrypoint stays small, while the retained full product and its unresolved infrastructure contracts stay visible.

## Keep street-exposure polarity consistent

**Release correction:** the original score prompt described high street exposure as worse while the existing type/scorer treated higher as better. The prompt now asks for protection from street noise/privacy, with 100 meaning quiet/private. A deterministic test covers the scorer direction. Recipients commission fresh owned caches or explicitly invalidate scores produced under the old prompt; real model calibration remains provider acceptance.
