# src/lambda/ev-harvest-delta.ts

[Source](../../../../../src/lambda/ev-harvest-delta.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `EVListing` | interface | [L75](../../../../../src/lambda/ev-harvest-delta.ts#L75) |  |
| `CategoryProgress` | interface | [L134](../../../../../src/lambda/ev-harvest-delta.ts#L134) |  |
| `HarvestState` | interface | [L141](../../../../../src/lambda/ev-harvest-delta.ts#L141) |  |
| `ClassifiedPhotos` | interface | [L158](../../../../../src/lambda/ev-harvest-delta.ts#L158) |  |
| `ScrapflyResult` | interface | [L172](../../../../../src/lambda/ev-harvest-delta.ts#L172) |  |
| `fetchWithScrapfly` | function | [L177](../../../../../src/lambda/ev-harvest-delta.ts#L177) | url |
| `extractSubUrls` | function | [L239](../../../../../src/lambda/ev-harvest-delta.ts#L239) | html, currentPath, categoryBasePath |
| `extractListingsFromHtml` | function | [L263](../../../../../src/lambda/ev-harvest-delta.ts#L263) | html, listingType |
| `shouldStopCrawling` | function | [L363](../../../../../src/lambda/ev-harvest-delta.ts#L363) | listings, existingListings, listingType |
| `DiscoveryResult` | interface | [L400](../../../../../src/lambda/ev-harvest-delta.ts#L400) |  |
| `discoverGeoRecursive` | function | [L410](../../../../../src/lambda/ev-harvest-delta.ts#L410) | baseUrl, listingType, existingListings, maxDepth, lambdaStartTime, previousProgress |
| `buildImageUrl` | function | [L534](../../../../../src/lambda/ev-harvest-delta.ts#L534) | imageId, width, height |
| `classifyPhotos` | function | [L538](../../../../../src/lambda/ev-harvest-delta.ts#L538) | imageIds |
| `ListingTrackingData` | interface | [L567](../../../../../src/lambda/ev-harvest-delta.ts#L567) |  |
| `getExistingListingTracking` | function | [L576](../../../../../src/lambda/ev-harvest-delta.ts#L576) | listingId |
| `buildTrackingData` | function | [L597](../../../../../src/lambda/ev-harvest-delta.ts#L597) | existing, currentPrice |
| `EnrichResult` | interface | [L630](../../../../../src/lambda/ev-harvest-delta.ts#L630) |  |
| `enrichFromDetailPage` | function | [L635](../../../../../src/lambda/ev-harvest-delta.ts#L635) | listing |
| `loadHarvestState` | function | [L717](../../../../../src/lambda/ev-harvest-delta.ts#L717) |  |
| `saveHarvestState` | function | [L738](../../../../../src/lambda/ev-harvest-delta.ts#L738) | state |
| `deleteHarvestState` | function | [L748](../../../../../src/lambda/ev-harvest-delta.ts#L748) |  |
| `logContinuationScheduled` | function | [L757](../../../../../src/lambda/ev-harvest-delta.ts#L757) |  |
| `loadExistingListings` | function | [L762](../../../../../src/lambda/ev-harvest-delta.ts#L762) |  |
| `saveListings` | function | [L783](../../../../../src/lambda/ev-harvest-delta.ts#L783) | listings |
| `writeToLeoListings` | function | [L801](../../../../../src/lambda/ev-harvest-delta.ts#L801) | listing |
| `handler` | function | [L886](../../../../../src/lambda/ev-harvest-delta.ts#L886) | event |

Imports: `@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `zlib`, `../lib/harvest/listing-status-detection`, `../lib/harvest/coordinate-precision`, `../lib/harvest/run-analytics`
