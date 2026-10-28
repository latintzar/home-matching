# src/scripts/harvest_agencies/s3-html-crawler.ts

[Source](../../../../../../src/scripts/harvest_agencies/s3-html-crawler.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `CrawlStats` | interface | [L56](../../../../../../src/scripts/harvest_agencies/s3-html-crawler.ts#L56) |  |
| `isListingUrl` | function | [L65](../../../../../../src/scripts/harvest_agencies/s3-html-crawler.ts#L65) | url |
| `getS3Key` | function | [L80](../../../../../../src/scripts/harvest_agencies/s3-html-crawler.ts#L80) | url |
| `getAlreadyCrawledDomains` | function | [L92](../../../../../../src/scripts/harvest_agencies/s3-html-crawler.ts#L92) |  |
| `existsInS3` | function | [L122](../../../../../../src/scripts/harvest_agencies/s3-html-crawler.ts#L122) | key |
| `fetchHtml` | function | [L134](../../../../../../src/scripts/harvest_agencies/s3-html-crawler.ts#L134) | url |
| `sleep` | function | [L161](../../../../../../src/scripts/harvest_agencies/s3-html-crawler.ts#L161) | ms |
| `uploadToS3WithRetry` | function | [L165](../../../../../../src/scripts/harvest_agencies/s3-html-crawler.ts#L165) | key, html, maxRetries |
| `uploadToS3` | function | [L207](../../../../../../src/scripts/harvest_agencies/s3-html-crawler.ts#L207) | key, html |
| `fetchSitemapUrls` | function | [L211](../../../../../../src/scripts/harvest_agencies/s3-html-crawler.ts#L211) | sitemapUrl, visited |
| `crawlDomain` | function | [L262](../../../../../../src/scripts/harvest_agencies/s3-html-crawler.ts#L262) | domain, sitemapUrl, stats, maxUrls |
| `main` | function | [L318](../../../../../../src/scripts/harvest_agencies/s3-html-crawler.ts#L318) |  |

Imports: `fs`, `path`, `zlib`, `csv-parse/sync`, `@aws-sdk/client-s3`, `dotenv`
