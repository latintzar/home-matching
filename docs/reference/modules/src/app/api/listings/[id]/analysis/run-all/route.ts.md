# src/app/api/listings/[id]/analysis/run-all/route.ts

[Source](../../../../../../../../../../src/app/api/listings/[id]/analysis/run-all/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `requireRecipientConfiguration` | function | [L10](../../../../../../../../../../src/app/api/listings/[id]/analysis/run-all/route.ts#L10) |  |
| `assignPhotosToClusters` | function | [L28](../../../../../../../../../../src/app/api/listings/[id]/analysis/run-all/route.ts#L28) | listingId |
| `generateWholePropertyAnalysis` | function | [L108](../../../../../../../../../../src/app/api/listings/[id]/analysis/run-all/route.ts#L108) | listingId |
| `generateRoomAnalysis` | function | [L199](../../../../../../../../../../src/app/api/listings/[id]/analysis/run-all/route.ts#L199) | listingId |
| `generateIntegratedReport` | function | [L264](../../../../../../../../../../src/app/api/listings/[id]/analysis/run-all/route.ts#L264) | listingId, wholePropertyAnalysis, roomAnalyses |
| `saveAnalysisResults` | function | [L375](../../../../../../../../../../src/app/api/listings/[id]/analysis/run-all/route.ts#L375) | listingId, integratedReport |
| `POST` | function | [L403](../../../../../../../../../../src/app/api/listings/[id]/analysis/run-all/route.ts#L403) | request, destructured |

Imports: `next/server`, `@supabase/supabase-js`, `@google-cloud/vertexai`, `@/lib/lazy-supabase`, `@/lib/lazy-resource.mjs`
