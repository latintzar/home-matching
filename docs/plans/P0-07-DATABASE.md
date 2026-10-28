# P0-07: Database Schema — Supabase + DynamoDB

> **Parent:** [P0 Index](./P0_INDEX.md)

---

## Overview

Data is split between two systems:
- **Supabase:** User data, profiles, preferences, saved properties
- **DynamoDB:** Bulk property data, WPA cache, POI data

---

## Supabase Schema

### User Profile Tables

```sql
-- Core user profile
CREATE TABLE user_lifestyle_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  profile_type TEXT NOT NULL DEFAULT 'renter', -- 'renter' | 'buyer'
  
  -- Basic requirements
  city TEXT,
  max_budget INTEGER,
  min_area INTEGER,
  min_bedrooms INTEGER,
  
  -- Dimension weights (from Psychologist)
  dimension_weights JSONB DEFAULT '{}',
  
  -- Thresholds for each dimension
  dimension_thresholds JSONB DEFAULT '{}',
  
  -- Which dimensions are relevant
  dimension_relevance JSONB DEFAULT '{}',
  
  -- POI preferences
  poi_preferences JSONB DEFAULT '[]',
  
  -- Commute anchors
  anchors JSONB DEFAULT '[]',
  
  -- City familiarity
  city_familiarity TEXT DEFAULT 'none', -- 'none' | 'visited' | 'expert'
  
  -- Vibe-check results
  vibe_check_results JSONB DEFAULT '[]',
  
  -- Status tracking
  intake_completed_at TIMESTAMPTZ,
  last_stock_check TIMESTAMPTZ,
  stock_status TEXT DEFAULT 'unchecked',
  last_recommendations_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_profiles_active ON user_lifestyle_profiles(intake_completed_at) 
  WHERE intake_completed_at IS NOT NULL;
CREATE INDEX idx_profiles_stock_check ON user_lifestyle_profiles(last_stock_check, stock_status);
```

### User Signals (From Notes/Calls)

```sql
-- Individual preference signals
CREATE TABLE user_preference_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  profile_id UUID REFERENCES user_lifestyle_profiles(id),
  
  -- Signal details
  signal_type TEXT NOT NULL, -- 'like' | 'dislike' | 'must_have' | 'dealbreaker'
  dimension TEXT NOT NULL,   -- e.g., 'natural_light', 'kitchen_size'
  value TEXT,                -- Optional specific value
  source TEXT NOT NULL,      -- 'intake_call' | 'note' | 'vibe_check' | 'manual'
  
  -- Original context
  raw_text TEXT,
  confidence DECIMAL(3,2),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_signals_user_profile ON user_preference_signals(user_id, profile_id);
CREATE INDEX idx_signals_dimension ON user_preference_signals(dimension);
```

### Saved Properties

```sql
-- User likes/saves
CREATE TABLE saved_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  listing_id TEXT NOT NULL,
  
  -- Snapshot of fit score at save time
  fit_score INTEGER,
  fit_breakdown JSONB,
  
  -- User notes
  user_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_saved_unique ON saved_properties(user_id, listing_id);
```

### Property Explanations (Per-User Cache)

```sql
-- Personalized explanations
CREATE TABLE user_property_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  listing_id TEXT NOT NULL,
  
  -- Generated explanation
  explanation TEXT NOT NULL,
  
  -- Fit details at generation time
  fit_score INTEGER,
  top_matches TEXT[],
  concerns TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days')
);

CREATE UNIQUE INDEX idx_explanations_unique ON user_property_explanations(user_id, listing_id);
CREATE INDEX idx_explanations_expires ON user_property_explanations(expires_at);
```

---

## DynamoDB Tables

### leo-listings (Existing)

| Field | Type | Description |
|-------|------|-------------|
| `domain` (PK) | String | Source domain (e.g., "idealista") |
| `listing_id` (SK) | String | Unique listing ID |
| `url` | String | Original listing URL |
| `title` | String | Listing title |
| `price` | Number | Price in EUR |
| `area` | Number | Area in m² |
| `bedrooms` | Number | Number of bedrooms |
| `bathrooms` | Number | Number of bathrooms |
| `city` | String | City name |
| `lat` | Number | Latitude |
| `lng` | Number | Longitude |
| `photos` | List | Photo URLs (not base64!) |
| `description` | String | Listing description |
| `scraped_at` | String | ISO timestamp |
| `is_active` | Boolean | Still on market? |

### leo-wpa-cache (WPA Results)

| Field | Type | Description |
|-------|------|-------------|
| `listing_id` (PK) | String | Matches leo-listings |
| `version` | String | Schema version ("v2") |
| `scores` | Map | 35 dimension scores (0-100) |
| `standouts` | List | Notable positive features |
| `concerns` | List | Potential issues |
| `confidence` | String | "high" / "medium" / "low" |
| `computed_at` | String | ISO timestamp |
| `ttl` | Number | DynamoDB TTL (30 days) |

### leo-neighborhood-boundaries

| Field | Type | Description |
|-------|------|-------------|
| `city` (PK) | String | City slug (e.g., "barcelona") |
| `neighborhood_id` (SK) | String | Unique neighborhood ID |
| `name` | String | Display name |
| `geojson` | Map | GeoJSON geometry |
| `centroid` | Map | `{ lat, lng }` |
| `income_score` | Number | Aggregated from INE data (0-100) |

### leo-neighborhood-profiles

