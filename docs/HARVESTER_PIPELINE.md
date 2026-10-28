# Harvester Pipeline Documentation

## Overview

The harvester pipeline collects real estate listings from 7 Spanish property portals and makes them available via the `/test-catalogue` page.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DAILY HARVESTER PIPELINE                          │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
  │  Tecnocasa   │   │  Century21   │   │ Engel&Völk.  │   │   Donpiso    │
  │  7,366 🏠    │   │  17,068 🏠   │   │    68 🏠     │   │   351 🏠     │
  │  3:00 UTC    │   │  3:30 UTC    │   │  4:00 UTC    │   │  4:15 UTC    │
  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
         │                  │                  │                  │
         └──────────────────┴──────────────────┴──────────────────┘
                                     │
  ┌──────────────┐   ┌──────────────┐│  ┌──────────────┐
  │  Lucas Fox   │   │    RE/MAX    ││  │  aProperties │
  │    77 🏠     │   │  12,448 🏠   ││  │  ~1,200 🏠   │
  │  4:30 UTC    │   │  5:00 UTC    ││  │  5:30 UTC    │
  └──────┬───────┘   └──────┬───────┘│  └──────┬───────┘
         │                  │        │         │
         └──────────────────┴────────┴─────────┘
                            │
                            ▼
                   ┌────────────────┐
                   │   DynamoDB     │
                   │ (leo-listings) │
                   │  ~25,000+ 🏠   │
                   └────────┬───────┘
                            │
                            ▼  7:00 UTC
                   ┌────────────────┐
                   │ Export Lambda  │
                   │ (catalogue)    │
                   └────────┬───────┘
                            │
                            ▼
                   ┌────────────────┐
                   │      S3        │
                   │ listings.json  │
                   └────────┬───────┘
                            │
                            ▼
                   ┌────────────────┐
                   │ /test-catalogue│
                   │     Page       │
                   └────────────────┘
```

## Architecture

### Data Flow

1. **Harvesters** (7 Lambda functions) run daily at staggered times
2. Each harvester writes listings to **DynamoDB** (`leo-listings` table)
3. **Export Lambda** runs after all harvesters complete (~7:00 UTC)
4. Export creates compressed JSON in **S3** (`catalogue/listings.json.gz`)
5. **Test Catalogue page** reads from S3 with in-memory caching

### Why This Architecture?

- **DynamoDB**: Fast writes during harvesting, supports delta updates
- **S3 Export**: Single compressed file for fast page loads (~6MB gzipped)
- **In-Memory Cache**: First request loads from S3, subsequent requests instant (4hr TTL)

## Harvesters

### Domain Summary

| Domain | Lambda Name | Schedule (UTC) | Spain Time | Listings | Notes |
|--------|-------------|----------------|------------|----------|-------|
| tecnocasa.es | tc-harvest-delta | 3:00 AM | 4:00 AM | ~7,400 | High volume |
| century21.es | c21-harvest-delta | 3:30 AM | 4:30 AM | ~17,000 | Largest |
| engelvoelkers.com | ev-harvest-delta | 4:00 AM | 5:00 AM | ~70 | Premium |
| donpiso.com | dp-harvest-delta | 4:15 AM | 5:15 AM | ~350 | Medium |
| lucasfox.com | lf-harvest-delta | 4:30 AM | 5:30 AM | ~80 | Premium |
| remax.es | remax-harvest-delta | 5:00 AM | 6:00 AM | ~12,000 | Large, uses self-continuation |
| aproperties.es | aproperties-harvest-delta | 5:30 AM | 6:30 AM | ~1,200 | ScrapFly (Cloudflare) |

### Harvester Features

All harvesters implement:

1. **S3 State File** - Resume from interruption
2. **Delta Logic** - Only process new/changed listings
3. **Sold/Removed Detection** - Mark listings no longer available
4. **Self-Continuation** - Re-invoke on timeout (max 10 invocations)
5. **Status Tracking** - active/sold/rented/removed status
6. **First/Last Seen** - Track listing appearance dates
7. **Price History** - Track price changes over time
8. **Photo Classification** - Separate floorplans, exterior, regular photos
9. **Coordinate Precision** - Verify location accuracy via Nominatim
10. **Agent Phone** - Extract contact information where available
11. **Furnished Status** - Detect if property is furnished
12. **Versioning** - `harvester_version` and `harvestedAt` fields
13. **SAVE GAME Logging** - Detailed progress on timeout (Dec 11)
14. **Run Analytics** - Write stats to `leo-harvest-stats` table (Dec 11)
15. **Type/Precision Tracking** - Track sale/rent and coordinate precision (Dec 11)
16. **State Preservation** - Save listings across phase transitions (Dec 11)

> **Full Technical Details:** See `docs/HARVESTER_TECHNICAL_REFERENCE.md`

### Special Cases

#### aProperties (ScrapFly Integration)
- Uses **ScrapFly** to bypass Cloudflare protection
- **Age filtering**: Only scrapes recent listings to reduce costs
  - Rentals: ≤14 days old
  - Sales: ≤60 days old
- Cost: ~$0.10/day for delta updates

#### RE/MAX (Large Volume)
- ~12,000 listings requires multiple Lambda invocations
- Uses self-continuation with memory management
- May take 30-60 minutes to complete

## Export Process

### Manual Export

```bash
# Trigger export manually
curl -X POST http://localhost:3000/api/catalogue/export

