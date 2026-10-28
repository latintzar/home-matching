# src/scripts/generateHeatmapV2.ts

[Source](../../../../../src/scripts/generateHeatmapV2.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `Neighborhood` | interface | [L112](../../../../../src/scripts/generateHeatmapV2.ts#L112) |  |
| `fetchNeighborhoods` | function | [L122](../../../../../src/scripts/generateHeatmapV2.ts#L122) |  |
| `calculateCommuteScore` | function | [L164](../../../../../src/scripts/generateHeatmapV2.ts#L164) | lat, lng |
| `getNeighborhoodScore` | function | [L191](../../../../../src/scripts/generateHeatmapV2.ts#L191) | lat, lng, neighborhoods |
| `calculateFitScore` | function | [L218](../../../../../src/scripts/generateHeatmapV2.ts#L218) | lat, lng, neighborhoods |
| `HexResult` | interface | [L240](../../../../../src/scripts/generateHeatmapV2.ts#L240) |  |
| `processHexBatch` | function | [L249](../../../../../src/scripts/generateHeatmapV2.ts#L249) | hexes, neighborhoods |
| `generateExpandedHexes` | function | [L276](../../../../../src/scripts/generateHeatmapV2.ts#L276) |  |
| `hexToGeoJSON` | function | [L297](../../../../../src/scripts/generateHeatmapV2.ts#L297) | result |
| `main` | function | [L323](../../../../../src/scripts/generateHeatmapV2.ts#L323) |  |

Imports: `h3-js`, `@turf/turf`, `fs`, `path`, `@aws-sdk/client-dynamodb`, `@aws-sdk/util-dynamodb`, `worker_threads`, `os`
