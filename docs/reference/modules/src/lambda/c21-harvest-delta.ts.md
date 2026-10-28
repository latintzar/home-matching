# src/lambda/c21-harvest-delta.ts

[Source](../../../../../src/lambda/c21-harvest-delta.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `ClassifiedPhotos` | interface | [L93](../../../../../src/lambda/c21-harvest-delta.ts#L93) |  |
| `classifyPhotos` | function | [L101](../../../../../src/lambda/c21-harvest-delta.ts#L101) | imageUrls |
| `ListingTrackingData` | interface | [L129](../../../../../src/lambda/c21-harvest-delta.ts#L129) |  |
| `getExistingListingTracking` | function | [L138](../../../../../src/lambda/c21-harvest-delta.ts#L138) | listingId |
| `buildTrackingData` | function | [L168](../../../../../src/lambda/c21-harvest-delta.ts#L168) | existing, currentPrice |
| `loadHarvestState` | function | [L201](../../../../../src/lambda/c21-harvest-delta.ts#L201) |  |
| `createFreshState` | function | [L228](../../../../../src/lambda/c21-harvest-delta.ts#L228) |  |
| `saveHarvestState` | function | [L250](../../../../../src/lambda/c21-harvest-delta.ts#L250) | state |
| `deleteHarvestState` | function | [L260](../../../../../src/lambda/c21-harvest-delta.ts#L260) |  |
| `loadExistingListings` | function | [L272](../../../../../src/lambda/c21-harvest-delta.ts#L272) |  |
| `saveListings` | function | [L291](../../../../../src/lambda/c21-harvest-delta.ts#L291) | listings |
| `invokeSelfContinuation` | function | [L304](../../../../../src/lambda/c21-harvest-delta.ts#L304) | state |
| `Century21Listing` | interface | [L316](../../../../../src/lambda/c21-harvest-delta.ts#L316) |  |
| `HarvestState` | interface | [L365](../../../../../src/lambda/c21-harvest-delta.ts#L365) |  |
| `NormalizedListing` | interface | [L392](../../../../../src/lambda/c21-harvest-delta.ts#L392) |  |
| `sleep` | function | [L436](../../../../../src/lambda/c21-harvest-delta.ts#L436) | ms |
| `reverseGeocode` | function | [L444](../../../../../src/lambda/c21-harvest-delta.ts#L444) | lat, lon |
| `fetchSitemapUrls` | function | [L489](../../../../../src/lambda/c21-harvest-delta.ts#L489) |  |
| `FetchPageResult` | interface | [L518](../../../../../src/lambda/c21-harvest-delta.ts#L518) |  |
| `fetchPage` | function | [L523](../../../../../src/lambda/c21-harvest-delta.ts#L523) | url |
| `parseDetailPage` | function | [L567](../../../../../src/lambda/c21-harvest-delta.ts#L567) | html, url |
| `normalizeListing` | function | [L828](../../../../../src/lambda/c21-harvest-delta.ts#L828) | listing |
| `writeListingToDynamoDB` | function | [L881](../../../../../src/lambda/c21-harvest-delta.ts#L881) | listing |
| `backupToS3` | function | [L960](../../../../../src/lambda/c21-harvest-delta.ts#L960) | listings |
| `handler` | function | [L982](../../../../../src/lambda/c21-harvest-delta.ts#L982) | event |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `@aws-sdk/client-lambda`, `cheerio`, `zlib`, `util`, `../lib/harvest/listing-status-detection`, `../lib/harvest/coordinate-precision`, `../lib/harvest/run-analytics`
