# src/parked/bulk-harvester/harvest/sitemap-html-downloader.ts

[Source](../../../../../../../src/parked/bulk-harvester/harvest/sitemap-html-downloader.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `DownloadResult` | interface | [L32](../../../../../../../src/parked/bulk-harvester/harvest/sitemap-html-downloader.ts#L32) |  |
| `downloadDomainUrls` | function | [L44](../../../../../../../src/parked/bulk-harvester/harvest/sitemap-html-downloader.ts#L44) | domain, options |
| `downloadUrl` | function | [L130](../../../../../../../src/parked/bulk-harvester/harvest/sitemap-html-downloader.ts#L130) | url, dryRun |
| `saveToS3` | function | [L185](../../../../../../../src/parked/bulk-harvester/harvest/sitemap-html-downloader.ts#L185) | key, html |
| `updateUrlStatus` | function | [L205](../../../../../../../src/parked/bulk-harvester/harvest/sitemap-html-downloader.ts#L205) | url, status, s3Key, error |
| `getSitemappedDomains` | function | [L242](../../../../../../../src/parked/bulk-harvester/harvest/sitemap-html-downloader.ts#L242) |  |
| `orchestrateSitemapDownload` | function | [L269](../../../../../../../src/parked/bulk-harvester/harvest/sitemap-html-downloader.ts#L269) | options |
| `handler` | function | [L360](../../../../../../../src/parked/bulk-harvester/harvest/sitemap-html-downloader.ts#L360) | event |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `@aws-sdk/client-lambda`, `zlib`, `./config`, `./url-canonicalizer`, `./alerts`
