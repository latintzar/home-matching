# src/lib/dynamodb.ts

[Source](../../../../../src/lib/dynamodb.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `Listing` | interface | [L52](../../../../../src/lib/dynamodb.ts#L52) |  |
| `getListing` | function | [L79](../../../../../src/lib/dynamodb.ts#L79) | domain, listingId |
| `getListingByUrl` | function | [L87](../../../../../src/lib/dynamodb.ts#L87) | url |
| `putListing` | function | [L105](../../../../../src/lib/dynamodb.ts#L105) | listing |
| `getListingsByCity` | function | [L118](../../../../../src/lib/dynamodb.ts#L118) | city, limit |
| `WPACache` | interface | [L133](../../../../../src/lib/dynamodb.ts#L133) |  |
| `getWPA` | function | [L149](../../../../../src/lib/dynamodb.ts#L149) | listingUrl |
| `putWPA` | function | [L157](../../../../../src/lib/dynamodb.ts#L157) | wpa |
| `AnalysisCache` | interface | [L174](../../../../../src/lib/dynamodb.ts#L174) |  |
| `getAnalysis` | function | [L182](../../../../../src/lib/dynamodb.ts#L182) | listingId, analysisType |
| `putAnalysis` | function | [L190](../../../../../src/lib/dynamodb.ts#L190) | analysis |
| `getAllAnalyses` | function | [L203](../../../../../src/lib/dynamodb.ts#L203) | listingId |
| `ScrapingRule` | interface | [L216](../../../../../src/lib/dynamodb.ts#L216) |  |
| `getScrapingRule` | function | [L226](../../../../../src/lib/dynamodb.ts#L226) | domain |
| `putScrapingRule` | function | [L234](../../../../../src/lib/dynamodb.ts#L234) | rule |
| `CrawlTracking` | interface | [L245](../../../../../src/lib/dynamodb.ts#L245) |  |
| `getCrawlTracking` | function | [L257](../../../../../src/lib/dynamodb.ts#L257) | domain |
| `updateCrawlTracking` | function | [L265](../../../../../src/lib/dynamodb.ts#L265) | domain, updates |
| `GeoIntelligence` | interface | [L293](../../../../../src/lib/dynamodb.ts#L293) |  |
| `getGeoInsights` | function | [L309](../../../../../src/lib/dynamodb.ts#L309) | geohash |
| `putGeoInsight` | function | [L318](../../../../../src/lib/dynamodb.ts#L318) | insight |
| `MarketVelocity` | interface | [L332](../../../../../src/lib/dynamodb.ts#L332) |  |
| `getMarketVelocity` | function | [L343](../../../../../src/lib/dynamodb.ts#L343) | locationKey, period |
| `NeighborhoodBoundary` | interface | [L355](../../../../../src/lib/dynamodb.ts#L355) |  |
| `getNeighborhoodBoundaries` | function | [L364](../../../../../src/lib/dynamodb.ts#L364) | city |
| `putNeighborhoodBoundary` | function | [L373](../../../../../src/lib/dynamodb.ts#L373) | neighborhood |
| `getNeighborhood` | function | [L380](../../../../../src/lib/dynamodb.ts#L380) | city, neighborhoodId |
| `checkForBase64Images` | function | [L406](../../../../../src/lib/dynamodb.ts#L406) | value, path |
| `rejectBase64Images` | function | [L435](../../../../../src/lib/dynamodb.ts#L435) | item |
| `listingExists` | function | [L446](../../../../../src/lib/dynamodb.ts#L446) | url |
| `getListingPhotos` | function | [L455](../../../../../src/lib/dynamodb.ts#L455) | domain, listingId |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`
