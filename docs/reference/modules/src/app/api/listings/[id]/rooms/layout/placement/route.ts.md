# src/app/api/listings/[id]/rooms/layout/placement/route.ts

[Source](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `ClusterRow` | type | [L11](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts#L11) |  |
| `PlacementPhoto` | type | [L18](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts#L18) |  |
| `PlacementResult` | type | [L19](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts#L19) |  |
| `Base64Image` | type | [L20](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts#L20) |  |
| `fetchAsBase64` | function | [L22](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts#L22) | url, attempts |
| `runF1ForRoom` | function | [L43](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts#L43) | listingId, roomId, photoUrls |
| `limitConcurrency` | function | [L152](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts#L152) | items, limit, handler |
| `POST` | function | [L173](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts#L173) | req, destructured |
| `GET` | function | [L225](../../../../../../../../../../../src/app/api/listings/[id]/rooms/layout/placement/route.ts#L225) |  |

Imports: `next/server`, `@supabase/supabase-js`, `@/lib/gemini-rest-client`
