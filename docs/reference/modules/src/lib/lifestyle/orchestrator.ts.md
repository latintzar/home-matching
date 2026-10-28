# src/lib/lifestyle/orchestrator.ts

[Source](../../../../../../src/lib/lifestyle/orchestrator.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `TransportMode` | type | [L21](../../../../../../src/lib/lifestyle/orchestrator.ts#L21) |  |
| `GeoPoint` | interface | [L23](../../../../../../src/lib/lifestyle/orchestrator.ts#L23) |  |
| `SearchFilter` | interface | [L30](../../../../../../src/lib/lifestyle/orchestrator.ts#L30) |  |
| `SmartAnchor` | interface | [L37](../../../../../../src/lib/lifestyle/orchestrator.ts#L37) |  |
| `SmartDependency` | interface | [L69](../../../../../../src/lib/lifestyle/orchestrator.ts#L69) |  |
| `OrchestratorResult` | interface | [L79](../../../../../../src/lib/lifestyle/orchestrator.ts#L79) |  |
| `Place` | interface | [L96](../../../../../../src/lib/lifestyle/orchestrator.ts#L96) |  |
| `searchPlaces` | function | [L102](../../../../../../src/lib/lifestyle/orchestrator.ts#L102) | query, center, radiusKm |
| `getMockPlaces` | function | [L144](../../../../../../src/lib/lifestyle/orchestrator.ts#L144) | query, center |
| `getIsochrone` | function | [L161](../../../../../../src/lib/lifestyle/orchestrator.ts#L161) | lat, lng, mode, minutes |
| `LifestyleOrchestrator` | class | [L182](../../../../../../src/lib/lifestyle/orchestrator.ts#L182) |  |
| `search` | method | [L187](../../../../../../src/lib/lifestyle/orchestrator.ts#L187) | query, center, radiusKm |
| `resolveProfile` | method | [L192](../../../../../../src/lib/lifestyle/orchestrator.ts#L192) | anchors |

Imports: `@turf/turf`, `fs`, `path`, `dotenv`, `./ai-scout`, `./cost-calculator`
