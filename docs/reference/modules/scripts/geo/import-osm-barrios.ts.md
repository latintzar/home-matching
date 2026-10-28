# scripts/geo/import-osm-barrios.ts

[Source](../../../../../scripts/geo/import-osm-barrios.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `BarrioFeature` | interface | [L29](../../../../../scripts/geo/import-osm-barrios.ts#L29) |  |
| `calculateCentroid` | function | [L49](../../../../../scripts/geo/import-osm-barrios.ts#L49) | geometry |
| `calculateBbox` | function | [L84](../../../../../scripts/geo/import-osm-barrios.ts#L84) | geometry |
| `inferCity` | function | [L122](../../../../../scripts/geo/import-osm-barrios.ts#L122) | centroid |
| `normalizeBarrioName` | function | [L145](../../../../../scripts/geo/import-osm-barrios.ts#L145) | name |
| `writeBatch` | function | [L155](../../../../../scripts/geo/import-osm-barrios.ts#L155) | items |
| `importBarrios` | function | [L193](../../../../../scripts/geo/import-osm-barrios.ts#L193) |  |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `fs`, `path`, `ngeohash`
