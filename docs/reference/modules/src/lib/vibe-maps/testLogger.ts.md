# src/lib/vibe-maps/testLogger.ts

[Source](../../../../../../src/lib/vibe-maps/testLogger.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `APICall` | interface | [L6](../../../../../../src/lib/vibe-maps/testLogger.ts#L6) |  |
| `VerdictType` | type | [L29](../../../../../../src/lib/vibe-maps/testLogger.ts#L29) |  |
| `FollowUp` | interface | [L31](../../../../../../src/lib/vibe-maps/testLogger.ts#L31) |  |
| `TestLog` | interface | [L38](../../../../../../src/lib/vibe-maps/testLogger.ts#L38) |  |
| `TestLogger` | class | [L54](../../../../../../src/lib/vibe-maps/testLogger.ts#L54) |  |
| `startTest` | method | [L59](../../../../../../src/lib/vibe-maps/testLogger.ts#L59) | testId, testName, input |
| `logStep` | method | [L80](../../../../../../src/lib/vibe-maps/testLogger.ts#L80) | description, data |
| `startAPICall` | method | [L86](../../../../../../src/lib/vibe-maps/testLogger.ts#L86) | api, endpoint, request |
| `completeAPICall` | method | [L97](../../../../../../src/lib/vibe-maps/testLogger.ts#L97) | callId, response, success, error |
| `endTest` | method | [L107](../../../../../../src/lib/vibe-maps/testLogger.ts#L107) | success, output, error |
| `getCurrentLog` | method | [L120](../../../../../../src/lib/vibe-maps/testLogger.ts#L120) |  |
| `loadIndex` | method | [L122](../../../../../../src/lib/vibe-maps/testLogger.ts#L122) |  |
| `saveLog` | method | [L130](../../../../../../src/lib/vibe-maps/testLogger.ts#L130) | log |
| `updateIndex` | method | [L143](../../../../../../src/lib/vibe-maps/testLogger.ts#L143) | log |
| `formatLogForDisplay` | function | [L160](../../../../../../src/lib/vibe-maps/testLogger.ts#L160) | log |
| `getFullLogJSON` | function | [L203](../../../../../../src/lib/vibe-maps/testLogger.ts#L203) | log |

Imports: 
