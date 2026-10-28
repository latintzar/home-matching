# src/lib/phase-cache.ts

[Source](../../../../../src/lib/phase-cache.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `PhaseCache` | interface | [L11](../../../../../src/lib/phase-cache.ts#L11) |  |
| `PhaseCacheManager` | class | [L25](../../../../../src/lib/phase-cache.ts#L25) |  |
| `constructor` | constructor | [L28](../../../../../src/lib/phase-cache.ts#L28) | cacheDir |
| `savePhase` | method | [L38](../../../../../src/lib/phase-cache.ts#L38) | listingId, phase, data, metadata |
| `loadPhase` | method | [L67](../../../../../src/lib/phase-cache.ts#L67) | listingId, phase |
| `isCached` | method | [L89](../../../../../src/lib/phase-cache.ts#L89) | listingId, phase |
| `listCachedPhases` | method | [L98](../../../../../src/lib/phase-cache.ts#L98) | listingId |
| `clearCache` | method | [L117](../../../../../src/lib/phase-cache.ts#L117) | listingId |
| `getCacheStats` | method | [L135](../../../../../src/lib/phase-cache.ts#L135) |  |
| `exportPhaseForTesting` | method | [L166](../../../../../src/lib/phase-cache.ts#L166) | listingId, phase, data, validationResults |
| `loadTestPhase` | method | [L199](../../../../../src/lib/phase-cache.ts#L199) | listingId, phase |

Imports: `fs`, `path`
