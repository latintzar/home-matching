# scripts/geo/import-osm-pois.ts

[Source](../../../../../scripts/geo/import-osm-pois.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `OSMFeature` | interface | [L52](../../../../../scripts/geo/import-osm-pois.ts#L52) |  |
| `getCentroid` | function | [L72](../../../../../scripts/geo/import-osm-pois.ts#L72) | geometry |
| `getAreaM2` | function | [L108](../../../../../scripts/geo/import-osm-pois.ts#L108) | geometry |
| `isNotable` | function | [L121](../../../../../scripts/geo/import-osm-pois.ts#L121) | props, areaM2 |
| `writeBatch` | function | [L132](../../../../../scripts/geo/import-osm-pois.ts#L132) | items |
| `importPOIType` | function | [L152](../../../../../scripts/geo/import-osm-pois.ts#L152) | poiType |
| `importOSMPOIs` | function | [L242](../../../../../scripts/geo/import-osm-pois.ts#L242) |  |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `fs`, `path`, `ngeohash`, `@turf/turf`
