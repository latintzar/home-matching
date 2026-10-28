# src/lib/recommender/neighborhoodService.ts

[Source](../../../../../../src/lib/recommender/neighborhoodService.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `getDocClient` | function | [L28](../../../../../../src/lib/recommender/neighborhoodService.ts#L28) |  |
| `preloadNeighborhoodProfiles` | function | [L52](../../../../../../src/lib/recommender/neighborhoodService.ts#L52) |  |
| `initializeNeighborhoodService` | function | [L78](../../../../../../src/lib/recommender/neighborhoodService.ts#L78) |  |
| `getNeighborhoodProfileById` | function | [L93](../../../../../../src/lib/recommender/neighborhoodService.ts#L93) | neighborhoodId |
| `getNeighborhoodProfile` | function | [L118](../../../../../../src/lib/recommender/neighborhoodService.ts#L118) | lat, lng |
| `getNeighborhoodScores` | function | [L141](../../../../../../src/lib/recommender/neighborhoodService.ts#L141) | lat, lng |
| `batchGetNeighborhoodProfiles` | function | [L158](../../../../../../src/lib/recommender/neighborhoodService.ts#L158) | listings |
| `getNeighborhoodsByCity` | function | [L174](../../../../../../src/lib/recommender/neighborhoodService.ts#L174) | city |
| `getDefaultNeighborhoodProfile` | function | [L215](../../../../../../src/lib/recommender/neighborhoodService.ts#L215) | city |
| `getNeighborhoodProfileWithDefault` | function | [L262](../../../../../../src/lib/recommender/neighborhoodService.ts#L262) | lat, lng, city |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@/lib/geo/h3-lookup`, `@/types/neighborhood`
