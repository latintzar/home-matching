# src/lambda/tc-harvest-delta.ts

[Source](../../../../../src/lambda/tc-harvest-delta.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `HarvestState` | interface | [L83](../../../../../src/lambda/tc-harvest-delta.ts#L83) |  |
| `loadState` | function | [L93](../../../../../src/lambda/tc-harvest-delta.ts#L93) |  |
| `saveState` | function | [L117](../../../../../src/lambda/tc-harvest-delta.ts#L117) | state |
| `clearState` | function | [L127](../../../../../src/lambda/tc-harvest-delta.ts#L127) |  |
| `ClassifiedPhotos` | interface | [L147](../../../../../src/lambda/tc-harvest-delta.ts#L147) |  |
| `classifyPhotos` | function | [L155](../../../../../src/lambda/tc-harvest-delta.ts#L155) | imageUrls |
| `ListingTrackingData` | interface | [L183](../../../../../src/lambda/tc-harvest-delta.ts#L183) |  |
| `getExistingListingTracking` | function | [L192](../../../../../src/lambda/tc-harvest-delta.ts#L192) | listingId |
| `buildTrackingData` | function | [L219](../../../../../src/lambda/tc-harvest-delta.ts#L219) | existing, currentPrice |
| `TCListing` | interface | [L248](../../../../../src/lambda/tc-harvest-delta.ts#L248) |  |
| `sleep` | function | [L297](../../../../../src/lambda/tc-harvest-delta.ts#L297) | ms |
| `FetchResult` | interface | [L301](../../../../../src/lambda/tc-harvest-delta.ts#L301) |  |
| `fetchWithRetry` | function | [L306](../../../../../src/lambda/tc-harvest-delta.ts#L306) | url, retries |
| `fetchGzippedXml` | function | [L346](../../../../../src/lambda/tc-harvest-delta.ts#L346) | url |
| `extractListingUrlsFromSitemaps` | function | [L364](../../../../../src/lambda/tc-harvest-delta.ts#L364) |  |
| `parseUrlMetadata` | function | [L389](../../../../../src/lambda/tc-harvest-delta.ts#L389) | url |
| `decodeHtmlEntities` | function | [L412](../../../../../src/lambda/tc-harvest-delta.ts#L412) | str |
| `extractEmbeddedJson` | function | [L426](../../../../../src/lambda/tc-harvest-delta.ts#L426) | html |
| `extractAgencyPhone` | function | [L444](../../../../../src/lambda/tc-harvest-delta.ts#L444) | html |
| `extractAgencyEmail` | function | [L464](../../../../../src/lambda/tc-harvest-delta.ts#L464) | html |
| `parseDetailPage` | function | [L481](../../../../../src/lambda/tc-harvest-delta.ts#L481) | html, url |
| `loadExistingListings` | function | [L711](../../../../../src/lambda/tc-harvest-delta.ts#L711) |  |
| `fetchInParallel` | function | [L736](../../../../../src/lambda/tc-harvest-delta.ts#L736) | urls, existingListings, startIndex |
| `handler` | function | [L852](../../../../../src/lambda/tc-harvest-delta.ts#L852) | event, context |

Imports: `@aws-sdk/client-s3`, `@aws-sdk/client-lambda`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `zlib`, `cheerio`, `../lib/harvest/listing-status-detection`, `../lib/harvest/coordinate-precision`, `../lib/harvest/run-analytics`
