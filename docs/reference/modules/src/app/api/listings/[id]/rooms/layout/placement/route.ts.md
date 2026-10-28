# src/app/api/listings/[id]/rooms/layout/placement/route.ts

[Source](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `ClusterRow` | type | [L12](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts#L12) |  |
| `PlacementPhoto` | type | [L19](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts#L19) |  |
| `PlacementResult` | type | [L20](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts#L20) |  |
| `Base64Image` | type | [L21](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts#L21) |  |
| `fetchAsBase64` | function | [L23](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts#L23) | url, attempts |
| `runF1ForRoom` | function | [L44](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts#L44) | listingId, roomId, photoUrls |
| `limitConcurrency` | function | [L153](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts#L153) | items, limit, handler |
| `POST` | function | [L174](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts#L174) | req, destructured |
| `GET` | function | [L226](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts#L226) |  |

Imports: `next/server`, `@supabase/supabase-js`, `@/lib/gemini-rest-client`, `@/lib/lazy-supabase`
