---
test_id: "S.7"
name: "Natural Language POI Search (Athena)"
scenario: 0
scenario_name: "Shared Building Blocks"
status: not-started
api: "iD Presets + AWS Athena (Daylight OSM)"
cost: "$0.01-0.03"
implementation: null
last_tested: null
---

### Shared.7 - Natural Language POI Search (Worldwide via Athena)

| | |
|---|---|
| **Input** | Natural language query + location (e.g., "padel courts in Barcelona") |
| **Output** | GeoJSON FeatureCollection of matching POIs as points on map |
| **API** | iD Presets (tag resolution) + AWS Athena (Daylight OSM) |
| **Cost** | ~$0.01-0.03 per query |
| **Latency** | 5-15 seconds (first query), <100ms (cached) |
| **Proves** | We can search for ANY POI type ANYWHERE in the world using natural language |

**Purpose:**
Enable users to search for POIs using natural language (e.g., "coffee shops", "tennis courts", "coworking spaces") without knowing OSM tagging conventions. The system resolves natural language to OSM tags using iD Editor presets, then queries **Athena directly against Daylight OSM** for worldwide coverage.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  INPUT:                                                                     │
│  {                                                                          │
│    "query": "padel courts",                                                │
│    "location": "Barcelona",   // or "Tokyo", "New York", anywhere!         │
│    "limit": 50                                                             │
│  }                                                                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: GEOCODE LOCATION → BBOX                                           │
│  ═══════════════════════════════                                           │
│                                                                             │
│  "Barcelona" → bbox: [2.02, 41.32, 2.23, 41.47]                           │
│  Uses: Mapbox Geocoder or Geoapify                                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 2: RESOLVE QUERY → OSM TAGS (iD Presets)                             │
│  ═════════════════════════════════════════════                             │
│                                                                             │
│  Search iD presets for "padel":                                            │
│                                                                             │
│  id-presets.json (~2MB, downloaded once):                                  │
│  {                                                                          │
│    "leisure/pitch/padel": {                                                │
│      "name": "Padel Court",                                                │
│      "tags": { "leisure": "pitch", "sport": "padel" },                    │
│      "terms": ["padel", "paddle tennis", "pádel"]                         │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  Result: { leisure: "pitch", sport: "padel" }                              │
│  Confidence: "exact" (matched preset terms)                                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 3: CHECK CACHE                                                        │
│  ═══════════════════                                                        │
│                                                                             │
│  Cache key: `poi-search:padel:barcelona:50`                                │
│  If cached → return instantly (<100ms)                                     │
│  If not → proceed to Athena                                                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 4: QUERY ATHENA (Daylight OSM - WORLDWIDE)                           │
│  ═══════════════════════════════════════════════                           │
│                                                                             │
│  SELECT                                                                     │
│    id,                                                                      │
│    tags['name'] as name,                                                    │
│    tags['sport'] as sport,                                                 │
│    ST_X(ST_CENTROID(ST_GEOMETRYFROMTEXT(wkt))) as lng,                    │
│    ST_Y(ST_CENTROID(ST_GEOMETRYFROMTEXT(wkt))) as lat                     │
│  FROM daylight_osm_features                                                │
│  WHERE release = 'v1.49'                                                   │
│    AND tags['leisure'] = 'pitch'                                          │
│    AND tags['sport'] LIKE '%padel%'                                       │
│    AND min_lat BETWEEN 41.32 AND 41.47                                    │
│    AND min_lon BETWEEN 2.02 AND 2.23                                      │
│  LIMIT 50                                                                   │
│                                                                             │
│  Cost: ~$0.01-0.03 (scans ~2-5 GB of partitioned Parquet)                 │
│  Time: 5-15 seconds                                                        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 5: CACHE & RETURN                                                     │
│  ═════════════════════                                                      │
│                                                                             │
│  - Cache results in DynamoDB (TTL: 7 days)                                 │
│  - Convert to GeoJSON FeatureCollection                                    │
│  - Return with metadata                                                    │
│                                                                             │
│  {                                                                          │
│    "type": "FeatureCollection",                                            │
│    "features": [                                                           │
│      {                                                                      │
│        "type": "Feature",                                                  │
│        "geometry": { "type": "Point", "coordinates": [2.15, 41.40] },     │
│        "properties": { "name": "Club Padel Barcelona", "sport": "padel" } │
│      },                                                                     │
│      ...                                                                    │
│    ]                                                                        │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Steps

| # | Action | Method |
|---|--------|--------|
| 1 | Parse query and location | Input JSON |
| 2 | Geocode location to bbox | Mapbox Geocoding API |
| 3 | Search iD presets for matching tags | Fuzzy search on name + terms array |
| 4 | If no preset match, fall back to Gemini | LLM with OSM tag examples (few-shot) |
| 5 | Check cache for this query+location | DynamoDB lookup |
| 6 | Query Athena (Daylight OSM) | Build SQL from resolved tags + bbox |
| 7 | Cache results | Store in DynamoDB with 7-day TTL |
| 8 | Convert to GeoJSON & return | Include resolved tags, confidence, timing |

---

## 📋 TEST INPUT (copy-paste):

```json
{
  "query": "padel courts",
  "location": "Barcelona",
  "limit": 50
}
```

**Alternative inputs:**
```json
{ "query": "coffee shops", "location": "Gràcia, Barcelona", "limit": 20 }
{ "query": "tennis courts", "location": "New York", "limit": 100 }
{ "query": "coworking spaces", "location": "Berlin", "limit": 30 }
{ "query": "vegan restaurants", "location": "Amsterdam", "limit": 25 }
```

---

## Expected Output

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [2.1523, 41.4012]
      },
      "properties": {
        "id": "way/123456789",
        "name": "Padel Barcelona Club",
        "sport": "padel"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [2.1645, 41.3891]
      },
      "properties": {
        "id": "way/987654321",
        "name": "Club Tennis Vall d'Hebron",
        "sport": "padel;tennis"
      }
    }
  ],
  "metadata": {
    "query": "padel courts",
    "resolvedTags": { "leisure": "pitch", "sport": "padel" },
    "tagSource": "id-preset",
    "presetId": "leisure/pitch/padel",
    "confidence": "exact",
    "location": "Barcelona",
    "bbox": [2.02, 41.32, 2.23, 41.47],
    "dataSource": "athena",
    "cached": false,
    "resultCount": 47,
    "queryTimeMs": 6823,
    "athenaScannedBytes": "2.3 GB",
    "cost": "$0.012"
  }
}
```

---

## Tag Resolution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  USER QUERY                    RESOLUTION PATH                              │
│  ══════════                    ═══════════════                              │
│                                                                             │
│  "coffee shops"     ──────►    iD Preset: "amenity/cafe"                   │
│                                 → { amenity: "cafe" }                       │
│                                 → Confidence: exact                         │
│                                                                             │
│  "paddle tennis"    ──────►    iD Preset: "leisure/pitch/padel"            │
│                                 → { leisure: "pitch", sport: "padel" }     │
│                                 → Confidence: exact                         │
│                                                                             │
│  "coworking"        ──────►    iD Preset: "amenity/coworking_space"        │
│                                 → { amenity: "coworking_space" }           │
│                                 → Confidence: exact                         │
│                                                                             │
│  "dog-friendly      ──────►    No preset match                             │
│   cafes"                        → Gemini fallback with grounding           │
│                                 → { amenity: "cafe", dog: "yes" }          │
│                                 → Confidence: inferred                      │
│                                                                             │
│  "good restaurants" ──────►    iD Preset: "amenity/restaurant"             │
│                                 → { amenity: "restaurant" }                │
│                                 → Note: "good" is subjective, ignored      │
│                                 → Confidence: partial                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Common Query → Tag Mappings (from iD Presets)

| Query | Resolved Tags | Athena WHERE Clause |
|-------|---------------|---------------------|
| "cafe", "coffee" | `amenity=cafe` | `tags['amenity'] = 'cafe'` |
| "restaurant" | `amenity=restaurant` | `tags['amenity'] = 'restaurant'` |
| "bar", "pub" | `amenity=bar` | `tags['amenity'] = 'bar'` |
| "bakery" | `shop=bakery` | `tags['shop'] = 'bakery'` |
| "supermarket" | `shop=supermarket` | `tags['shop'] = 'supermarket'` |
| "gym", "fitness" | `leisure=fitness_centre` | `tags['leisure'] = 'fitness_centre'` |
| "tennis court" | `leisure=pitch` + `sport=tennis` | `tags['leisure'] = 'pitch' AND tags['sport'] LIKE '%tennis%'` |
| "padel" | `leisure=pitch` + `sport=padel` | `tags['leisure'] = 'pitch' AND tags['sport'] LIKE '%padel%'` |
| "basketball" | `leisure=pitch` + `sport=basketball` | `tags['leisure'] = 'pitch' AND tags['sport'] LIKE '%basketball%'` |
| "park" | `leisure=park` | `tags['leisure'] = 'park'` |
| "playground" | `leisure=playground` | `tags['leisure'] = 'playground'` |
| "beach" | `natural=beach` | `tags['natural'] = 'beach'` |
| "metro", "subway" | `railway=station` + `station=subway` | `tags['railway'] = 'station' AND tags['station'] = 'subway'` |
| "pharmacy" | `amenity=pharmacy` | `tags['amenity'] = 'pharmacy'` |
| "hospital" | `` | `tags['amenity'] = 'hospital'` |
| "school" | `amenity=school` | `tags['amenity'] = 'school'` |
| "coworking" | `amenity=coworking_space` | `tags['amenity'] = 'coworking_space'` |

---

## iD Presets Integration

### 1. Download Presets (one-time)

```bash
curl -o src/data/id-presets.json \
  https://raw.githubusercontent.com/openstreetmap/id-tagging-schema/main/dist/presets.json
