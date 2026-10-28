# scripts/serp-research.ts

[Source](../../../../scripts/serp-research.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `SerpResult` | interface | [L106](../../../../scripts/serp-research.ts#L106) |  |
| `SerpExtraction` | interface | [L113](../../../../scripts/serp-research.ts#L113) |  |
| `getDocClient` | function | [L167](../../../../scripts/serp-research.ts#L167) |  |
| `searchSerper` | function | [L185](../../../../scripts/serp-research.ts#L185) | query |
| `extractFromSnippet` | function | [L267](../../../../scripts/serp-research.ts#L267) | result, neighborhoodId, city, neighborhood, category |
| `researchNeighborhood` | function | [L321](../../../../scripts/serp-research.ts#L321) | city, neighborhood |
| `researchCity` | function | [L366](../../../../scripts/serp-research.ts#L366) | city |
| `aggregateNeighborhoodProfiles` | function | [L423](../../../../scripts/serp-research.ts#L423) |  |
| `main` | function | [L602](../../../../scripts/serp-research.ts#L602) |  |

Imports: `fs`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `../src/lib/gemini-rest-client`
