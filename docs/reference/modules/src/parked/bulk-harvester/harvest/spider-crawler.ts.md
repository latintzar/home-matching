# src/parked/bulk-harvester/harvest/spider-crawler.ts

[Source](../../../../../../../src/parked/bulk-harvester/harvest/spider-crawler.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `SpiderResult` | interface | [L26](../../../../../../../src/parked/bulk-harvester/harvest/spider-crawler.ts#L26) |  |
| `CrawlState` | interface | [L37](../../../../../../../src/parked/bulk-harvester/harvest/spider-crawler.ts#L37) |  |
| `spiderDomain` | function | [L48](../../../../../../../src/parked/bulk-harvester/harvest/spider-crawler.ts#L48) | domain, options |
| `processUrl` | function | [L176](../../../../../../../src/parked/bulk-harvester/harvest/spider-crawler.ts#L176) | url, state, dryRun |
| `extractLinks` | function | [L253](../../../../../../../src/parked/bulk-harvester/harvest/spider-crawler.ts#L253) | html, baseUrl, targetDomain |
| `urlToS3Key` | function | [L286](../../../../../../../src/parked/bulk-harvester/harvest/spider-crawler.ts#L286) | url |
| `saveToS3` | function | [L297](../../../../../../../src/parked/bulk-harvester/harvest/spider-crawler.ts#L297) | key, html |
| `recordUrl` | function | [L317](../../../../../../../src/parked/bulk-harvester/harvest/spider-crawler.ts#L317) | record |
| `updateCrawlStatus` | function | [L327](../../../../../../../src/parked/bulk-harvester/harvest/spider-crawler.ts#L327) | status |
| `spiderDomainsBatch` | function | [L337](../../../../../../../src/parked/bulk-harvester/harvest/spider-crawler.ts#L337) | domains, options |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `cheerio`, `zlib`, `./config`
