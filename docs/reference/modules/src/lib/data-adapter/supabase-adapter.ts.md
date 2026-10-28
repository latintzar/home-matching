# src/lib/data-adapter/supabase-adapter.ts

[Source](../../../../../../src/lib/data-adapter/supabase-adapter.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `getSupabase` | function | [L13](../../../../../../src/lib/data-adapter/supabase-adapter.ts#L13) |  |
| `existsInSupabase` | function | [L20](../../../../../../src/lib/data-adapter/supabase-adapter.ts#L20) | listingId |
| `getListingFromSupabase` | function | [L34](../../../../../../src/lib/data-adapter/supabase-adapter.ts#L34) | listingId, options |
| `getAnalysisFromSupabase` | function | [L92](../../../../../../src/lib/data-adapter/supabase-adapter.ts#L92) | listingId, analysisType |
| `saveAnalysisToSupabase` | function | [L122](../../../../../../src/lib/data-adapter/supabase-adapter.ts#L122) | listingId, analysisType, results |
| `getClustersFromSupabase` | function | [L146](../../../../../../src/lib/data-adapter/supabase-adapter.ts#L146) | listingId |
| `saveClustersToSupabase` | function | [L172](../../../../../../src/lib/data-adapter/supabase-adapter.ts#L172) | listingId, clusters |
| `getWPAFromSupabase` | function | [L195](../../../../../../src/lib/data-adapter/supabase-adapter.ts#L195) | listingId |
| `saveWPAToSupabase` | function | [L224](../../../../../../src/lib/data-adapter/supabase-adapter.ts#L224) | listingId, analysis, modelUsed |
| `getRawSupabaseClient` | function | [L249](../../../../../../src/lib/data-adapter/supabase-adapter.ts#L249) |  |

Imports: `@supabase/supabase-js`, `@/lib/supabase`, `./types`
