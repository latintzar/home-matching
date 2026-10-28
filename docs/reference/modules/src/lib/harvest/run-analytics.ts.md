# src/lib/harvest/run-analytics.ts

[Source](../../../../../../src/lib/harvest/run-analytics.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `MemorySnapshot` | interface | [L23](../../../../../../src/lib/harvest/run-analytics.ts#L23) |  |
| `logMemory` | function | [L36](../../../../../../src/lib/harvest/run-analytics.ts#L36) | label |
| `getPeakMemory` | function | [L57](../../../../../../src/lib/harvest/run-analytics.ts#L57) |  |
| `resetPeakMemory` | function | [L64](../../../../../../src/lib/harvest/run-analytics.ts#L64) |  |
| `RunStatus` | type | [L72](../../../../../../src/lib/harvest/run-analytics.ts#L72) |  |
| `RunSummary` | interface | [L81](../../../../../../src/lib/harvest/run-analytics.ts#L81) |  |
| `writeRunSummary` | function | [L126](../../../../../../src/lib/harvest/run-analytics.ts#L126) | summary |
| `createRunSummary` | function | [L180](../../../../../../src/lib/harvest/run-analytics.ts#L180) | domain, harvesterVersion, invocation, maxInvocations, phase, status, startTime, memoryLimitMb |
| `logSaveGame` | function | [L212](../../../../../../src/lib/harvest/run-analytics.ts#L212) | phase, invocation, maxInvocations, progress |

Imports: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`