# Or via Lambda
aws lambda invoke --function-name catalogue-export /tmp/response.json
```

### Automatic Export

The export Lambda runs daily at **7:00 AM UTC** (8:00 AM Spain) via EventBridge, after all harvesters should be complete.

### Export Output

```json
{
  "success": true,
  "total": 25016,
  "domains": {
    "century21.es": 17068,
    "tecnocasa.es": 7366,
    "donpiso.com": 351,
    "aproperties.es": 86,
    "lucasfox.com": 77,
    "engelvoelkers.com": 68,
    "remax.es": 0
  },
  "sizeKB": 6222,
  "elapsed": 93801
}
```

## DynamoDB Schema

### Table: `leo-listings`

**Primary Key**: `domain` (partition) + `listing_id` (sort)

| Field | Type | Description |
|-------|------|-------------|
| domain | String | e.g., "tecnocasa.es" |
| listing_id | String | Unique ID from source |
| url | String | Original listing URL |
| title | String | Listing title |
| price | Number | Price in EUR |
| location.lat/lng | Number | Coordinates |
| location.coordinate_precision | String | precise/approximate/city_center/unknown |
| location.street_address | String | Street address if known |
| location.neighborhood | String | Neighborhood |
| location.city | String | City |
| property.type | String | apartment/house/villa/etc |
| property.bedrooms | Number | Bedroom count |
| property.bathrooms | Number | Bathroom count |
| property.area_m2 | Number | Size in m² |
| photos | List | Regular photo URLs |
| photos_floorplan | List | Floorplan photo URLs |
| contract_type | String | sale/rent |
| status | String | active/sold/rented/removed |
| is_furnished | Boolean | Furnished status |
| first_seen | String | ISO date first scraped |
| last_seen | String | ISO date last seen |
| price_history | List | Historical prices |
| harvester_version | String | e.g., "2.1.1" |
| harvestedAt | String | ISO timestamp |

## S3 Storage

### Bucket: `puedo-casa-html-archive`

```
puedo-casa-html-archive/
├── catalogue/
│   └── listings.json.gz      # Export for test-catalogue (refreshed daily)
├── harvest/
│   ├── tc-state.json         # Tecnocasa harvester state
│   ├── tc-listings.json.gz   # Tecnocasa listings backup
│   ├── c21-state.json        # Century21 state
│   ├── ...                   # Other harvesters
│   └── aproperties-state.json
└── html/
    └── {domain}/             # Raw HTML archives (optional)
```

## Monitoring

### Check Harvester Status

```bash
# View recent logs
aws logs tail /aws/lambda/tc-harvest-delta --since 1h

# Check DynamoDB counts by domain
aws dynamodb scan --table-name leo-listings --select COUNT \
  --filter-expression "#d = :domain" \
  --expression-attribute-names '{"#d":"domain"}' \
  --expression-attribute-values '{":domain":{"S":"tecnocasa.es"}}'
```

### Check Export Status

```bash
# Get export stats
curl http://localhost:3000/api/catalogue/export

# Or check S3 directly
aws s3 ls s3://puedo-casa-html-archive/catalogue/
```

## Costs

### Monthly Estimates

| Service | Usage | Cost |
|---------|-------|------|
| Lambda | ~200 invocations/month | ~$0.50 |
| DynamoDB | ~25k items, reads/writes | ~$5.00 |
| S3 | ~10GB storage + transfers | ~$1.00 |
| ScrapFly (aProperties) | ~3,000 requests/month | ~$3.00 |
| **Total** | | **~$10/month** |

## Troubleshooting

### Harvester Stuck

```bash
# Check for stuck state file
aws s3 ls s3://puedo-casa-html-archive/harvest/

# Clear state to restart
aws s3 rm s3://puedo-casa-html-archive/harvest/tc-state.json
```

### Export Not Updating

```bash
# Check export Lambda logs
aws logs tail /aws/lambda/catalogue-export --since 1h

# Manual re-export
curl -X POST http://localhost:3000/api/catalogue/export
```

### Cloudflare Blocking (aProperties)

The aProperties harvester uses ScrapFly. If getting blocked:
1. Check ScrapFly dashboard for rate limits
2. Reduce `PARALLEL_BATCH_SIZE` in harvester
3. Increase `REQUEST_DELAY_MS`

## Adding New Domains

1. Create `src/lambda/{domain}-harvest-delta.ts`
2. Follow the harvester template pattern
3. Add to `DOMAINS` array in `/api/catalogue/export/route.ts`
4. Add to `deploy-harvesters.sh` with schedule
5. Update this documentation

---

**Last Updated**: December 11, 2025
