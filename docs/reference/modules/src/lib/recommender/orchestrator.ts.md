# src/lib/recommender/orchestrator.ts

[Source](../../../../../../src/lib/recommender/orchestrator.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `RecommenderResult` | interface | [L27](../../../../../../src/lib/recommender/orchestrator.ts#L27) |  |
| `RecommenderOptions` | interface | [L53](../../../../../../src/lib/recommender/orchestrator.ts#L53) |  |
| `getDocClient` | function | [L66](../../../../../../src/lib/recommender/orchestrator.ts#L66) |  |
| `loadProfile` | function | [L83](../../../../../../src/lib/recommender/orchestrator.ts#L83) | profileId |
| `runRecommender` | function | [L136](../../../../../../src/lib/recommender/orchestrator.ts#L136) | profileOrId, options |
| `quickSearch` | function | [L297](../../../../../../src/lib/recommender/orchestrator.ts#L297) | profile, limit |
| `deepAnalysis` | function | [L312](../../../../../../src/lib/recommender/orchestrator.ts#L312) | profile, listings |

Imports: `@/types/recommender`, `./sweetSpot`, `./harvestFilter`, `./wpaShortlist`, `./fitScoring`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `./sweetSpot`, `./harvestFilter`, `./wpaShortlist`, `./fitScoring`
