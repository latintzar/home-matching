# src/app/api/ingest/server/route.ts

[Source](../../../../../../../../src/app/api/ingest/server/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `corsHeaders` | function | [L18](../../../../../../../../src/app/api/ingest/server/route.ts#L18) |  |
| `OPTIONS` | function | [L26](../../../../../../../../src/app/api/ingest/server/route.ts#L26) |  |
| `sanitizeFilename` | function | [L34](../../../../../../../../src/app/api/ingest/server/route.ts#L34) | filename |
| `createAfterPhotoSlots` | function | [L42](../../../../../../../../src/app/api/ingest/server/route.ts#L42) | listingId, photoCount |
| `POST` | function | [L75](../../../../../../../../src/app/api/ingest/server/route.ts#L75) | req |

Imports: `next/server`, `@/lib/supabase`, `@supabase/supabase-js`, `@/lib/scraper-normalizer`, `@/lib/extraction/adapters/server`, `@/lib/extraction/adapters/ai`, `@/lib/extraction/providers/scrapfly`, `@/lib/photo-storage`, `@/lib/utils/listing-identity`
