# src/scripts/generateHeatmapDemo.ts

[Source](../../../../../src/scripts/generateHeatmapDemo.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `calculateCommuteScore` | function | [L109](../../../../../src/scripts/generateHeatmapDemo.ts#L109) | lng, lat |
| `calculateLifestyleScore` | function | [L133](../../../../../src/scripts/generateHeatmapDemo.ts#L133) | lng, lat |
| `calculateCombinedScore` | function | [L158](../../../../../src/scripts/generateHeatmapDemo.ts#L158) | lng, lat |
| `generateScoreGrid` | function | [L175](../../../../../src/scripts/generateHeatmapDemo.ts#L175) |  |
| `generateIsobands` | function | [L208](../../../../../src/scripts/generateHeatmapDemo.ts#L208) | grid |
| `generateSmoothZones` | function | [L268](../../../../../src/scripts/generateHeatmapDemo.ts#L268) | grid |
| `createZone` | function | [L296](../../../../../src/scripts/generateHeatmapDemo.ts#L296) | points |
| `clipToBoundary` | function | [L317](../../../../../src/scripts/generateHeatmapDemo.ts#L317) | zone |
| `main` | function | [L346](../../../../../src/scripts/generateHeatmapDemo.ts#L346) |  |
| `generateSvgPaths` | function | [L432](../../../../../src/scripts/generateHeatmapDemo.ts#L432) | zones, outputDir |
| `projectToSvg` | function | [L441](../../../../../src/scripts/generateHeatmapDemo.ts#L441) | lng, lat |
| `polygonToPath` | function | [L447](../../../../../src/scripts/generateHeatmapDemo.ts#L447) | feature |

Imports: `@turf/turf`, `fs`, `path`
