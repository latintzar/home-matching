# src/app/api/listings/[id]/analysis/citations-sweep/route.ts

[Source](../../../../../../../../../../src/app/api/listings/[id]/analysis/citations-sweep/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `requireRecipientConfiguration` | function | [L9](../../../../../../../../../../src/app/api/listings/[id]/analysis/citations-sweep/route.ts#L9) |  |
| `POST` | function | [L30](../../../../../../../../../../src/app/api/listings/[id]/analysis/citations-sweep/route.ts#L30) | request, destructured |
| `isPrimarySource` | function | [L512](../../../../../../../../../../src/app/api/listings/[id]/analysis/citations-sweep/route.ts#L512) | urlOrDomain, title, category |
| `isSecondarySource` | function | [L602](../../../../../../../../../../src/app/api/listings/[id]/analysis/citations-sweep/route.ts#L602) | urlOrDomain, title |
| `categorizeSourceType` | function | [L624](../../../../../../../../../../src/app/api/listings/[id]/analysis/citations-sweep/route.ts#L624) | urlOrDomain |
| `extractDomain` | function | [L663](../../../../../../../../../../src/app/api/listings/[id]/analysis/citations-sweep/route.ts#L663) | url |

Imports: `next/server`, `@supabase/supabase-js`, `@/lib/gemini-rest-client`, `@/lib/lazy-supabase`
