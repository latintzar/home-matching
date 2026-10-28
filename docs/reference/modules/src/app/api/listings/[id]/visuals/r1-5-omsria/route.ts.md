# src/app/api/listings/[id]/visuals/r1-5-omsria/route.ts

[Source](../../../../../../../../../../src/app/api/listings/[id]/visuals/r1-5-omsria/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `fetchImageAsBase64` | function | [L35](../../../../../../../../../../src/app/api/listings/[id]/visuals/r1-5-omsria/route.ts#L35) | url |
| `POST` | function | [L61](../../../../../../../../../../src/app/api/listings/[id]/visuals/r1-5-omsria/route.ts#L61) | request, destructured |
| `limitConcurrency` | function | [L198](../../../../../../../../../../src/app/api/listings/[id]/visuals/r1-5-omsria/route.ts#L198) | items, maxConcurrency, handler |
| `processNext` | function | [L226](../../../../../../../../../../src/app/api/listings/[id]/visuals/r1-5-omsria/route.ts#L226) |  |
| `processCluster` | function | [L271](../../../../../../../../../../src/app/api/listings/[id]/visuals/r1-5-omsria/route.ts#L271) | cluster, index |

Imports: `next/server`, `@supabase/supabase-js`, `@/lib/omsria/generate-prompt`, `@/lib/omsria/generate-plan`, `@/lib/omsria/execute-plan`, `@/lib/omsria/optimize-images`, `@/lib/photo-storage`, `@/lib/orchestrator-progress`, `@/lib/lazy-supabase`
