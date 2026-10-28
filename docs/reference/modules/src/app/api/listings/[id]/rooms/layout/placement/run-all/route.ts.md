# src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts

[Source](../../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `ManualCluster` | type | [L9](../../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts#L9) |  |
| `PhotosInput` | type | [L17](../../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts#L17) |  |
| `fetchAsBase64` | function | [L19](../../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts#L19) | url |
| `toPhotosPayload` | function | [L30](../../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts#L30) | cluster |
| `runF1Placement` | function | [L44](../../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts#L44) | listingId, roomId, photos |
| `pLimit` | function | [L104](../../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts#L104) | max, tasks |
| `next` | function | [L110](../../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts#L110) |  |
| `POST` | function | [L126](../../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/run-all/route.ts#L126) | req, destructured |

Imports: `next/server`, `@supabase/supabase-js`, `@/lib/gemini-rest-client`
