# src/scripts/harvest_agencies/full-listing-census.ts

[Source](../../../../../../src/scripts/harvest_agencies/full-listing-census.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `DomainData` | interface | [L31](../../../../../../src/scripts/harvest_agencies/full-listing-census.ts#L31) |  |
| `UrlData` | interface | [L39](../../../../../../src/scripts/harvest_agencies/full-listing-census.ts#L39) |  |
| `DomainResult` | interface | [L45](../../../../../../src/scripts/harvest_agencies/full-listing-census.ts#L45) |  |
| `fetchWithTimeout` | function | [L55](../../../../../../src/scripts/harvest_agencies/full-listing-census.ts#L55) | url |
| `classifyUrl` | function | [L71](../../../../../../src/scripts/harvest_agencies/full-listing-census.ts#L71) | url, domainType, domainSalePattern, domainRentPattern |
| `fetchSitemapData` | function | [L107](../../../../../../src/scripts/harvest_agencies/full-listing-census.ts#L107) | sitemapUrl, domainType, salePattern, rentPattern, depth |
| `main` | function | [L152](../../../../../../src/scripts/harvest_agencies/full-listing-census.ts#L152) |  |
| `processBatch` | function | [L191](../../../../../../src/scripts/harvest_agencies/full-listing-census.ts#L191) | batch |

Imports: `fs`, `csv-parse/sync`, `cheerio`
