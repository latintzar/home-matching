# Database Schemas Reference

> Table definitions for AWS DynamoDB. See `LEO_ARCHITECTURE.md` for overview.

## DynamoDB Tables

### leo-listings
**Purpose**: Core property data (650k records)

| Attribute | Type | Key |
|-----------|------|-----|
| `domain` | String | Partition Key |
| `listing_id` | String | Sort Key |
| `url` | String | |
| `price` | Number | |
| `bedrooms` | Number | |
| `bathrooms` | Number | |
| `sqm` | Number | |
| `city` | String | GSI |
| `neighborhood` | String | |
| `listing_type` | String | sale/rent |
| `property_type` | String | |
| `image_urls` | List | URLs only, not images |
| `s3_path` | String | Path to HTML |
| `crawled_at` | String | ISO timestamp |
| `parsed_at` | String | ISO timestamp |
| `status` | String | active/sold/rented/removed |
| `status_signal` | String | How detected |
| `days_on_market` | Number | |
| `first_seen` | String | |
| `last_seen` | String | |

**GSIs**:
- `city-index`: Query by city
- `status-index`: Query by status

### leo-scraping-rules
**Purpose**: Learned CSS selectors per domain (3,635 domains)

| Attribute | Type | Key |
|-----------|------|-----|
| `domain` | String | Partition Key |
| `selectors` | Map | CSS selectors |
| `trust_level` | Number | 0-10, 10=graduated |
| `status` | String | learning/validating/graduated |
| `last_success` | String | |
| `failure_count` | Number | |
| `version` | Number | |

### leo-crawl-tracking
**Purpose**: Crawl metadata per domain

| Attribute | Type | Key |
|-----------|------|-----|
| `domain` | String | Partition Key |
| `has_sitemap` | Boolean | |
| `sitemap_url` | String | |
| `last_full_crawl` | String | |
| `last_delta_crawl` | String | |
| `listings_count` | Number | |
| `listings_added_today` | Number | |
| `listings_removed_today` | Number | |
| `status` | String | healthy/error/blocked |

### leo-wpa-cache
**Purpose**: Whole Property Analysis results

| Attribute | Type | Key |
|-----------|------|-----|
| `listing_url` | String | Partition Key |
| `domain` | String | GSI |
| `schema_version` | String | |
| `analyzed_at` | String | |
| `photo_count` | Number | |
| `rooms` | List | Room analyses |
| `layout` | Map | Layout analysis |
| `light` | Map | Light analysis |
| `condition` | Map | Condition analysis |
| `potential` | Map | WFH, hosting, guest |
| `building_observations` | List | |
| `street_observations` | List | |

### leo-geo-intelligence
**Purpose**: Dossier system (building/street/neighborhood)

| Attribute | Type | Key |
|-----------|------|-----|
| `geohash` | String | Partition Key |
| `insight_id` | String | Sort Key |
| `lat` | Number | |
| `lng` | Number | |
| `radius_m` | Number | 0=exact, 500=neighborhood |
| `city` | String | GSI |
| `insight_type` | String | property/building/street/era |
| `insight_category` | String | noise/structural/condition |
| `insight_key` | String | |
| `insight_value` | Map | |
| `confidence` | Number | 0.00-1.00 |
| `source_type` | String | |
| `observation_count` | Number | |

### leo-market-velocity
**Purpose**: Sold/rented analytics by location

| Attribute | Type | Key |
|-----------|------|-----|
| `location_key` | String | Partition Key (e.g., "Madrid/Salamanca") |
| `period` | String | Sort Key (e.g., "2025-11") |
| `property_type` | String | |
| `avg_days_on_market` | Number | |
| `median_days_on_market` | Number | |
| `total_sold` | Number | |
| `total_rented` | Number | |
| `avg_sold_price` | Number | |

### leo-analysis-cache
**Purpose**: Text analysis, room analysis results

| Attribute | Type | Key |
|-----------|------|-----|
| `listing_id` | String | Partition Key |
| `analysis_type` | String | Sort Key (text_a, room_by_room, etc.) |
| `results` | Map | Analysis results |
| `created_at` | String | |
| `schema_version` | String | |

## Supabase Tables (Stay on Free Tier)

These stay on Supabase (small, user-facing):

| Table | Purpose |
|-------|---------|
| `agents` | Agency info (671 rows) |
| `deepdives` | Published reports |
| `deepdive_requests` | User requests |
| `user_lifestyle_profiles` | Life Profiles |
| Auth tables | Supabase Auth |

## S3 Structure

```
s3://puedo-casa-html-archive/
├── html/
│   ├── {domain}/
│   │   ├── {listing_path}.html.gz
│   │   └── ...
│   └── ...
├── data/
│   └── exports/
└── logs/
```

---

*Last Updated: 2025-11-28*

