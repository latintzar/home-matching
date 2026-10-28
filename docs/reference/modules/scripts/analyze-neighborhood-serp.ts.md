# scripts/analyze-neighborhood-serp.ts

[Source](../../../../scripts/analyze-neighborhood-serp.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `CostTracker` | interface | [L20](../../../../scripts/analyze-neighborhood-serp.ts#L20) |  |
| `SerpExtraction` | interface | [L26](../../../../scripts/analyze-neighborhood-serp.ts#L26) |  |
| `NeighborhoodProfile` | interface | [L38](../../../../scripts/analyze-neighborhood-serp.ts#L38) |  |
| `callGeminiFlashLite` | function | [L110](../../../../scripts/analyze-neighborhood-serp.ts#L110) | prompt, tracker |
| `buildAnalysisPrompt` | function | [L156](../../../../scripts/analyze-neighborhood-serp.ts#L156) | neighborhoodId, serpData |
| `SerpResult` | interface | [L214](../../../../scripts/analyze-neighborhood-serp.ts#L214) |  |
| `getNeighborhoodSerpData` | function | [L222](../../../../scripts/analyze-neighborhood-serp.ts#L222) | docClient, neighborhoodId |
| `analyzeNeighborhood` | function | [L259](../../../../scripts/analyze-neighborhood-serp.ts#L259) | docClient, neighborhoodId, tracker, dryRun |
| `getUniqueNeighborhoods` | function | [L349](../../../../scripts/analyze-neighborhood-serp.ts#L349) | docClient, cityFilter |
| `main` | function | [L377](../../../../scripts/analyze-neighborhood-serp.ts#L377) |  |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`
