# src/parked/bulk-harvester/lambda/daily-harvest-delta.ts

[Source](../../../../../../../src/parked/bulk-harvester/lambda/daily-harvest-delta.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `CrawlRecord` | interface | [L25](../../../../../../../src/parked/bulk-harvester/lambda/daily-harvest-delta.ts#L25) |  |
| `existsInS3` | function | [L36](../../../../../../../src/parked/bulk-harvester/lambda/daily-harvest-delta.ts#L36) | key |
| `fetchSitemapUrls` | function | [L51](../../../../../../../src/parked/bulk-harvester/lambda/daily-harvest-delta.ts#L51) | sitemapUrl |
| `fetchAndStoreHtml` | function | [L81](../../../../../../../src/parked/bulk-harvester/lambda/daily-harvest-delta.ts#L81) | url, domain |
| `urlToS3Key` | function | [L125](../../../../../../../src/parked/bulk-harvester/lambda/daily-harvest-delta.ts#L125) | url |
| `processDomain` | function | [L139](../../../../../../../src/parked/bulk-harvester/lambda/daily-harvest-delta.ts#L139) | record |
| `handler` | function | [L196](../../../../../../../src/parked/bulk-harvester/lambda/daily-harvest-delta.ts#L196) | event |

Imports: `@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `zlib`
