# src/lambda/aproperties-harvest-delta.ts

[Source](../../../../../src/lambda/aproperties-harvest-delta.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `httpFetch` | function | [L59](../../../../../src/lambda/aproperties-harvest-delta.ts#L59) | url, options |
| `scrapflyFetch` | function | [L95](../../../../../src/lambda/aproperties-harvest-delta.ts#L95) | url, retryCount |
| `passesAgeFilter` | function | [L148](../../../../../src/lambda/aproperties-harvest-delta.ts#L148) | url, lastmod |
| `ClassifiedPhotos` | interface | [L209](../../../../../src/lambda/aproperties-harvest-delta.ts#L209) |  |
| `classifyPhotos` | function | [L217](../../../../../src/lambda/aproperties-harvest-delta.ts#L217) | photoUrls |
| `ListingTrackingData` | interface | [L245](../../../../../src/lambda/aproperties-harvest-delta.ts#L245) |  |
| `getExistingListing` | function | [L255](../../../../../src/lambda/aproperties-harvest-delta.ts#L255) | domain, listingId |
| `buildTrackingData` | function | [L285](../../../../../src/lambda/aproperties-harvest-delta.ts#L285) | existing, currentPrice, publicationDate |
| `HarvestState` | interface | [L320](../../../../../src/lambda/aproperties-harvest-delta.ts#L320) |  |
| `loadHarvestState` | function | [L347](../../../../../src/lambda/aproperties-harvest-delta.ts#L347) |  |
| `createFreshState` | function | [L374](../../../../../src/lambda/aproperties-harvest-delta.ts#L374) |  |
| `saveHarvestState` | function | [L396](../../../../../src/lambda/aproperties-harvest-delta.ts#L396) | state |
| `deleteHarvestState` | function | [L406](../../../../../src/lambda/aproperties-harvest-delta.ts#L406) |  |
| `loadExistingListings` | function | [L418](../../../../../src/lambda/aproperties-harvest-delta.ts#L418) |  |
| `saveListings` | function | [L437](../../../../../src/lambda/aproperties-harvest-delta.ts#L437) | listings |
| `invokeSelfContinuation` | function | [L450](../../../../../src/lambda/aproperties-harvest-delta.ts#L450) | state |
| `APropertiesListing` | interface | [L484](../../../../../src/lambda/aproperties-harvest-delta.ts#L484) |  |
| `NormalizedListing` | interface | [L530](../../../../../src/lambda/aproperties-harvest-delta.ts#L530) |  |
| `sleep` | function | [L573](../../../../../src/lambda/aproperties-harvest-delta.ts#L573) | ms |
| `geocodeAddress` | function | [L578](../../../../../src/lambda/aproperties-harvest-delta.ts#L578) | address |
| `isListingUrl` | function | [L611](../../../../../src/lambda/aproperties-harvest-delta.ts#L611) | url |
| `parseUrlLocation` | function | [L616](../../../../../src/lambda/aproperties-harvest-delta.ts#L616) | url |
| `fetchSitemapUrls` | function | [L683](../../../../../src/lambda/aproperties-harvest-delta.ts#L683) |  |
| `FetchPageResult` | interface | [L721](../../../../../src/lambda/aproperties-harvest-delta.ts#L721) |  |
| `fetchPage` | function | [L726](../../../../../src/lambda/aproperties-harvest-delta.ts#L726) | url |
| `parseDetailPage` | function | [L757](../../../../../src/lambda/aproperties-harvest-delta.ts#L757) | html, url, lastmod |
| `normalizeListing` | function | [L926](../../../../../src/lambda/aproperties-harvest-delta.ts#L926) | listing |
| `writeListingToDynamoDB` | function | [L975](../../../../../src/lambda/aproperties-harvest-delta.ts#L975) | listing |
| `handler` | function | [L1053](../../../../../src/lambda/aproperties-harvest-delta.ts#L1053) | event |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `@aws-sdk/client-lambda`, `cheerio`, `zlib`, `https`, `http`, `../lib/harvest/listing-status-detection`, `../lib/harvest/coordinate-precision`, `../lib/harvest/run-analytics`
