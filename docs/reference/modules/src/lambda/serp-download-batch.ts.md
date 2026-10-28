# src/lambda/serp-download-batch.ts

[Source](../../../../../src/lambda/serp-download-batch.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `Event` | interface | [L29](../../../../../src/lambda/serp-download-batch.ts#L29) |  |
| `SerpItem` | interface | [L35](../../../../../src/lambda/serp-download-batch.ts#L35) |  |
| `getS3Key` | function | [L43](../../../../../src/lambda/serp-download-batch.ts#L43) | url, neighborhoodId |
| `existsInS3` | function | [L53](../../../../../src/lambda/serp-download-batch.ts#L53) | key |
| `getUrlsToDownload` | function | [L62](../../../../../src/lambda/serp-download-batch.ts#L62) | cityFilter, limit |
| `downloadAndStore` | function | [L99](../../../../../src/lambda/serp-download-batch.ts#L99) | item |
| `updateStatus` | function | [L151](../../../../../src/lambda/serp-download-batch.ts#L151) | item, status, s3Key |
| `handler` | function | [L178](../../../../../src/lambda/serp-download-batch.ts#L178) | event |

Imports: `@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `crypto`, `./serp-analyze-batch`
