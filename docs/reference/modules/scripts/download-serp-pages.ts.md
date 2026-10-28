# scripts/download-serp-pages.ts

[Source](../../../../scripts/download-serp-pages.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `SerpItem` | interface | [L29](../../../../scripts/download-serp-pages.ts#L29) |  |
| `DownloadStats` | interface | [L42](../../../../scripts/download-serp-pages.ts#L42) |  |
| `getS3Key` | function | [L50](../../../../scripts/download-serp-pages.ts#L50) | url, neighborhoodId |
| `downloadWithScrapingDog` | function | [L57](../../../../scripts/download-serp-pages.ts#L57) | url |
| `downloadDirect` | function | [L97](../../../../scripts/download-serp-pages.ts#L97) | url |
| `updateSerpItem` | function | [L122](../../../../scripts/download-serp-pages.ts#L122) | pageId, neighborhoodId, s3Key, status |
| `getUrlsToDownload` | function | [L145](../../../../scripts/download-serp-pages.ts#L145) | cityFilter, limit |
| `main` | function | [L190](../../../../scripts/download-serp-pages.ts#L190) |  |

Imports: `@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `crypto`
