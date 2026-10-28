# src/lib/photo-storage.ts

[Source](../../../../../src/lib/photo-storage.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `PhotoStorageResult` | interface | [L19](../../../../../src/lib/photo-storage.ts#L19) |  |
| `storePhotoInSupabase` | function | [L30](../../../../../src/lib/photo-storage.ts#L30) | originalUrl, listingId, filename |
| `storeFileInSupabase` | function | [L101](../../../../../src/lib/photo-storage.ts#L101) | fileBuffer, contentType, listingId, filename |
| `storeListingPhotos` | function | [L154](../../../../../src/lib/photo-storage.ts#L154) | photos, listingId |
| `convertSupabaseUrlToBase64` | function | [L180](../../../../../src/lib/photo-storage.ts#L180) | supabaseUrl |
| `generatePhotoFilename` | function | [L199](../../../../../src/lib/photo-storage.ts#L199) | originalUrl, contentType |
| `getSupabasePhotoUrl` | function | [L219](../../../../../src/lib/photo-storage.ts#L219) | listingId, filename |
| `deleteListingPhotos` | function | [L230](../../../../../src/lib/photo-storage.ts#L230) | listingId |
| `fetchAfterPhotos` | function | [L267](../../../../../src/lib/photo-storage.ts#L267) | listingId, tier |
| `hasAfterPhotos` | function | [L295](../../../../../src/lib/photo-storage.ts#L295) | listingId, tier |
| `isClusterExcluded` | function | [L329](../../../../../src/lib/photo-storage.ts#L329) | clusterName, listingId, supabaseClient |
| `getExcludedPhotoUrls` | function | [L390](../../../../../src/lib/photo-storage.ts#L390) | listingId, supabaseClient |
| `fetchValidListingPhotos` | function | [L484](../../../../../src/lib/photo-storage.ts#L484) | listingId, supabaseClient |

Imports: `@supabase/supabase-js`
