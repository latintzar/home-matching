# src/lambda/serp-analyze-single.ts

[Source](../../../../../src/lambda/serp-analyze-single.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `Event` | interface | [L29](../../../../../src/lambda/serp-analyze-single.ts#L29) |  |
| `ExtractedContent` | interface | [L33](../../../../../src/lambda/serp-analyze-single.ts#L33) |  |
| `extractMainContent` | function | [L40](../../../../../src/lambda/serp-analyze-single.ts#L40) | html |
| `getDownloadedPages` | function | [L65](../../../../../src/lambda/serp-analyze-single.ts#L65) | neighborhoodId |
| `callGeminiFlash` | function | [L109](../../../../../src/lambda/serp-analyze-single.ts#L109) | prompt |
| `buildPrompt` | function | [L151](../../../../../src/lambda/serp-analyze-single.ts#L151) | neighborhoodId, pages |
| `handler` | function | [L222](../../../../../src/lambda/serp-analyze-single.ts#L222) | event |

Imports: `@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`
