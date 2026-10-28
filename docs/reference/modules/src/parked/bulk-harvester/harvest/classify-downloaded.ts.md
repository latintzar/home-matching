# src/parked/bulk-harvester/harvest/classify-downloaded.ts

[Source](../../../../../../../src/parked/bulk-harvester/harvest/classify-downloaded.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `ClassificationStats` | interface | [L39](../../../../../../../src/parked/bulk-harvester/harvest/classify-downloaded.ts#L39) |  |
| `getHtmlFromS3` | function | [L53](../../../../../../../src/parked/bulk-harvester/harvest/classify-downloaded.ts#L53) | s3Key |
| `updateUrlClassification` | function | [L79](../../../../../../../src/parked/bulk-harvester/harvest/classify-downloaded.ts#L79) | url, classification |
| `classifyDomain` | function | [L112](../../../../../../../src/parked/bulk-harvester/harvest/classify-downloaded.ts#L112) | domain, options |
| `classifyAll` | function | [L215](../../../../../../../src/parked/bulk-harvester/harvest/classify-downloaded.ts#L215) | options |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `zlib`, `util`, `./config`, `./page-classifier`, `./alerts`
