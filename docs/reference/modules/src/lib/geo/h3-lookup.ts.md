# src/lib/geo/h3-lookup.ts

[Source](../../../../../../src/lib/geo/h3-lookup.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `getDocClient` | function | [L32](../../../../../../src/lib/geo/h3-lookup.ts#L32) |  |
| `H3LookupEntry` | interface | [L50](../../../../../../src/lib/geo/h3-lookup.ts#L50) |  |
| `NeighborhoodCoordinates` | interface | [L57](../../../../../../src/lib/geo/h3-lookup.ts#L57) |  |
| `latLngToH3` | function | [L72](../../../../../../src/lib/geo/h3-lookup.ts#L72) | lat, lng |
| `getH3CoverageForNeighborhood` | function | [L80](../../../../../../src/lib/geo/h3-lookup.ts#L80) | lat, lng, ringSize |
| `buildH3LookupTable` | function | [L92](../../../../../../src/lib/geo/h3-lookup.ts#L92) | neighborhoods |
| `lookupNeighborhood` | function | [L149](../../../../../../src/lib/geo/h3-lookup.ts#L149) | lat, lng |
| `batchLookupNeighborhoods` | function | [L177](../../../../../../src/lib/geo/h3-lookup.ts#L177) | coordinates |
| `geocodeNeighborhood` | function | [L213](../../../../../../src/lib/geo/h3-lookup.ts#L213) | neighborhood, city |
| `batchGeocodeNeighborhoods` | function | [L253](../../../../../../src/lib/geo/h3-lookup.ts#L253) | neighborhoods |
| `preloadH3Cache` | function | [L289](../../../../../../src/lib/geo/h3-lookup.ts#L289) |  |
| `lookupNeighborhoodFast` | function | [L315](../../../../../../src/lib/geo/h3-lookup.ts#L315) | lat, lng |

Imports: `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-dynamodb`, `h3-js`
