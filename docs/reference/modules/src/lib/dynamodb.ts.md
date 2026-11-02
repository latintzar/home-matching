# src/lib/dynamodb.ts

[Source](../../../../../src/lib/dynamodb.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `Listing` | interface | [L53](../../../../../src/lib/dynamodb.ts#L53) |  |
| `getListing` | function | [L80](../../../../../src/lib/dynamodb.ts#L80) | domain, listingId |
| `getListingByUrl` | function | [L88](../../../../../src/lib/dynamodb.ts#L88) | url |
| `putListing` | function | [L106](../../../../../src/lib/dynamodb.ts#L106) | listing |
| `getListingsByCity` | function | [L119](../../../../../src/lib/dynamodb.ts#L119) | city, limit |
| `WPACache` | interface | [L134](../../../../../src/lib/dynamodb.ts#L134) |  |
| `getWPA` | function | [L150](../../../../../src/lib/dynamodb.ts#L150) | listingUrl |
| `putWPA` | function | [L158](../../../../../src/lib/dynamodb.ts#L158) | wpa |
| `AnalysisCache` | interface | [L175](../../../../../src/lib/dynamodb.ts#L175) |  |
| `getAnalysis` | function | [L183](../../../../../src/lib/dynamodb.ts#L183) | listingId, analysisType |
| `putAnalysis` | function | [L191](../../../../../src/lib/dynamodb.ts#L191) | analysis |
| `getAllAnalyses` | function | [L204](../../../../../src/lib/dynamodb.ts#L204) | listingId |
| `ScrapingRule` | interface | [L217](../../../../../src/lib/dynamodb.ts#L217) |  |
| `getScrapingRule` | function | [L227](../../../../../src/lib/dynamodb.ts#L227) | domain |
| `putScrapingRule` | function | [L235](../../../../../src/lib/dynamodb.ts#L235) | rule |
| `CrawlTracking` | interface | [L246](../../../../../src/lib/dynamodb.ts#L246) |  |
| `getCrawlTracking` | function | [L258](../../../../../src/lib/dynamodb.ts#L258) | domain |
| `updateCrawlTracking` | function | [L266](../../../../../src/lib/dynamodb.ts#L266) | domain, updates |
| `GeoIntelligence` | interface | [L294](../../../../../src/lib/dynamodb.ts#L294) |  |
| `getGeoInsights` | function | [L310](../../../../../src/lib/dynamodb.ts#L310) | geohash |
| `putGeoInsight` | function | [L319](../../../../../src/lib/dynamodb.ts#L319) | insight |
| `MarketVelocity` | interface | [L333](../../../../../src/lib/dynamodb.ts#L333) |  |
| `getMarketVelocity` | function | [L344](../../../../../src/lib/dynamodb.ts#L344) | locationKey, period |
| `NeighborhoodBoundary` | interface | [L356](../../../../../src/lib/dynamodb.ts#L356) |  |
| `getNeighborhoodBoundaries` | function | [L365](../../../../../src/lib/dynamodb.ts#L365) | city |
| `putNeighborhoodBoundary` | function | [L374](../../../../../src/lib/dynamodb.ts#L374) | neighborhood |
| `getNeighborhood` | function | [L381](../../../../../src/lib/dynamodb.ts#L381) | city, neighborhoodId |
| `checkForBase64Images` | function | [L407](../../../../../src/lib/dynamodb.ts#L407) | value, path |
| `rejectBase64Images` | function | [L436](../../../../../src/lib/dynamodb.ts#L436) | item |
| `listingExists` | function | [L447](../../../../../src/lib/dynamodb.ts#L447) | url |
| `getListingPhotos` | function | [L456](../../../../../src/lib/dynamodb.ts#L456) | domain, listingId |

Imports: `@aws-sdk/client-dynamodb`, `./wpa/table-contracts`, `@aws-sdk/lib-dynamodb`
