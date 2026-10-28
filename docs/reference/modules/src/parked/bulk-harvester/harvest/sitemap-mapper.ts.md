# src/parked/bulk-harvester/harvest/sitemap-mapper.ts

[Source](../../../../../../../src/parked/bulk-harvester/harvest/sitemap-mapper.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `SitemapUrl` | interface | [L17](../../../../../../../src/parked/bulk-harvester/harvest/sitemap-mapper.ts#L17) |  |
| `SitemapMapperResult` | interface | [L22](../../../../../../../src/parked/bulk-harvester/harvest/sitemap-mapper.ts#L22) |  |
| `mapSitemap` | function | [L35](../../../../../../../src/parked/bulk-harvester/harvest/sitemap-mapper.ts#L35) | domain, sitemapUrl, options |
| `fetchSitemapUrls` | function | [L126](../../../../../../../src/parked/bulk-harvester/harvest/sitemap-mapper.ts#L126) | sitemapUrl, depth |
| `batchWriteUrls` | function | [L189](../../../../../../../src/parked/bulk-harvester/harvest/sitemap-mapper.ts#L189) | urls |
| `updateCrawlStatus` | function | [L232](../../../../../../../src/parked/bulk-harvester/harvest/sitemap-mapper.ts#L232) | status |
| `mapSitemapsBatch` | function | [L242](../../../../../../../src/parked/bulk-harvester/harvest/sitemap-mapper.ts#L242) | domains, options |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `cheerio`, `./config`
