# src/lib/debug-pipeline.ts

[Source](../../../../../src/lib/debug-pipeline.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `PipelineStep` | interface | [L8](../../../../../src/lib/debug-pipeline.ts#L8) |  |
| `PipelineCache` | interface | [L18](../../../../../src/lib/debug-pipeline.ts#L18) |  |
| `PipelineDebugger` | class | [L26](../../../../../src/lib/debug-pipeline.ts#L26) |  |
| `constructor` | constructor | [L30](../../../../../src/lib/debug-pipeline.ts#L30) | debugMode |
| `startRun` | method | [L37](../../../../../src/lib/debug-pipeline.ts#L37) | listingId |
| `startStep` | method | [L52](../../../../../src/lib/debug-pipeline.ts#L52) | listingId, stepName, input |
| `completeStep` | method | [L72](../../../../../src/lib/debug-pipeline.ts#L72) | listingId, stepName, output |
| `failStep` | method | [L90](../../../../../src/lib/debug-pipeline.ts#L90) | listingId, stepName, error |
| `getCachedResult` | method | [L108](../../../../../src/lib/debug-pipeline.ts#L108) | listingId, stepName |
| `isStepCached` | method | [L121](../../../../../src/lib/debug-pipeline.ts#L121) | listingId, stepName |
| `getLastSuccessfulStep` | method | [L132](../../../../../src/lib/debug-pipeline.ts#L132) | listingId |
| `getDebugSummary` | method | [L142](../../../../../src/lib/debug-pipeline.ts#L142) | listingId |
| `exportCache` | method | [L167](../../../../../src/lib/debug-pipeline.ts#L167) | listingId |
| `clearCache` | method | [L195](../../../../../src/lib/debug-pipeline.ts#L195) | listingId |
| `clearAllCaches` | method | [L202](../../../../../src/lib/debug-pipeline.ts#L202) |  |

Imports: 
