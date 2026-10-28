# src/lib/recommender/harvestFilter.ts

[Source](../../../../../../src/lib/recommender/harvestFilter.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `FilteredListing` | interface | [L17](../../../../../../src/lib/recommender/harvestFilter.ts#L17) |  |
| `FilterOptions` | interface | [L37](../../../../../../src/lib/recommender/harvestFilter.ts#L37) |  |
| `FilterResult` | interface | [L49](../../../../../../src/lib/recommender/harvestFilter.ts#L49) |  |
| `getDocClient` | function | [L62](../../../../../../src/lib/recommender/harvestFilter.ts#L62) |  |
| `profileToFilters` | function | [L83](../../../../../../src/lib/recommender/harvestFilter.ts#L83) | profile |
| `matchesFilters` | function | [L98](../../../../../../src/lib/recommender/harvestFilter.ts#L98) | listing, filters |
| `filterListingsForProfile` | function | [L147](../../../../../../src/lib/recommender/harvestFilter.ts#L147) | profile |
| `filterListings` | function | [L188](../../../../../../src/lib/recommender/harvestFilter.ts#L188) | filters |
| `buildFilterExpression` | function | [L253](../../../../../../src/lib/recommender/harvestFilter.ts#L253) | filters |
| `buildExpressionAttributeNames` | function | [L285](../../../../../../src/lib/recommender/harvestFilter.ts#L285) | filters |
| `buildExpressionAttributeValues` | function | [L291](../../../../../../src/lib/recommender/harvestFilter.ts#L291) | filters |
| `testFilter` | function | [L309](../../../../../../src/lib/recommender/harvestFilter.ts#L309) |  |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@/types/recommender`, `./sweetSpot`
