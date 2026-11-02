# src/lib/data-adapter/dynamodb-adapter.ts

[Source](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `getDynamoDB` | function | [L27](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L27) |  |
| `existsInDynamoDB` | function | [L45](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L45) | listingId |
| `getListingFromDynamoDB` | function | [L63](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L63) | listingId, options |
| `saveListingToDynamoDB` | function | [L118](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L118) | listing |
| `getAnalysisFromDynamoDB` | function | [L164](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L164) | listingId, analysisType |
| `saveAnalysisToDynamoDB` | function | [L197](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L197) | listingId, analysisType, results |
| `getWPAFromDynamoDB` | function | [L223](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L223) | listingId |
| `saveWPAToDynamoDB` | function | [L262](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L262) | listingId, analysis, modelUsed, ttlDays |
| `queryListingsByCity` | function | [L290](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L290) | city, limit |
| `queryListingsByDomain` | function | [L331](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L331) | domain, limit |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `./types`
