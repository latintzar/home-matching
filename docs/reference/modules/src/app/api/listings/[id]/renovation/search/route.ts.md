# src/app/api/listings/[id]/renovation/search/route.ts

[Source](../../../../../../../../../../src/app/api/listings/[id]/renovation/search/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `requireRecipientConfiguration` | function | [L10](../../../../../../../../../../src/app/api/listings/[id]/renovation/search/route.ts#L10) |  |
| `POST` | function | [L31](../../../../../../../../../../src/app/api/listings/[id]/renovation/search/route.ts#L31) | request, destructured |
| `generateResearchQueries` | function | [L162](../../../../../../../../../../src/app/api/listings/[id]/renovation/search/route.ts#L162) | strategy, location |
| `queryLegalRAG` | function | [L206](../../../../../../../../../../src/app/api/listings/[id]/renovation/search/route.ts#L206) | queries, location |
| `queryPricingStore` | function | [L239](../../../../../../../../../../src/app/api/listings/[id]/renovation/search/route.ts#L239) | queries, location |
| `queryScrapingDog` | function | [L275](../../../../../../../../../../src/app/api/listings/[id]/renovation/search/route.ts#L275) | queries |

Imports: `next/server`, `@supabase/supabase-js`, `@/lib/gemini-rest-client`, `@/lib/vertex-rag`, `@/lib/lazy-supabase`
