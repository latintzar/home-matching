# src/lib/recommender/wpaShortlist.ts

[Source](../../../../../../src/lib/recommender/wpaShortlist.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `RecommenderWPA` | interface | [L26](../../../../../../src/lib/recommender/wpaShortlist.ts#L26) |  |
| `WPAResult` | interface | [L57](../../../../../../src/lib/recommender/wpaShortlist.ts#L57) |  |
| `getDocClient` | function | [L69](../../../../../../src/lib/recommender/wpaShortlist.ts#L69) |  |
| `getCachedWPA` | function | [L91](../../../../../../src/lib/recommender/wpaShortlist.ts#L91) | listingId |
| `cacheWPA` | function | [L114](../../../../../../src/lib/recommender/wpaShortlist.ts#L114) | wpa |
| `fetchImageAsBase64` | function | [L134](../../../../../../src/lib/recommender/wpaShortlist.ts#L134) | url |
| `runWPA` | function | [L203](../../../../../../src/lib/recommender/wpaShortlist.ts#L203) | listing |
| `runWPABatch` | function | [L326](../../../../../../src/lib/recommender/wpaShortlist.ts#L326) | listings, options |
| `getWPAForListings` | function | [L375](../../../../../../src/lib/recommender/wpaShortlist.ts#L375) | listings |

Imports: `@aws-sdk/client-dynamodb`, `@/lib/wpa/table-contracts`, `@aws-sdk/lib-dynamodb`, `@/lib/gemini-rest-client`, `./harvestFilter`
