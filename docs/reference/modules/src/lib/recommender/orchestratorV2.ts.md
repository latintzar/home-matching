# src/lib/recommender/orchestratorV2.ts

[Source](../../../../../../src/lib/recommender/orchestratorV2.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `RecommenderV2Result` | interface | [L34](../../../../../../src/lib/recommender/orchestratorV2.ts#L34) |  |
| `V2ScoredListing` | interface | [L69](../../../../../../src/lib/recommender/orchestratorV2.ts#L69) |  |
| `RecommenderV2Options` | interface | [L91](../../../../../../src/lib/recommender/orchestratorV2.ts#L91) |  |
| `getDocClient` | function | [L106](../../../../../../src/lib/recommender/orchestratorV2.ts#L106) |  |
| `loadProfile` | function | [L124](../../../../../../src/lib/recommender/orchestratorV2.ts#L124) | profileId |
| `convertToUserFitProfile` | function | [L146](../../../../../../src/lib/recommender/orchestratorV2.ts#L146) | profile |
| `runWPAForListing` | function | [L211](../../../../../../src/lib/recommender/orchestratorV2.ts#L211) | listing, useCache |
| `generateExplanation` | function | [L294](../../../../../../src/lib/recommender/orchestratorV2.ts#L294) | listing, wpa, neighborhood, fitResult, profile |
| `runRecommenderV2` | function | [L340](../../../../../../src/lib/recommender/orchestratorV2.ts#L340) | profileOrId, options |
| `quickSearchV2` | function | [L657](../../../../../../src/lib/recommender/orchestratorV2.ts#L657) | profile, limit |
| `deepAnalysisV2` | function | [L674](../../../../../../src/lib/recommender/orchestratorV2.ts#L674) | profile, listings |

Imports: `@/types/recommender`, `./harvestFilter`, `./fitScoringV2`, `@/app/api/wpa/score/route`, `@/types/neighborhood`, `./neighborhoodService`, `@/lib/wpa/cache`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`
