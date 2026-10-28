# src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts

[Source](../../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `ManualCluster` | type | [L10](../../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts#L10) |  |
| `PhotosInput` | type | [L18](../../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts#L18) |  |
| `fetchAsBase64` | function | [L20](../../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts#L20) | url |
| `toPhotosPayload` | function | [L31](../../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts#L31) | cluster |
| `runF1Placement` | function | [L45](../../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts#L45) | listingId, roomId, photos |
| `pLimit` | function | [L105](../../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts#L105) | max, tasks |
| `next` | function | [L111](../../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts#L111) |  |
| `POST` | function | [L127](../../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts#L127) | req, destructured |

Imports: `next/server`, `@supabase/supabase-js`, `@/lib/gemini-rest-client`, `@/lib/lazy-supabase`
