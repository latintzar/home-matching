# src/app/api/listings/[id]/analysis-google-search/route.ts

[Source](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `limitConcurrency` | function | [L26](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L26) | items, maxConcurrency, handler |
| `processNext` | function | [L41](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L41) |  |
| `requireRecipientConfiguration` | function | [L84](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L84) |  |
| `AnalysisGoogleSearchOptions` | interface | [L92](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L92) |  |
| `parseGeminiJsonResponse` | function | [L104](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L104) | text, categoryName, logger |
| `fetchPhotoAnalysisSummaries` | function | [L169](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L169) | listingId, logger |
| `scoreDomainsForCredibility` | function | [L259](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L259) | urls, options, requestOrigin, logger |
| `processBatch` | function | [L283](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L283) | batch |
| `curateCategory` | function | [L327](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L327) | categoryId, snippets, maxSnippets, propertyData, logger |
| `POST` | function | [L467](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L467) | request, destructured |
| `processBarrelB` | function | [L697](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L697) | category, index |
| `CuratedResult` | type | [L929](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L929) |  |
| `processCuration` | function | [L930](../../../../../../../../../src/app/api/listings/[id]/analysis-google-search/route.ts#L930) | destructured, index |

Imports: `next/server`, `@supabase/supabase-js`, `@/lib/prompts/research-queries-advanced`, `@/lib/google-search`, `@/lib/gemini-rest-client`, `@/lib/orchestrator-progress`, `@/lib/vertex-rag`, `@/lib/pipeline-versions`, `@/lib/lazy-supabase`
