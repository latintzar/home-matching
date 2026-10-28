# src/scripts/aggregateCensusToNeighborhoods.ts

[Source](../../../../../src/scripts/aggregateCensusToNeighborhoods.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `CensusSection` | interface | [L22](../../../../../src/scripts/aggregateCensusToNeighborhoods.ts#L22) |  |
| `Neighborhood` | interface | [L30](../../../../../src/scripts/aggregateCensusToNeighborhoods.ts#L30) |  |
| `IncomeRecord` | interface | [L41](../../../../../src/scripts/aggregateCensusToNeighborhoods.ts#L41) |  |
| `loadIncomeData` | function | [L67](../../../../../src/scripts/aggregateCensusToNeighborhoods.ts#L67) |  |
| `loadCensusSections` | function | [L101](../../../../../src/scripts/aggregateCensusToNeighborhoods.ts#L101) | regionCode, incomeMap |
| `loadNeighborhoods` | function | [L132](../../../../../src/scripts/aggregateCensusToNeighborhoods.ts#L132) | city |
| `spatialJoin` | function | [L161](../../../../../src/scripts/aggregateCensusToNeighborhoods.ts#L161) | neighborhoods, censusSections, municipalityCode |
| `calculateAggregatedIncome` | function | [L204](../../../../../src/scripts/aggregateCensusToNeighborhoods.ts#L204) | neighborhoods, neighborhoodSections, allSections |
| `updateNeighborhoods` | function | [L264](../../../../../src/scripts/aggregateCensusToNeighborhoods.ts#L264) | neighborhoods |
| `main` | function | [L298](../../../../../src/scripts/aggregateCensusToNeighborhoods.ts#L298) |  |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@turf/turf`, `fs`, `path`, `csv-parse/sync`
