# src/app/api/listings/[id]/orchestrate-renovation/route.ts

[Source](../../../../../../../../../src/app/api/listings/[id]/orchestrate-renovation/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `fetchWithNoTimeout` | function | [L27](../../../../../../../../../src/app/api/listings/[id]/orchestrate-renovation/route.ts#L27) | url, options |
| `POST` | function | [L55](../../../../../../../../../src/app/api/listings/[id]/orchestrate-renovation/route.ts#L55) | request, destructured |
| `start` | method | [L67](../../../../../../../../../src/app/api/listings/[id]/orchestrate-renovation/route.ts#L67) | controller |
| `sendUpdate` | function | [L68](../../../../../../../../../src/app/api/listings/[id]/orchestrate-renovation/route.ts#L68) | message, data, step |
| `runPipeline` | function | [L83](../../../../../../../../../src/app/api/listings/[id]/orchestrate-renovation/route.ts#L83) |  |
| `progressCallback` | function | [L86](../../../../../../../../../src/app/api/listings/[id]/orchestrate-renovation/route.ts#L86) | event |
| `shouldSkip` | function | [L109](../../../../../../../../../src/app/api/listings/[id]/orchestrate-renovation/route.ts#L109) | stepName |
| `callEndpoint` | function | [L117](../../../../../../../../../src/app/api/listings/[id]/orchestrate-renovation/route.ts#L117) | step, url, options, useLongTimeout |

Imports: `next/server`, `@supabase/supabase-js`, `undici`, `@/lib/orchestrator-progress`
