# src/lambda/remax-harvest-delta.ts

[Source](../../../../../src/lambda/remax-harvest-delta.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `ClassifiedPhotos` | interface | [L94](../../../../../src/lambda/remax-harvest-delta.ts#L94) |  |
| `classifyPhotos` | function | [L102](../../../../../src/lambda/remax-harvest-delta.ts#L102) | imageUrls |
| `ListingTrackingData` | interface | [L130](../../../../../src/lambda/remax-harvest-delta.ts#L130) |  |
| `getExistingListingTracking` | function | [L139](../../../../../src/lambda/remax-harvest-delta.ts#L139) | listingId |
| `buildTrackingData` | function | [L169](../../../../../src/lambda/remax-harvest-delta.ts#L169) | existing, currentPrice, publicationDate |
| `loadHarvestState` | function | [L203](../../../../../src/lambda/remax-harvest-delta.ts#L203) |  |
| `createFreshState` | function | [L230](../../../../../src/lambda/remax-harvest-delta.ts#L230) |  |
| `saveHarvestState` | function | [L252](../../../../../src/lambda/remax-harvest-delta.ts#L252) | state |
| `deleteHarvestState` | function | [L262](../../../../../src/lambda/remax-harvest-delta.ts#L262) |  |
| `loadExistingListings` | function | [L274](../../../../../src/lambda/remax-harvest-delta.ts#L274) |  |
| `saveListings` | function | [L293](../../../../../src/lambda/remax-harvest-delta.ts#L293) | listings |
| `logContinuationScheduled` | function | [L308](../../../../../src/lambda/remax-harvest-delta.ts#L308) | state |
| `RemaxListing` | interface | [L313](../../../../../src/lambda/remax-harvest-delta.ts#L313) |  |
| `HarvestState` | interface | [L356](../../../../../src/lambda/remax-harvest-delta.ts#L356) |  |
| `NormalizedListing` | interface | [L383](../../../../../src/lambda/remax-harvest-delta.ts#L383) |  |
| `sleep` | function | [L423](../../../../../src/lambda/remax-harvest-delta.ts#L423) | ms |
| `geocodeAddress` | function | [L428](../../../../../src/lambda/remax-harvest-delta.ts#L428) | address |
| `fetchSitemapIndex` | function | [L466](../../../../../src/lambda/remax-harvest-delta.ts#L466) |  |
| `fetchSitemap` | function | [L496](../../../../../src/lambda/remax-harvest-delta.ts#L496) | sitemapUrl |
| `fetchAllListingUrls` | function | [L530](../../../../../src/lambda/remax-harvest-delta.ts#L530) |  |
| `FetchPageResult` | interface | [L554](../../../../../src/lambda/remax-harvest-delta.ts#L554) |  |
| `fetchPage` | function | [L559](../../../../../src/lambda/remax-harvest-delta.ts#L559) | url |
| `parseUrlLocation` | function | [L603](../../../../../src/lambda/remax-harvest-delta.ts#L603) | url |
| `cleanLocation` | function | [L654](../../../../../src/lambda/remax-harvest-delta.ts#L654) | s |
| `sanitizeJsonString` | function | [L669](../../../../../src/lambda/remax-harvest-delta.ts#L669) | str |
| `parseDetailPage` | function | [L675](../../../../../src/lambda/remax-harvest-delta.ts#L675) | html, url, lastmod |
| `normalizeListing` | function | [L843](../../../../../src/lambda/remax-harvest-delta.ts#L843) | listing |
| `writeListingToDynamoDB` | function | [L892](../../../../../src/lambda/remax-harvest-delta.ts#L892) | listing |
| `handler` | function | [L969](../../../../../src/lambda/remax-harvest-delta.ts#L969) | event |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `cheerio`, `zlib`, `../lib/harvest/listing-status-detection`, `../lib/harvest/coordinate-precision`, `../lib/harvest/run-analytics`
