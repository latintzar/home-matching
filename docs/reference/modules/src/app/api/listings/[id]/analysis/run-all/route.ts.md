# src/app/api/listings/[id]/analysis/run-all/route.ts

[Source](../../../../../../../../../../src/app/api/listings/[id]/analysis/run-all/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `assignPhotosToClusters` | function | [L24](../../../../../../../../../../src/app/api/listings/[id]/analysis/run-all/route.ts#L24) | listingId |
| `generateWholePropertyAnalysis` | function | [L104](../../../../../../../../../../src/app/api/listings/[id]/analysis/run-all/route.ts#L104) | listingId |
| `generateRoomAnalysis` | function | [L195](../../../../../../../../../../src/app/api/listings/[id]/analysis/run-all/route.ts#L195) | listingId |
| `generateIntegratedReport` | function | [L260](../../../../../../../../../../src/app/api/listings/[id]/analysis/run-all/route.ts#L260) | listingId, wholePropertyAnalysis, roomAnalyses |
| `saveAnalysisResults` | function | [L371](../../../../../../../../../../src/app/api/listings/[id]/analysis/run-all/route.ts#L371) | listingId, integratedReport |
| `POST` | function | [L399](../../../../../../../../../../src/app/api/listings/[id]/analysis/run-all/route.ts#L399) | request, destructured |

Imports: `next/server`, `@supabase/supabase-js`, `@google-cloud/vertexai`
