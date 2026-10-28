# src/app/api/listings/[id]/renovation-scope-finalize/route.ts

[Source](../../../../../../../../../src/app/api/listings/[id]/renovation-scope-finalize/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `requireRecipientConfiguration` | function | [L19](../../../../../../../../../src/app/api/listings/[id]/renovation-scope-finalize/route.ts#L19) |  |
| `roundToNearest1000` | function | [L30](../../../../../../../../../src/app/api/listings/[id]/renovation-scope-finalize/route.ts#L30) | value |
| `formatDurationDisplay` | function | [L37](../../../../../../../../../src/app/api/listings/[id]/renovation-scope-finalize/route.ts#L37) | durationWeeks |
| `POST` | function | [L45](../../../../../../../../../src/app/api/listings/[id]/renovation-scope-finalize/route.ts#L45) | request, destructured |

Imports: `next/server`, `@supabase/supabase-js`, `@/lib/orchestrator-progress`, `@/types/renovation-intelligence`, `@/lib/gemini-rest-client`, `@/lib/schemas/renovation-schemas`, `@/lib/lazy-supabase`