```

### 2. Tag Resolver Implementation

```typescript
// src/lib/geo/tag-resolver.ts
import presets from '@/data/id-presets.json';

interface ResolvedTags {
  tags: Record<string, string>;
  confidence: 'exact' | 'partial' | 'inferred' | 'none';
  presetId?: string;
  presetName?: string;
}

export function resolveQueryToTags(query: string): ResolvedTags {
  const q = query.toLowerCase().trim();
  
  // Search presets by name and terms
  for (const [id, preset] of Object.entries(presets)) {
    if (!preset.tags) continue;
    
    const name = preset.name?.toLowerCase() || '';
    const terms = preset.terms || [];
    
    // Exact match on name or terms
    if (name === q || terms.includes(q)) {
      return {
        tags: preset.tags,
        confidence: 'exact',
        presetId: id,
        presetName: preset.name
      };
    }
    
    // Partial match (query contains term or vice versa)
    if (name.includes(q) || q.includes(name) || 
        terms.some(t => t.includes(q) || q.includes(t))) {
      return {
        tags: preset.tags,
        confidence: 'partial',
        presetId: id,
        presetName: preset.name
      };
    }
  }
  
  return { tags: {}, confidence: 'none' };
}

// Convert resolved tags to Athena WHERE clause
export function tagsToAthenaWhere(tags: Record<string, string>): string {
  return Object.entries(tags)
    .map(([key, value]) => {
      // Use LIKE for multi-value tags (sport, cuisine)
      if (['sport', 'cuisine'].includes(key)) {
        return `tags['${key}'] LIKE '%${value}%'`;
      }
      return `tags['${key}'] = '${value}'`;
    })
    .join(' AND ');
}
```

---

## Gemini Fallback (for unmatched queries)

When iD presets don't match, use Gemini with grounding:

```typescript
// src/lib/geo/gemini-tag-resolver.ts
const FALLBACK_PROMPT = `
You are an OSM tagging expert. Given a natural language query, return the most likely OSM tags.

Available tag examples:
- cafe/coffee → amenity=cafe
- restaurant → amenity=restaurant  
- tennis court → leisure=pitch, sport=tennis
- padel → leisure=pitch, sport=padel
- dog park → leisure=dog_park
- pharmacy → amenity=pharmacy

Query: "{query}"

Respond with JSON only:
{
  "tags": { "key": "value" },
  "confidence": "high" | "medium" | "low",
  "reasoning": "brief explanation"
}
`;
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/data/id-presets.json` | Downloaded iD Editor presets (~2MB) |
| `src/lib/geo/tag-resolver.ts` | Natural language → OSM tags + Athena WHERE builder |
| `src/lib/geo/athena-poi-search.ts` | Athena query execution + result parsing |
| `src/lib/geo/poi-search-cache.ts` | DynamoDB cache layer (7-day TTL) |
| `src/app/api/geo/search-pois/route.ts` | API endpoint |

---

## Cost Analysis

| Query Type | Athena Cost | Time | Notes |
|------------|-------------|------|-------|
| City-level (Barcelona) | ~$0.01-0.02 | 5-10 sec | Scans ~2-3 GB |
| Metro area (Greater Barcelona) | ~$0.02-0.03 | 8-15 sec | Scans ~3-5 GB |
| Region (Catalonia) | ~$0.03-0.05 | 10-20 sec | Scans ~5-8 GB |
| **Cached query** | **$0** | **<100ms** | 7-day TTL |

**Note:** Athena charges $5 per TB scanned. Daylight OSM Parquet is well-partitioned by lat/lon, so bbox queries are efficient.

---

## Integration with Test Panel

This test should appear with:
- **Text input**: Natural language query (e.g., "padel courts")
- **Location input**: City/neighborhood name
- **Limit slider**: 10-100 (default: 50)
- **Output**: POI markers on map with popup info

---

## Map Rendering After Test

When POIs are returned:
1. Add marker layer for each POI
2. Use appropriate icons (🎾 tennis, ☕ cafe, 🏥 pharmacy, etc.)
3. Cluster markers at low zoom levels
4. Show popup on click with name + attributes
5. List POIs in sidebar with count

---

## AWS Setup Required

### 1. Athena Database (same as S.6)
```sql
-- Create external table pointing to Daylight OSM
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
LOCATION 's3://daylight-map-distribution/parquet/v1.49/'
TBLPROPERTIES ('parquet.compression'='SNAPPY');
```

### 2. Cache Table (DynamoDB)
```bash
aws dynamodb create-table \
  --table-name leo-poi-search-cache \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=puedo-casa
```

### 3. Dependencies
```bash
npm install @aws-sdk/client-athena
```

---

## Coverage

✅ **Worldwide** - Works for any location on Earth
- Tokyo, New York, Barcelona, Berlin, Sydney, São Paulo...
- Any city, neighborhood, or region with OSM data
- No pre-import needed - Athena queries Daylight OSM directly

---

*Last Updated: December 2024*
