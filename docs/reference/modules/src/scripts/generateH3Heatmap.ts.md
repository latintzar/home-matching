# src/scripts/generateH3Heatmap.ts

[Source](../../../../../src/scripts/generateH3Heatmap.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `CensusSection` | interface | [L64](../../../../../src/scripts/generateH3Heatmap.ts#L64) |  |
| `fetchBarcelonaCensusSections` | function | [L70](../../../../../src/scripts/generateH3Heatmap.ts#L70) |  |
| `createCensusBoundary` | function | [L107](../../../../../src/scripts/generateH3Heatmap.ts#L107) | sections |
| `generateBarcelonaHexes` | function | [L158](../../../../../src/scripts/generateH3Heatmap.ts#L158) | boundary |
| `calculateCommuteScore` | function | [L193](../../../../../src/scripts/generateH3Heatmap.ts#L193) | lat, lng |
| `calculateLifestyleScore` | function | [L221](../../../../../src/scripts/generateH3Heatmap.ts#L221) | lat, lng |
| `calculateFitScore` | function | [L243](../../../../../src/scripts/generateH3Heatmap.ts#L243) | lat, lng |
| `hexToGeoJSON` | function | [L267](../../../../../src/scripts/generateH3Heatmap.ts#L267) | hex, properties |
| `generateHeatmap` | function | [L283](../../../../../src/scripts/generateH3Heatmap.ts#L283) |  |

Imports: `h3-js`, `@turf/turf`, `fs`, `path`, `@aws-sdk/client-dynamodb`, `@aws-sdk/util-dynamodb`
