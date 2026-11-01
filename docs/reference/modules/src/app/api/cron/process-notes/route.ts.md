# src/app/api/cron/process-notes/route.ts

[Source](../../../../../../../../src/app/api/cron/process-notes/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `GET` | function | [L10](../../../../../../../../src/app/api/cron/process-notes/route.ts#L10) | request |
| `NoteToProcess` | interface | [L83](../../../../../../../../src/app/api/cron/process-notes/route.ts#L83) |  |
| `processUserNotes` | function | [L91](../../../../../../../../src/app/api/cron/process-notes/route.ts#L91) | userId, notes, supabase |
| `extractSignalsFromNote` | function | [L145](../../../../../../../../src/app/api/cron/process-notes/route.ts#L145) | content |

Imports: `@/lib/security/configured-api`, `next/server`, `@/lib/supabase-server`
