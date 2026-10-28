# src/lib/data-adapter/dynamodb-adapter.ts

[Source](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `getDynamoDB` | function | [L27](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L27) |  |
| `existsInDynamoDB` | function | [L44](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L44) | listingId |
| `getListingFromDynamoDB` | function | [L62](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L62) | listingId, options |
| `saveListingToDynamoDB` | function | [L117](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L117) | listing |
| `getAnalysisFromDynamoDB` | function | [L163](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L163) | listingId, analysisType |
| `saveAnalysisToDynamoDB` | function | [L196](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L196) | listingId, analysisType, results |
| `getWPAFromDynamoDB` | function | [L222](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L222) | listingId |
| `saveWPAToDynamoDB` | function | [L261](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L261) | listingId, analysis, modelUsed, ttlDays |
| `queryListingsByCity` | function | [L289](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L289) | city, limit |
| `queryListingsByDomain` | function | [L330](../../../../../../src/lib/data-adapter/dynamodb-adapter.ts#L330) | domain, limit |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `./types`
