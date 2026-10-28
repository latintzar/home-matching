# src/lambda/lf-harvest-delta.ts

[Source](../../../../../src/lambda/lf-harvest-delta.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `HarvestState` | interface | [L76](../../../../../src/lambda/lf-harvest-delta.ts#L76) |  |
| `ClassifiedPhotos` | interface | [L97](../../../../../src/lambda/lf-harvest-delta.ts#L97) |  |
| `classifyPhotos` | function | [L105](../../../../../src/lambda/lf-harvest-delta.ts#L105) | imageUrls |
| `ListingTrackingData` | interface | [L133](../../../../../src/lambda/lf-harvest-delta.ts#L133) |  |
| `getExistingListingTracking` | function | [L143](../../../../../src/lambda/lf-harvest-delta.ts#L143) | listingId |
| `buildTrackingData` | function | [L170](../../../../../src/lambda/lf-harvest-delta.ts#L170) | existing, currentPrice |
| `LFListing` | interface | [L204](../../../../../src/lambda/lf-harvest-delta.ts#L204) |  |
| `NominatimResult` | interface | [L257](../../../../../src/lambda/lf-harvest-delta.ts#L257) |  |
| `geocodeAddress` | function | [L276](../../../../../src/lambda/lf-harvest-delta.ts#L276) | locality, region, country |
| `fetchNewestFromSearch` | function | [L339](../../../../../src/lambda/lf-harvest-delta.ts#L339) |  |
| `fetchSitemap` | function | [L382](../../../../../src/lambda/lf-harvest-delta.ts#L382) |  |
| `FetchDetailResult` | interface | [L420](../../../../../src/lambda/lf-harvest-delta.ts#L420) |  |
| `fetchAndParseDetailPage` | function | [L425](../../../../../src/lambda/lf-harvest-delta.ts#L425) | url |
| `parseDetailPage` | function | [L459](../../../../../src/lambda/lf-harvest-delta.ts#L459) | url, html |
| `loadHarvestState` | function | [L629](../../../../../src/lambda/lf-harvest-delta.ts#L629) |  |
| `saveHarvestState` | function | [L655](../../../../../src/lambda/lf-harvest-delta.ts#L655) | state |
| `deleteHarvestState` | function | [L665](../../../../../src/lambda/lf-harvest-delta.ts#L665) |  |
| `invokeSelfContinuation` | function | [L677](../../../../../src/lambda/lf-harvest-delta.ts#L677) | state |
| `loadExistingListings` | function | [L691](../../../../../src/lambda/lf-harvest-delta.ts#L691) |  |
| `saveListings` | function | [L715](../../../../../src/lambda/lf-harvest-delta.ts#L715) | listings |
| `writeToLeoListings` | function | [L737](../../../../../src/lambda/lf-harvest-delta.ts#L737) | listing |
| `updateStats` | function | [L839](../../../../../src/lambda/lf-harvest-delta.ts#L839) | newCount, totalCount |
| `handler` | function | [L862](../../../../../src/lambda/lf-harvest-delta.ts#L862) | event |

Imports: `@aws-sdk/client-s3`, `@aws-sdk/client-lambda`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `zlib`, `../lib/harvest/listing-status-detection`, `../lib/harvest/coordinate-precision`, `../lib/harvest/run-analytics`
