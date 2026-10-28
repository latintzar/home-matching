# src/lib/recommender/orchestratorV2.ts

[Source](../../../../../../src/lib/recommender/orchestratorV2.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `RecommenderV2Result` | interface | [L34](../../../../../../src/lib/recommender/orchestratorV2.ts#L34) |  |
| `V2ScoredListing` | interface | [L69](../../../../../../src/lib/recommender/orchestratorV2.ts#L69) |  |
| `RecommenderV2Options` | interface | [L91](../../../../../../src/lib/recommender/orchestratorV2.ts#L91) |  |
| `getDocClient` | function | [L106](../../../../../../src/lib/recommender/orchestratorV2.ts#L106) |  |
| `loadProfile` | function | [L124](../../../../../../src/lib/recommender/orchestratorV2.ts#L124) | profileId |
| `runWPAForListing` | function | [L152](../../../../../../src/lib/recommender/orchestratorV2.ts#L152) | listing, useCache |
| `generateExplanation` | function | [L235](../../../../../../src/lib/recommender/orchestratorV2.ts#L235) | listing, wpa, neighborhood, fitResult, profile |
| `runRecommenderV2` | function | [L281](../../../../../../src/lib/recommender/orchestratorV2.ts#L281) | profileOrId, options |
| `quickSearchV2` | function | [L598](../../../../../../src/lib/recommender/orchestratorV2.ts#L598) | profile, limit |
| `deepAnalysisV2` | function | [L615](../../../../../../src/lib/recommender/orchestratorV2.ts#L615) | profile, listings |

Imports: `@/types/recommender`, `./harvestFilter`, `./fitScoringV2`, `@/app/api/wpa/score/route`, `@/types/neighborhood`, `./neighborhoodService`, `@/lib/wpa/cache`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `./profileFit`
