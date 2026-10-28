# scripts/geo/import-census-sections.ts

[Source](../../../../../scripts/geo/import-census-sections.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `IncomeRecord` | interface | [L36](../../../../../scripts/geo/import-census-sections.ts#L36) |  |
| `CensusFeature` | interface | [L42](../../../../../scripts/geo/import-census-sections.ts#L42) |  |
| `calculateCentroid` | function | [L60](../../../../../scripts/geo/import-census-sections.ts#L60) | geometry |
| `calculateBbox` | function | [L83](../../../../../scripts/geo/import-census-sections.ts#L83) | geometry |
| `loadIncomeData` | function | [L108](../../../../../scripts/geo/import-census-sections.ts#L108) |  |
| `loadCensusFiles` | function | [L139](../../../../../scripts/geo/import-census-sections.ts#L139) |  |
| `writeBatch` | function | [L166](../../../../../scripts/geo/import-census-sections.ts#L166) | items |
| `importCensusSections` | function | [L186](../../../../../scripts/geo/import-census-sections.ts#L186) |  |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `fs`, `path`, `csv-parse/sync`, `ngeohash`
