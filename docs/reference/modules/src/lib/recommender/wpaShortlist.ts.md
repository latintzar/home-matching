# src/lib/recommender/wpaShortlist.ts

[Source](../../../../../../src/lib/recommender/wpaShortlist.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `RecommenderWPA` | interface | [L25](../../../../../../src/lib/recommender/wpaShortlist.ts#L25) |  |
| `WPAResult` | interface | [L56](../../../../../../src/lib/recommender/wpaShortlist.ts#L56) |  |
| `getDocClient` | function | [L68](../../../../../../src/lib/recommender/wpaShortlist.ts#L68) |  |
| `getCachedWPA` | function | [L89](../../../../../../src/lib/recommender/wpaShortlist.ts#L89) | listingId |
| `cacheWPA` | function | [L112](../../../../../../src/lib/recommender/wpaShortlist.ts#L112) | wpa |
| `fetchImageAsBase64` | function | [L132](../../../../../../src/lib/recommender/wpaShortlist.ts#L132) | url |
| `runWPA` | function | [L201](../../../../../../src/lib/recommender/wpaShortlist.ts#L201) | listing |
| `runWPABatch` | function | [L324](../../../../../../src/lib/recommender/wpaShortlist.ts#L324) | listings, options |
| `getWPAForListings` | function | [L373](../../../../../../src/lib/recommender/wpaShortlist.ts#L373) | listings |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@/lib/gemini-rest-client`, `./harvestFilter`
