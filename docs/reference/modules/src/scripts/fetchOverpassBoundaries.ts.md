# src/scripts/fetchOverpassBoundaries.ts

[Source](../../../../../src/scripts/fetchOverpassBoundaries.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `NeighborhoodFeature` | interface | [L61](../../../../../src/scripts/fetchOverpassBoundaries.ts#L61) |  |
| `buildOverpassQuery` | function | [L75](../../../../../src/scripts/fetchOverpassBoundaries.ts#L75) | cityOsmId |
| `fetchFromOverpass` | function | [L95](../../../../../src/scripts/fetchOverpassBoundaries.ts#L95) | query |
| `relationToGeoJSON` | function | [L116](../../../../../src/scripts/fetchOverpassBoundaries.ts#L116) | relation |
| `mergeWaysIntoRings` | function | [L162](../../../../../src/scripts/fetchOverpassBoundaries.ts#L162) | ways |
| `coordsEqual` | function | [L229](../../../../../src/scripts/fetchOverpassBoundaries.ts#L229) | a, b |
| `processOverpassResponse` | function | [L236](../../../../../src/scripts/fetchOverpassBoundaries.ts#L236) | data, cityName |
| `fetchCityNeighborhoods` | function | [L278](../../../../../src/scripts/fetchOverpassBoundaries.ts#L278) | city |
| `setupDynamoDBTable` | function | [L301](../../../../../src/scripts/fetchOverpassBoundaries.ts#L301) |  |
| `importToDynamoDB` | function | [L339](../../../../../src/scripts/fetchOverpassBoundaries.ts#L339) | docClient, features |
| `saveToGeoJSON` | function | [L374](../../../../../src/scripts/fetchOverpassBoundaries.ts#L374) | features, city |
| `main` | function | [L401](../../../../../src/scripts/fetchOverpassBoundaries.ts#L401) |  |

Imports: `fs`, `path`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@turf/turf`
