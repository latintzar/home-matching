# src/app/api/listings/[id]/orchestrate-renovation/route.ts

[Source](../../../../../../../../../src/app/api/listings/[id]/orchestrate-renovation/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `fetchWithNoTimeout` | function | [L28](../../../../../../../../../src/app/api/listings/[id]/orchestrate-renovation/route.ts#L28) | url, options |
| `POST` | function | [L56](../../../../../../../../../src/app/api/listings/[id]/orchestrate-renovation/route.ts#L56) | request, destructured |
| `start` | method | [L68](../../../../../../../../../src/app/api/listings/[id]/orchestrate-renovation/route.ts#L68) | controller |
| `sendUpdate` | function | [L69](../../../../../../../../../src/app/api/listings/[id]/orchestrate-renovation/route.ts#L69) | message, data, step |
| `runPipeline` | function | [L84](../../../../../../../../../src/app/api/listings/[id]/orchestrate-renovation/route.ts#L84) |  |
| `progressCallback` | function | [L87](../../../../../../../../../src/app/api/listings/[id]/orchestrate-renovation/route.ts#L87) | event |
| `shouldSkip` | function | [L110](../../../../../../../../../src/app/api/listings/[id]/orchestrate-renovation/route.ts#L110) | stepName |
| `callEndpoint` | function | [L118](../../../../../../../../../src/app/api/listings/[id]/orchestrate-renovation/route.ts#L118) | step, url, options, useLongTimeout |

Imports: `next/server`, `@supabase/supabase-js`, `undici`, `@/lib/orchestrator-progress`, `@/lib/lazy-supabase`
