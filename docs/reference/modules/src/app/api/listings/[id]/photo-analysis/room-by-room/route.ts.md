# src/app/api/listings/[id]/photo-analysis/room-by-room/route.ts

[Source](../../../../../../../../../../src/app/api/listings/[id]/photo-analysis/room-by-room/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `limitConcurrency` | function | [L14](../../../../../../../../../../src/app/api/listings/[id]/photo-analysis/room-by-room/route.ts#L14) | items, maxConcurrency, handler |
| `processNext` | function | [L29](../../../../../../../../../../src/app/api/listings/[id]/photo-analysis/room-by-room/route.ts#L29) |  |
| `requireRecipientConfiguration` | function | [L60](../../../../../../../../../../src/app/api/listings/[id]/photo-analysis/room-by-room/route.ts#L60) |  |
| `POST` | function | [L84](../../../../../../../../../../src/app/api/listings/[id]/photo-analysis/room-by-room/route.ts#L84) | request, destructured |
| `processRoom` | function | [L241](../../../../../../../../../../src/app/api/listings/[id]/photo-analysis/room-by-room/route.ts#L241) | normalizedCluster, index |
| `GET` | function | [L772](../../../../../../../../../../src/app/api/listings/[id]/photo-analysis/room-by-room/route.ts#L772) | request, destructured |

Imports: `next/server`, `@supabase/supabase-js`, `@/lib/gemini-rest-client`, `@/lib/prompts/architecture-improvement-prompts`, `@/types/renovation-intelligence`, `@/lib/orchestrator-progress`, `@/lib/room-analysis-helpers`, `@/lib/pipeline-versions`, `@/lib/lazy-supabase`