| Field | Type | Description |
|-------|------|-------------|
| `city` (PK) | String | City slug |
| `neighborhood_id` (SK) | String | Unique neighborhood ID |
| `dimensions` | Map | 20+ dimension scores (0-100) |
| `serp_source` | String | "serp_research" / "airbnb" / "manual" |
| `updated_at` | String | ISO timestamp |

### leo-osm-pois (OSM POIs)

| Field | Type | Description |
|-------|------|-------------|
| `city` (PK) | String | City slug |
| `poi_type` (SK) | String | "beach" / "park" / "metro" / etc. |
| `geojson` | Map | GeoJSON FeatureCollection |
| `count` | Number | Number of features |
| `updated_at` | String | ISO timestamp |

### leo-atp-pois (AllThePlaces POIs)

| Field | Type | Description |
|-------|------|-------------|
| `city` (PK) | String | City slug |
| `category` (SK) | String | "cafe" / "restaurant" / "gym" / etc. |
| `pois` | List | POI objects with coords |
| `count` | Number | Number of POIs |
| `updated_at` | String | ISO timestamp |

### leo-airbnb-heatmap

| Field | Type | Description |
|-------|------|-------------|
| `city` (PK) | String | City slug |
| `h3_index` (SK) | String | H3 hex index (resolution 8) |
| `quietness` | Number | Score 0-100 |
| `tourist_density` | Number | Score 0-100 |
| `vibe_tags` | List | Extracted vibe keywords |
| `review_count` | Number | Reviews analyzed |
| `updated_at` | String | ISO timestamp |

---

## Migrations

### Required Migrations

| Migration | Purpose | Status |
|-----------|---------|--------|
| 075_linked_profiles.sql | Profile switching for renter/buyer | ⏳ TODO |
| 079_recommender_v3_schema.sql | New dimension weights, anchors, vibe-check | ⏳ TODO |

### Migration 079 (Recommender V3)

```sql
-- Add new columns to user_lifestyle_profiles
ALTER TABLE user_lifestyle_profiles ADD COLUMN IF NOT EXISTS
  dimension_weights JSONB DEFAULT '{}',
  dimension_thresholds JSONB DEFAULT '{}',
  dimension_relevance JSONB DEFAULT '{}',
  poi_preferences JSONB DEFAULT '[]',
  anchors JSONB DEFAULT '[]',
  city_familiarity TEXT DEFAULT 'none',
  vibe_check_results JSONB DEFAULT '[]',
  last_stock_check TIMESTAMPTZ,
  stock_status TEXT DEFAULT 'unchecked',
  intake_completed_at TIMESTAMPTZ,
  last_recommendations_at TIMESTAMPTZ;

-- Index for batch processing
CREATE INDEX IF NOT EXISTS idx_profiles_active 
  ON user_lifestyle_profiles(intake_completed_at) 
  WHERE intake_completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_stock_check
  ON user_lifestyle_profiles(last_stock_check, stock_status);

-- User property explanations table
CREATE TABLE IF NOT EXISTS user_property_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  listing_id TEXT NOT NULL,
  explanation TEXT NOT NULL,
  fit_score INTEGER,
  top_matches TEXT[],
  concerns TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_explanations_unique 
  ON user_property_explanations(user_id, listing_id);
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   INTAKE CALL                                                               │
│   ───────────                                                               │
│                                                                             │
│   User speaks → Agent extracts → update_profile tool → Supabase             │
│                                                                             │
│   ┌─────────────────────┐                                                   │
│   │ user_lifestyle_     │                                                   │
│   │ profiles            │ ← dimension_weights, anchors, poi_preferences     │
│   └─────────────────────┘                                                   │
│                                                                             │
│   BATCH PROCESSING                                                          │
│   ────────────────                                                          │
│                                                                             │
│   1. Query Supabase → Get profiles with intake_completed_at                 │
│   2. Query DynamoDB → Get listings matching city, price, bedrooms           │
│   3. Score → Pre-WPA (FREE) → Filter top 100                                │
│   4. Check DynamoDB → WPA cache hit?                                        │
│      • Yes → Use cached WPA                                                 │
│      • No → Run WPA → Cache in DynamoDB                                     │
│   5. Score → Full fit score                                                 │
│   6. Generate → Explanations → Cache in Supabase                            │
│   7. Notify → Email/push                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## No Photo Storage Rule

**CRITICAL:** We do NOT store listing photos. Only URLs.

```
✅ DO:
- Store photo URLs in leo-listings.photos
- Fetch URLs at WPA time
- Process and discard image buffers
- Cache WPA RESULTS (text/JSON) in DynamoDB

❌ DO NOT:
- Store photos in S3
- Store base64 in DynamoDB
- Cache image files locally
- Create "photo archive" buckets
```

### Safeguards

1. **DynamoDB Base64 Blocker:**
```typescript
// src/lib/dynamodb/validators.ts
export function rejectBase64Images(item: Record<string, unknown>): void {
  // Throws if base64 image detected
}
```

2. **S3 Bucket Policy:**
```json
{
  "Effect": "Deny",
  "Action": "s3:PutObject",
  "Condition": { "StringLike": { "s3:ContentType": ["image/*"] } }
}
```

---

## Related Documents

| Document | Contents |
|----------|----------|
| [P0-08-TASKS](./P0-08-TASKS.md) | Migration execution |
| [DATA_SOURCES_ARCHITECTURE](../DATA_SOURCES_ARCHITECTURE.md) | DynamoDB table details |

---

*Last Updated: December 2024*

