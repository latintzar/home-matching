---
test_id: "S.6"
name: "Resolve Area Names to Real Polygons (Athena)"
scenario: 0
scenario_name: "Shared Building Blocks"
status: not-started
api: "AWS Athena + Daylight OSM"
cost: "$0.01-0.05"
implementation: null
last_tested: null
---

### Shared.6 - Resolve Area Names to Real Polygon Geometries

| | |
|---|---|
| **Input** | Raw JSON output from tests 1.1, 2.1, or 3.1 (array of areas with names + lat/lng) |
| **Output** | Same array but with actual polygon geometries from OSM |
| **API** | AWS Athena + Daylight OSM |
| **Cost** | ~$0.01-0.05 per query (cached: $0) |
| **Latency** | 5-15 seconds (with caching: <100ms) |
| **Proves** | We can replace placeholder circles with real boundary polygons |

**Purpose:**
Tests 1.1, 2.1, and 3.1 return neighborhoods/areas as points with lat/lng. This test takes those results and queries Athena to get the actual polygon boundaries, enabling accurate area rendering instead of circles.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  INPUT (from 1.1/2.1/3.1):                                                 │
│  [                                                                          │
│    { name: "El Born", lat: 41.38, lng: 2.18, why: "..." },                 │
│    { name: "Gràcia", lat: 41.40, lng: 2.15, why: "..." },                  │
│  ]                                                                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: CHECK CACHE                                                        │
│  ════════════════════                                                       │
│                                                                             │
│  For each area name:                                                        │
│    - Check DynamoDB cache: `polygon-cache:{city}:{normalized_name}`        │
│    - If found → use cached WKT geometry                                    │
│    - If not found → add to Athena query batch                              │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 2: QUERY ATHENA (for cache misses only)                              │
│  ════════════════════════════════════════════                              │
│                                                                             │
│  SELECT                                                                     │
│    tags['name'] as name,                                                    │
│    wkt as geometry,                                                         │
│    tags['place'] as place_type,                                            │
│    tags['admin_level'] as admin_level                                      │
│  FROM daylight_osm_features                                                │
│  WHERE release = 'v1.9'                                                    │
│    AND (                                                                    │
│      tags['name'] LIKE '%El Born%'                                         │
│      OR tags['name'] LIKE '%Gràcia%'                                       │
│    )                                                                        │
│    AND (                                                                    │
│      tags['place'] IN ('neighbourhood', 'suburb', 'quarter')               │
│      OR (tags['boundary'] = 'administrative' AND tags['admin_level'] >= '9')│
│    )                                                                        │
│    AND min_lat BETWEEN 41.0 AND 42.0  -- Barcelona bbox                    │
│    AND min_lon BETWEEN 1.5 AND 2.5                                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 3: CACHE RESULTS                                                      │
│  ═════════════════════                                                      │
│                                                                             │
│  For each result:                                                           │
│    - Store in DynamoDB: `polygon-cache:barcelona:el-born` → WKT geometry   │
│    - TTL: 30 days (boundaries rarely change)                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 4: CONVERT & RETURN                                                   │
│  ════════════════════════                                                   │
│                                                                             │
│  - Parse WKT to GeoJSON polygons                                           │
│  - Attach to original area objects                                          │
│  - Return enriched array                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Steps

| # | Action | Method |
|---|--------|--------|
| 1 | Receive area array from previous test | Input JSON |
| 2 | Extract city from context or input | `city: "Barcelona"` |
| 3 | Normalize area names | `name.toLowerCase().replace(/\s+/g, '-')` |
| 4 | Check polygon cache for each name | DynamoDB lookup on `leo-polygon-cache` table |
| 5 | Batch uncached names into Athena query | Build SQL with OR clauses for name LIKE |
| 6 | Execute Athena query | `@aws-sdk/client-athena` StartQueryExecution + GetQueryResults |
| 7 | Parse WKT geometries from results | Match by fuzzy name comparison |
| 8 | Convert WKT to GeoJSON | `wellknown` npm package |
| 9 | Cache new results in DynamoDB | Store with 30-day TTL |
| 10 | Return enriched array | Add `geometry` field to each area |

---

## 📋 TEST INPUT (copy-paste):

```json
{
  "city": "Barcelona",
  "areas": [
    { "name": "El Born", "lat": 41.3851, "lng": 2.1826, "why": "Historic bars and medieval streets" },
    { "name": "Gràcia", "lat": 41.4036, "lng": 2.1566, "why": "Local vibe and independent shops" },
    { "name": "Raval", "lat": 41.3803, "lng": 2.1686, "why": "Multicultural and artsy" }
  ]
}
```

