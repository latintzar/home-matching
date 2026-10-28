# src/app/api/pois/[type]/route.ts

[Source](../../../../../../../../src/app/api/pois/[type]/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `getClient` | function | [L56](../../../../../../../../src/app/api/pois/[type]/route.ts#L56) |  |
| `POIFeature` | interface | [L73](../../../../../../../../src/app/api/pois/[type]/route.ts#L73) |  |
| `POIResponse` | interface | [L87](../../../../../../../../src/app/api/pois/[type]/route.ts#L87) |  |
| `queryPOIsForPrefix` | function | [L106](../../../../../../../../src/app/api/pois/[type]/route.ts#L106) | type, prefix, filter |
| `queryPOIsForBbox` | function | [L145](../../../../../../../../src/app/api/pois/[type]/route.ts#L145) | type, bbox, filter, limit |
| `GET` | function | [L187](../../../../../../../../src/app/api/pois/[type]/route.ts#L187) | request, destructured |

Imports: `next/server`, `@aws-sdk/client-dynamodb`, `@aws-sdk/util-dynamodb`, `@/lib/geo/geohash-utils`
