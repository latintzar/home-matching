# src/lambda/serp-analyze-batch.ts

[Source](../../../../../src/lambda/serp-analyze-batch.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `Event` | interface | [L29](../../../../../src/lambda/serp-analyze-batch.ts#L29) |  |
| `PageContent` | interface | [L34](../../../../../src/lambda/serp-analyze-batch.ts#L34) |  |
| `extractMainContent` | function | [L40](../../../../../src/lambda/serp-analyze-batch.ts#L40) | html |
| `getDownloadedPages` | function | [L71](../../../../../src/lambda/serp-analyze-batch.ts#L71) | neighborhoodId |
| `callGeminiFlash` | function | [L108](../../../../../src/lambda/serp-analyze-batch.ts#L108) | prompt |
| `buildPrompt` | function | [L142](../../../../../src/lambda/serp-analyze-batch.ts#L142) | neighborhoodId, pages |
| `analyzeNeighborhood` | function | [L212](../../../../../src/lambda/serp-analyze-batch.ts#L212) | neighborhoodId |
| `getNeighborhoodsWithPages` | function | [L296](../../../../../src/lambda/serp-analyze-batch.ts#L296) | cityFilter |
| `handler` | function | [L322](../../../../../src/lambda/serp-analyze-batch.ts#L322) | event |

Imports: `@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `cheerio`
