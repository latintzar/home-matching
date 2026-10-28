# scripts/analyze-serp-fulltext.ts

[Source](../../../../scripts/analyze-serp-fulltext.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `CostTracker` | interface | [L30](../../../../scripts/analyze-serp-fulltext.ts#L30) |  |
| `ExtractedContent` | interface | [L37](../../../../scripts/analyze-serp-fulltext.ts#L37) |  |
| `extractMainContent` | function | [L45](../../../../scripts/analyze-serp-fulltext.ts#L45) | html |
| `getDownloadedPages` | function | [L80](../../../../scripts/analyze-serp-fulltext.ts#L80) | neighborhoodId |
| `callGeminiFlashLite` | function | [L126](../../../../scripts/analyze-serp-fulltext.ts#L126) | prompt, tracker |
| `buildAnalysisPrompt` | function | [L173](../../../../scripts/analyze-serp-fulltext.ts#L173) | neighborhoodId, pages |
| `getNeighborhoodsWithPages` | function | [L242](../../../../scripts/analyze-serp-fulltext.ts#L242) | cityFilter |
| `main` | function | [L277](../../../../scripts/analyze-serp-fulltext.ts#L277) |  |

Imports: `@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `cheerio`
