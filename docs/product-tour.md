# Product tour

Home Matching is an AI-native property scanner across platforms, based on a person’s lifestyle. It helps people choosing a home in Spain compare the fit to their household, save candidates and prepare viewings.

[Open demo](https://preview.atelierneyra.com/apps/home-matching/dashboard) · [Run the native workspace](../README.md#run-the-app)

## From recommendation to viewing

1. Open the dashboard or Recommendations. The native workspace starts with eight authored purchase homes and a household profile, so there is a populated search to explore.
2. Open a recommended property. Read its fit explanation and concerns alongside the price, dimensions, photographs and property evidence.
3. Save the home. **Saved** keeps the candidates together for comparison; the same selected property remains available in the catalogue.
4. Add a text note in the property workspace, such as a question about afternoon light, and record the viewing state. **Viewings** keeps the property’s viewing context available for follow-up.
5. Return to the household profile and recommendation flow to inspect the budget, routines and preferences behind the ranking. Profile updates reuse stored property evidence; the deterministic fit calculation changes with those priorities. The [calculation guide](guide.md#change-the-priorities) provides a small reproducible version with two different household profiles.

Saves, notes and profile changes belong to the current browser’s temporary private workspace and persist across reloads. The local app and hosted example use the same original screens and API shapes. [Native workspace](native-workspace.md) describes the SQLite storage and guest-session bounds.

## Product areas and source

| Area | Actions and results | Source |
| --- | --- | --- |
| Household profile | Capture budget, work situation, must-haves, dealbreakers and weighted priorities. | [LifeProfileIntake.tsx](../src/components/recommender/LifeProfileIntake.tsx), [profileFit.ts](../src/lib/recommender/profileFit.ts). |
| Recommendations | Compare household fit, top matches, concerns and property candidates. | [RecommendationsContent.tsx](<../src/app/(app)/recommendations/RecommendationsContent.tsx>), [RecommendationResults.tsx](../src/components/recommender/RecommendationResults.tsx), [fitScoringV2.ts](../src/lib/recommender/fitScoringV2.ts). |
| Property workspace | Inspect the home, toggle its saved state, add notes and record a viewing. | [LeanPropertyContent.tsx](<../src/app/(app)/property/[id]/LeanPropertyContent.tsx>). |
| Saved homes and viewings | Return to the shortlist and the properties already viewed. | [SavedPropertiesContent.tsx](<../src/app/(app)/saved/SavedPropertiesContent.tsx>), [viewings/page.tsx](<../src/app/(app)/viewings/page.tsx>). |
| Native sample | Serve authored listings, deterministic recommendations and per-guest local persistence. | [seed.mjs](../src/lib/sample/seed.mjs), [recommend.ts](../src/lib/sample/recommend.ts), [store.mjs](../src/lib/sample/store.mjs). |
| Provider-backed intake and acquisition | Continue the original voice/text intake, property analysis, catalogue ingestion and mapping workflows. | [workflows](workflows.md), [orchestratorV2.ts](../src/lib/recommender/orchestratorV2.ts), [agent configurations](../agent_configs/README.md). |

## Matching decisions

The product separates property evidence from household fit. A property’s structured analysis can be reused across searches; changing preferences reranks that evidence. The scorer applies its known requirement/dealbreaker rules, weighted dimensions and confidence adjustments, returning a fit score, reasons and concerns. Missing dimensions have explicit treatment. [Workflows](workflows.md#property-analysis-and-fit) describes the actual 35 property dimensions and four consumed neighbourhood mappings.

The sample’s eight listings, commercial facts and analysis-shaped values are authored. Its recovered property images were originally generated for the project. Fresh property ingestion, voice, model analysis, measured commute and maps use your own data and services. The broader historical plans remain available with their original scope; [release status](../RELEASE-STATUS.md) identifies current acceptance.

## Continue from here

- [Setup](setup.md) for local/source commands and selected services; [configured API access](configured-api-security.md) for household identity and operator-only tools.
- [Native workspace](native-workspace.md) for data, routes, state and deployment.
- [Workflows](workflows.md), [architecture](architecture.md) and [decisions](decisions.md) for the deeper product and engineering model.
- [Source reference](reference/README.md) for module/function lookup; [original product plans](plans/P0_INDEX.md) for the retained design record.
- [Provenance](provenance.md) and [data licences](data-licenses.md) before adding a real catalogue.

A useful continuation is to connect an owned property feed and validate the score explanations with households and agents, preserving the separation between evidence and preferences.
