# src/app/api/listings/[id]/photo-analysis/room-by-room/route.ts

[Source](../../../../../../../../../../src/app/api/listings/[id]/photo-analysis/room-by-room/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `limitConcurrency` | function | [L13](../../../../../../../../../../src/app/api/listings/[id]/photo-analysis/room-by-room/route.ts#L13) | items, maxConcurrency, handler |
| `processNext` | function | [L28](../../../../../../../../../../src/app/api/listings/[id]/photo-analysis/room-by-room/route.ts#L28) |  |
| `POST` | function | [L81](../../../../../../../../../../src/app/api/listings/[id]/photo-analysis/room-by-room/route.ts#L81) | request, destructured |
| `processRoom` | function | [L238](../../../../../../../../../../src/app/api/listings/[id]/photo-analysis/room-by-room/route.ts#L238) | normalizedCluster, index |
| `GET` | function | [L769](../../../../../../../../../../src/app/api/listings/[id]/photo-analysis/room-by-room/route.ts#L769) | request, destructured |

Imports: `next/server`, `@supabase/supabase-js`, `@/lib/gemini-rest-client`, `@/lib/prompts/architecture-improvement-prompts`, `@/types/renovation-intelligence`, `@/lib/orchestrator-progress`, `@/lib/room-analysis-helpers`, `@/lib/pipeline-versions`
