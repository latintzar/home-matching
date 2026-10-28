# src/lib/harvest/listing-tracking.ts

[Source](../../../../../../src/lib/harvest/listing-tracking.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `ClassifiedPhotos` | interface | [L56](../../../../../../src/lib/harvest/listing-tracking.ts#L56) |  |
| `classifyPhotos` | function | [L69](../../../../../../src/lib/harvest/listing-tracking.ts#L69) | photoUrls |
| `ListingStatus` | type | [L115](../../../../../../src/lib/harvest/listing-tracking.ts#L115) |  |
| `ListingTrackingData` | interface | [L117](../../../../../../src/lib/harvest/listing-tracking.ts#L117) |  |
| `getExistingListing` | function | [L130](../../../../../../src/lib/harvest/listing-tracking.ts#L130) | domain, listingId |
| `buildTrackingData` | function | [L162](../../../../../../src/lib/harvest/listing-tracking.ts#L162) | existing, currentPrice, publicationDate |
| `extractPublicationDate` | function | [L204](../../../../../../src/lib/harvest/listing-tracking.ts#L204) | html, $, lastmod |
| `parseSpanishDate` | function | [L256](../../../../../../src/lib/harvest/listing-tracking.ts#L256) | text |
| `EnhancedListingData` | interface | [L288](../../../../../../src/lib/harvest/listing-tracking.ts#L288) |  |
| `buildDynamoDBItem` | function | [L317](../../../../../../src/lib/harvest/listing-tracking.ts#L317) | listing |
| `HarvestStats` | interface | [L377](../../../../../../src/lib/harvest/listing-tracking.ts#L377) |  |
| `createHarvestStats` | function | [L395](../../../../../../src/lib/harvest/listing-tracking.ts#L395) | domain, sitemapTotal, processed, newListings, updatedListings, failed, geocoded, photosClassified, startTime |

Imports: `@aws-sdk/client-dynamodb`
