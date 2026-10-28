# src/parked/bulk-harvester/lambda/classify-single.ts

[Source](../../../../../../../src/parked/bulk-harvester/lambda/classify-single.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `Event` | interface | [L24](../../../../../../../src/parked/bulk-harvester/lambda/classify-single.ts#L24) |  |
| `getHtmlFromS3` | function | [L33](../../../../../../../src/parked/bulk-harvester/lambda/classify-single.ts#L33) | s3Key |
| `updateUrlClassification` | function | [L60](../../../../../../../src/parked/bulk-harvester/lambda/classify-single.ts#L60) | url, domain, classification |
| `markClassificationFailure` | function | [L79](../../../../../../../src/parked/bulk-harvester/lambda/classify-single.ts#L79) | url, domain, error |
| `saveToDeltaSources` | function | [L113](../../../../../../../src/parked/bulk-harvester/lambda/classify-single.ts#L113) | url, domain, classification |
| `handler` | function | [L128](../../../../../../../src/parked/bulk-harvester/lambda/classify-single.ts#L128) | event |

Imports: `@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`, `../harvest/page-classifier`
