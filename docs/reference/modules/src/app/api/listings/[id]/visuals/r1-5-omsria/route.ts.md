# src/app/api/listings/[id]/visuals/r1-5-omsria/route.ts

[Source](../../../../../../../../../../src/app/api/listings/[id]/visuals/r1-5-omsria/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `fetchImageAsBase64` | function | [L34](../../../../../../../../../../src/app/api/listings/[id]/visuals/r1-5-omsria/route.ts#L34) | url |
| `POST` | function | [L60](../../../../../../../../../../src/app/api/listings/[id]/visuals/r1-5-omsria/route.ts#L60) | request, destructured |
| `limitConcurrency` | function | [L197](../../../../../../../../../../src/app/api/listings/[id]/visuals/r1-5-omsria/route.ts#L197) | items, maxConcurrency, handler |
| `processNext` | function | [L225](../../../../../../../../../../src/app/api/listings/[id]/visuals/r1-5-omsria/route.ts#L225) |  |
| `processCluster` | function | [L270](../../../../../../../../../../src/app/api/listings/[id]/visuals/r1-5-omsria/route.ts#L270) | cluster, index |

Imports: `next/server`, `@supabase/supabase-js`, `@/lib/omsria/generate-prompt`, `@/lib/omsria/generate-plan`, `@/lib/omsria/execute-plan`, `@/lib/omsria/optimize-images`, `@/lib/photo-storage`, `@/lib/orchestrator-progress`
