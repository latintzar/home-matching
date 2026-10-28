# src/scripts/importNeighborhoods.ts

[Source](../../../../../src/scripts/importNeighborhoods.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `ensureTableExists` | function | [L78](../../../../../src/scripts/importNeighborhoods.ts#L78) |  |
| `buildOverpassQuery` | function | [L111](../../../../../src/scripts/importNeighborhoods.ts#L111) | bbox, adminLevel |
| `overpassToGeoJSON` | function | [L127](../../../../../src/scripts/importNeighborhoods.ts#L127) | data |
| `mergeRings` | function | [L203](../../../../../src/scripts/importNeighborhoods.ts#L203) | rings |
| `coordsEqual` | function | [L239](../../../../../src/scripts/importNeighborhoods.ts#L239) | a, b |
| `fetchNeighborhoods` | function | [L246](../../../../../src/scripts/importNeighborhoods.ts#L246) | cityKey |
| `importCity` | function | [L280](../../../../../src/scripts/importNeighborhoods.ts#L280) | cityKey |
| `importAllCities` | function | [L333](../../../../../src/scripts/importNeighborhoods.ts#L333) |  |
| `listNeighborhoods` | function | [L362](../../../../../src/scripts/importNeighborhoods.ts#L362) | cityKey |
| `main` | function | [L380](../../../../../src/scripts/importNeighborhoods.ts#L380) |  |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@turf/turf`
