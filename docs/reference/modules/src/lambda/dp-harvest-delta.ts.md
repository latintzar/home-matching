# src/lambda/dp-harvest-delta.ts

[Source](../../../../../src/lambda/dp-harvest-delta.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `ClassifiedPhotos` | interface | [L94](../../../../../src/lambda/dp-harvest-delta.ts#L94) |  |
| `classifyPhotos` | function | [L102](../../../../../src/lambda/dp-harvest-delta.ts#L102) | imageUrls |
| `ListingTrackingData` | interface | [L130](../../../../../src/lambda/dp-harvest-delta.ts#L130) |  |
| `getExistingListingTracking` | function | [L139](../../../../../src/lambda/dp-harvest-delta.ts#L139) | listingId |
| `buildTrackingData` | function | [L166](../../../../../src/lambda/dp-harvest-delta.ts#L166) | existing, currentPrice |
| `DPListing` | interface | [L199](../../../../../src/lambda/dp-harvest-delta.ts#L199) |  |
| `HarvestState` | interface | [L240](../../../../../src/lambda/dp-harvest-delta.ts#L240) |  |
| `fetchOfficialCount` | function | [L265](../../../../../src/lambda/dp-harvest-delta.ts#L265) |  |
| `fetchSitemapListPages` | function | [L287](../../../../../src/lambda/dp-harvest-delta.ts#L287) |  |
| `extractListingIdsFromListPage` | function | [L316](../../../../../src/lambda/dp-harvest-delta.ts#L316) | listPageUrl |
| `FetchResult` | interface | [L352](../../../../../src/lambda/dp-harvest-delta.ts#L352) |  |
| `fetchAndParseListing` | function | [L357](../../../../../src/lambda/dp-harvest-delta.ts#L357) | listingId |
| `parseListingHtml` | function | [L393](../../../../../src/lambda/dp-harvest-delta.ts#L393) | url, html, id |
| `writeListingToDynamoDB` | function | [L621](../../../../../src/lambda/dp-harvest-delta.ts#L621) | listing |
| `loadState` | function | [L709](../../../../../src/lambda/dp-harvest-delta.ts#L709) |  |
| `createFreshState` | function | [L737](../../../../../src/lambda/dp-harvest-delta.ts#L737) |  |
| `saveState` | function | [L754](../../../../../src/lambda/dp-harvest-delta.ts#L754) | state |
| `deleteState` | function | [L764](../../../../../src/lambda/dp-harvest-delta.ts#L764) |  |
| `invokeSelfContinuation` | function | [L776](../../../../../src/lambda/dp-harvest-delta.ts#L776) | state |
| `saveAllListings` | function | [L788](../../../../../src/lambda/dp-harvest-delta.ts#L788) | listings |
| `loadAllListings` | function | [L800](../../../../../src/lambda/dp-harvest-delta.ts#L800) |  |
| `updateStats` | function | [L823](../../../../../src/lambda/dp-harvest-delta.ts#L823) | state, newCount |
| `handler` | function | [L856](../../../../../src/lambda/dp-harvest-delta.ts#L856) | event |

Imports: `@aws-sdk/client-s3`, `@aws-sdk/client-lambda`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `zlib`, `../lib/harvest/listing-status-detection`, `../lib/harvest/coordinate-precision`, `../lib/harvest/run-analytics`