---

## Expected Output

```json
{
  "city": "Barcelona",
  "areas": [
    {
      "name": "El Born",
      "lat": 41.3851,
      "lng": 2.1826,
      "why": "Historic bars and medieval streets",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[2.1780, 41.3820], [2.1850, 41.3820], [2.1850, 41.3880], [2.1780, 41.3880], [2.1780, 41.3820]]]
      },
      "geometryType": "neighbourhood",
      "source": "athena",
      "osmId": "relation/12345"
    },
    {
      "name": "Gràcia",
      "lat": 41.4036,
      "lng": 2.1566,
      "why": "Local vibe and independent shops",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[2.1400, 41.3950], [2.1700, 41.3950], [2.1700, 41.4150], [2.1400, 41.4150], [2.1400, 41.3950]]]
      },
      "geometryType": "neighbourhood",
      "source": "cache",
      "osmId": "relation/23456"
    },
    {
      "name": "Raval",
      "lat": 41.3803,
      "lng": 2.1686,
      "why": "Multicultural and artsy",
      "geometry": null,
      "geometryType": null,
      "source": "not_found",
      "osmId": null
    }
  ],
  "stats": {
    "cached": 1,
    "queried": 2,
    "found": 2,
    "notFound": 1,
    "totalTimeMs": 8500
  }
}
```

---

## Fallback Behavior

| Scenario | Handling |
|----------|----------|
| Athena finds no polygon | Keep original lat/lng, set `geometry: null`, `source: "not_found"` |
| Multiple matches for name | Pick closest to provided lat/lng using Turf.js distance |
| Athena query fails | Return original data with `error` field, don't break flow |
| Cache hit | Skip Athena entirely, return instantly |

---

## Cost Analysis

| Scenario | Athena Cost | Time |
|----------|-------------|------|
| 5 areas (all cached) | $0 | <100ms |
| 5 areas (all new) | ~$0.01-0.02 | 8-15 sec |
| 10 areas (mixed) | ~$0.005-0.01 | 3-10 sec |
| Subsequent requests (same areas) | $0 | <100ms |

---

## AWS Setup Required

### 1. Athena Database Setup
```sql
-- Create database (once)
CREATE DATABASE IF NOT EXISTS osm_data;

-- Create external table pointing to Daylight OSM Parquet files
CREATE EXTERNAL TABLE IF NOT EXISTS osm_data.daylight_features (
  id STRING,
  type STRING,
  tags MAP<STRING, STRING>,
  wkt STRING,
  min_lat DOUBLE,
  max_lat DOUBLE,
  min_lon DOUBLE,
  max_lon DOUBLE
)
STORED AS PARQUET
LOCATION 's3://daylight-map-distribution/parquet/v1.9/'
TBLPROPERTIES ('parquet.compression'='SNAPPY');
```

### 2. DynamoDB Cache Table
```bash
aws dynamodb create-table \
  --table-name leo-polygon-cache \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=puedo-casa
```

### 3. S3 Bucket for Athena Results
```bash
aws s3 mb s3://puedo-casa-athena-results --region us-east-1
```

### 4. IAM Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "athena:StartQueryExecution",
        "athena:GetQueryExecution",
        "athena:GetQueryResults"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::daylight-map-distribution/*",
        "arn:aws:s3:::daylight-map-distribution"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::puedo-casa-athena-results/*"
    }
  ]
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/geo/athena-polygon-resolver.ts` | Core Athena query logic + WKT parsing |
| `src/lib/geo/polygon-cache.ts` | DynamoDB cache layer |
| `src/app/api/geo/resolve-polygons/route.ts` | Next.js API endpoint |

---

## Dependencies

```bash
npm install @aws-sdk/client-athena wellknown @turf/distance
```

---

## Integration with Test Panel

This test should appear in the test panel after S.5, with:
- Button: "Resolve Polygons"
- Input: Auto-populated from last 1.1/2.1/3.1 output
- Output: GeoJSON polygons rendered on map (replacing circles)

---

## Map Rendering After Test

When polygons are resolved:
1. Remove placeholder circles from S.1
2. Add polygon layer with same colors
3. Keep fill opacity at 0.3, stroke at 0.8
4. Maintain hover/click behavior from existing UI

---

*Last Updated: December 2024*
