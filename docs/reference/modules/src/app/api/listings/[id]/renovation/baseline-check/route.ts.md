# src/app/api/listings/[id]/renovation/baseline-check/route.ts

[Source](../../../../../../../../../../src/app/api/listings/[id]/renovation/baseline-check/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `requireRecipientConfiguration` | function | [L10](../../../../../../../../../../src/app/api/listings/[id]/renovation/baseline-check/route.ts#L10) |  |
| `extractPriceFromText` | function | [L22](../../../../../../../../../../src/app/api/listings/[id]/renovation/baseline-check/route.ts#L22) | text, context |
| `queryPricingStore` | function | [L68](../../../../../../../../../../src/app/api/listings/[id]/renovation/baseline-check/route.ts#L68) | queries, roomContext |
| `POST` | function | [L130](../../../../../../../../../../src/app/api/listings/[id]/renovation/baseline-check/route.ts#L130) | request, destructured |
| `findAnalysis` | function | [L165](../../../../../../../../../../src/app/api/listings/[id]/renovation/baseline-check/route.ts#L165) | name |

Imports: `next/server`, `@supabase/supabase-js`, `@/lib/gemini-rest-client`, `@/lib/vertex-rag`, `@/lib/lazy-supabase`
