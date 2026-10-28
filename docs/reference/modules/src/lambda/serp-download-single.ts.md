# src/lambda/serp-download-single.ts

[Source](../../../../../src/lambda/serp-download-single.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `Event` | interface | [L25](../../../../../src/lambda/serp-download-single.ts#L25) |  |
| `getS3Key` | function | [L33](../../../../../src/lambda/serp-download-single.ts#L33) | url, neighborhoodId |
| `downloadWithScrapingDog` | function | [L39](../../../../../src/lambda/serp-download-single.ts#L39) | url |
| `downloadDirect` | function | [L58](../../../../../src/lambda/serp-download-single.ts#L58) | url |
| `updateStatus` | function | [L78](../../../../../src/lambda/serp-download-single.ts#L78) | pageId, neighborhoodId, s3Key, status |
| `handler` | function | [L98](../../../../../src/lambda/serp-download-single.ts#L98) | event |

Imports: `@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `crypto`
