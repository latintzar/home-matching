# src/lib/photo-storage.ts

[Source](../../../../../src/lib/photo-storage.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `requireRecipientConfiguration` | function | [L14](../../../../../src/lib/photo-storage.ts#L14) |  |
| `PhotoStorageResult` | interface | [L22](../../../../../src/lib/photo-storage.ts#L22) |  |
| `storePhotoInSupabase` | function | [L33](../../../../../src/lib/photo-storage.ts#L33) | originalUrl, listingId, filename |
| `storeFileInSupabase` | function | [L104](../../../../../src/lib/photo-storage.ts#L104) | fileBuffer, contentType, listingId, filename |
| `storeListingPhotos` | function | [L157](../../../../../src/lib/photo-storage.ts#L157) | photos, listingId |
| `convertSupabaseUrlToBase64` | function | [L183](../../../../../src/lib/photo-storage.ts#L183) | supabaseUrl |
| `generatePhotoFilename` | function | [L202](../../../../../src/lib/photo-storage.ts#L202) | originalUrl, contentType |
| `getSupabasePhotoUrl` | function | [L222](../../../../../src/lib/photo-storage.ts#L222) | listingId, filename |
| `deleteListingPhotos` | function | [L233](../../../../../src/lib/photo-storage.ts#L233) | listingId |
| `fetchAfterPhotos` | function | [L270](../../../../../src/lib/photo-storage.ts#L270) | listingId, tier |
| `hasAfterPhotos` | function | [L298](../../../../../src/lib/photo-storage.ts#L298) | listingId, tier |
| `isClusterExcluded` | function | [L332](../../../../../src/lib/photo-storage.ts#L332) | clusterName, listingId, supabaseClient |
| `getExcludedPhotoUrls` | function | [L393](../../../../../src/lib/photo-storage.ts#L393) | listingId, supabaseClient |
| `fetchValidListingPhotos` | function | [L487](../../../../../src/lib/photo-storage.ts#L487) | listingId, supabaseClient |

Imports: `@supabase/supabase-js`, `@/lib/lazy-supabase`
