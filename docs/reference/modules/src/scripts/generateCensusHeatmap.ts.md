# src/scripts/generateCensusHeatmap.ts

[Source](../../../../../src/scripts/generateCensusHeatmap.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `CensusSection` | interface | [L63](../../../../../src/scripts/generateCensusHeatmap.ts#L63) |  |
| `fetchBarcelonaCensusSections` | function | [L77](../../../../../src/scripts/generateCensusHeatmap.ts#L77) |  |
| `calculateCommuteScore` | function | [L116](../../../../../src/scripts/generateCensusHeatmap.ts#L116) | centroid |
| `calculateLifestyleScore` | function | [L147](../../../../../src/scripts/generateCensusHeatmap.ts#L147) | centroid |
| `calculateIncomeScore` | function | [L171](../../../../../src/scripts/generateCensusHeatmap.ts#L171) | income |
| `calculateFitScore` | function | [L187](../../../../../src/scripts/generateCensusHeatmap.ts#L187) | section |
| `generateHeatmap` | function | [L219](../../../../../src/scripts/generateCensusHeatmap.ts#L219) |  |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@turf/turf`, `fs`, `path`
