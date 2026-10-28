# src/lib/checkpoints.ts

[Source](../../../../../src/lib/checkpoints.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `CheckpointData` | interface | [L3](../../../../../src/lib/checkpoints.ts#L3) |  |
| `PipelineCheckpoints` | interface | [L11](../../../../../src/lib/checkpoints.ts#L11) |  |
| `startCheckpoint` | function | [L30](../../../../../src/lib/checkpoints.ts#L30) | listingId, step |
| `saveCheckpoint` | function | [L72](../../../../../src/lib/checkpoints.ts#L72) | listingId, step, data, success, error |
| `loadCheckpoint` | function | [L118](../../../../../src/lib/checkpoints.ts#L118) | listingId, step |
| `loadAllCheckpoints` | function | [L137](../../../../../src/lib/checkpoints.ts#L137) | listingId |
| `clearCheckpoint` | function | [L152](../../../../../src/lib/checkpoints.ts#L152) | listingId, step |
| `getLastSuccessfulStep` | function | [L182](../../../../../src/lib/checkpoints.ts#L182) | listingId |

Imports: `@/utils/supabase/server`
