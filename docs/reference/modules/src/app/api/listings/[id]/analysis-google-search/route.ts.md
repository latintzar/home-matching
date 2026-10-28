# src/app/api/listings/[id]/analysis-google-search/route.ts

[Source](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `limitConcurrency` | function | [L25](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L25) | items, maxConcurrency, handler |
| `processNext` | function | [L40](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L40) |  |
| `AnalysisGoogleSearchOptions` | interface | [L89](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L89) |  |
| `parseGeminiJsonResponse` | function | [L101](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L101) | text, categoryName, logger |
| `fetchPhotoAnalysisSummaries` | function | [L166](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L166) | listingId, logger |
| `scoreDomainsForCredibility` | function | [L256](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L256) | urls, options, requestOrigin, logger |
| `processBatch` | function | [L280](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L280) | batch |
| `curateCategory` | function | [L324](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L324) | categoryId, snippets, maxSnippets, propertyData, logger |
| `POST` | function | [L464](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L464) | request, destructured |
| `processBarrelB` | function | [L694](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L694) | category, index |
| `CuratedResult` | type | [L926](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L926) |  |
| `processCuration` | function | [L927](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L927) | destructured, index |

Imports: `next/server`, `@supabase/supabase-js`, `@/lib/prompts/research-queries-advanced`, `@/lib/google-search`, `@/lib/gemini-rest-client`, `@/lib/orchestrator-progress`, `@/lib/vertex-rag`, `@/lib/pipeline-versions`
