# src/app/api/ingest/server/route.ts

[Source](../../../../../../../../src/app/api/ingest/server/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `corsHeaders` | function | [L19](../../../../../../../../src/app/api/ingest/server/route.ts#L19) |  |
| `OPTIONS` | function | [L27](../../../../../../../../src/app/api/ingest/server/route.ts#L27) |  |
| `sanitizeFilename` | function | [L35](../../../../../../../../src/app/api/ingest/server/route.ts#L35) | filename |
| `createAfterPhotoSlots` | function | [L43](../../../../../../../../src/app/api/ingest/server/route.ts#L43) | listingId, photoCount |
| `POST` | function | [L76](../../../../../../../../src/app/api/ingest/server/route.ts#L76) | req |

Imports: `next/server`, `@/lib/supabase`, `@supabase/supabase-js`, `@/lib/scraper-normalizer`, `@/lib/extraction/adapters/server`, `@/lib/extraction/adapters/ai`, `@/lib/extraction/providers/scrapfly`, `@/lib/photo-storage`, `@/lib/utils/listing-identity`, `@/lib/lazy-supabase`
