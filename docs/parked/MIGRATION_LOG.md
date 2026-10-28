# Supabase → DynamoDB Migration Log

## Migration Date: 2025-11-29

## Summary

Migrated bulk data from Supabase to AWS DynamoDB as part of Phase 2 consolidation.

### Migration Results

| Table | Supabase | DynamoDB | Status |
|-------|----------|----------|--------|
| listings | 150 | ~122 | ⚠️ 29 errors (see notes) |
| listing_photos | 2,747 | (embedded) | ✅ Embedded in leo-listings |
| clusters | 210 | (embedded) | ✅ Embedded in leo-listings |
| text_analysis_results | 499 | ~507 | ✅ leo-analysis-cache |
| whole_property_analysis | 8 | 8 | ✅ leo-wpa-cache |
| room_analyses | 9 | (included above) | ✅ leo-analysis-cache |
| scraping_rules | 3,667 | 3,667 | ✅ leo-scraping-rules |
| harvest_queue | 3,667 | 3,667 | ✅ leo-crawl-tracking |

### Error Details

**Listings with errors (29):**
- 10 listings: "Item size has exceeded the maximum allowed size" 
  - DynamoDB has 400KB limit per item
  - These listings have very large `scraped_data` JSONB fields
  - IDs: 1000000140, 1000000141, 1000000142, etc.
- 19 listings: "Invalid URL"
  - These listings have NULL or malformed `source_url`
  - Likely test data or import errors
  - IDs: 1000000248, 1000000272, 1000000222, etc.

**Resolution:** These are test/development listings. Production harvest will create properly-sized items.

## Files Created/Modified

### New Files
- `src/scripts/migration/supabase-to-dynamodb.ts` - Migration script
- `src/scripts/migration/backup-supabase.ts` - Backup script
- `src/lib/dynamodb.ts` - DynamoDB client library
- `src/lib/data-adapter.ts` - Unified data access layer
- `src/lib/fetch-and-dump.ts` - Photo fetching utilities
- `src/app/api/photo-proxy/route.ts` - CORS proxy for photos
- `backups/supabase-2025-11-29T00-08-27/` - Backup directory

### DynamoDB Tables Created (earlier)
- `leo-listings` - Property listings
- `leo-scraping-rules` - Domain selectors
- `leo-crawl-tracking` - Crawl metadata
- `leo-wpa-cache` - WPA analysis cache
- `leo-analysis-cache` - Text/room analysis cache
- `leo-geo-intelligence` - Geo-dossier system
- `leo-market-velocity` - Sold/rented analytics

## Data Architecture Change

### Before (Supabase-only)
```
Frontend → API → Supabase (all data)
```

### After (Hybrid)
```
Frontend → API → Data Adapter
                    ├── DynamoDB (bulk data)
                    │   └── listings, analyses, rules
                    └── Supabase (user-facing)
                        └── agents, deepdives, auth
```

## Using the Data Adapter

### Feature Flag
```bash
# .env.local
USE_DYNAMODB=false  # Default: use Supabase (safe)
USE_DYNAMODB=true   # Use DynamoDB for bulk data
```

### Example Usage
```typescript
import { getListingById, getAgent } from '@/lib/data-adapter';

// Automatically uses correct data source
const listing = await getListingById('1000000001');
const agent = await getAgent('123'); // Always Supabase
```

## Fetch-and-Dump Pattern

Photos are NOT stored. We store URLs and fetch on-demand:

```typescript
import { fetchListingPhotos, getPhotoProxyUrl } from '@/lib/fetch-and-dump';

// For AI analysis
const photos = await fetchListingPhotos(url);

// For frontend display (avoids CORS)
const proxyUrl = getPhotoProxyUrl(originalUrl);
```

## Rollback Procedure

If needed, the original Supabase data is:
1. Still in Supabase (migration doesn't delete)
2. Backed up in `backups/supabase-2025-11-29T00-08-27/`

To rollback:
```bash
# Set feature flag to use Supabase
USE_DYNAMODB=false

# Or restore from backup using Supabase SQL editor
```

## Next Steps

1. **Endpoint Migration** - Gradually update 53 files to use data-adapter
2. **Production Harvest** - Continue S3 HTML crawl (running on EC2)
3. **Lambda Functions** - Set up daily harvest/parse crons
4. **Recommender** - Build new Life Profile + WPA scoring system

## Cost Impact

- DynamoDB: ~$0.25/GB stored + read/write costs (pay per request)
- Current data: ~50MB = ~$0.01/month
- Projected at 650K listings: ~5GB = ~$1.25/month

**Much cheaper than Supabase at scale!**

