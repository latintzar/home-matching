# Geo Data Pipeline Scripts

> **Status:** ✅ COMPLETE (Dec 8, 2025 - Enhanced POI Import)
> **Total Records:** 741,468
> **Total Cost:** ~$1.50

These scripts import Spain's geospatial data into DynamoDB for location scoring and the live heatmap.

## Data Summary (Verified via DynamoDB scan)

| Table | Records | Source |
|-------|---------|--------|
| `leo-census-sections` | 36,308 | spain-datasets GeoJSON + INE income CSV |
| `leo-osm-pois` | 126,009 | OSM spain.pbf (ENHANCED with area/wikidata) |
| `leo-atp-pois` | 92,375 | AllThePlaces (filtered for Spain) |
| `leo-neighborhood-boundaries` | 17,594 | OSM admin_level=10 barrios (78 with SERP data) |

### Enhanced POI Fields (Dec 8, 2025)

The `leo-osm-pois` table now includes:
- `areaM2` - Polygon area in m² (for filtering big vs small parks)
- `wikidata` - Wikipedia reference (indicates notability)
- `notable` - Boolean: has wikidata OR area > 10,000m²
- `dog` - Dog-friendly status ('yes', 'no', 'leashed')
- `wheelchair` - Accessibility
- `lit` - Has night lighting
- `surface` - Ground type (grass, sand, etc.)

**Notable POI counts:**
- 22,081 notable (wikidata OR large)
- 10,594 large (>10,000m²)
- 13,732 with Wikipedia
- 113 dog-friendly

## Scripts

### `extract-osm-pois.sh`

Extracts POI categories from `spain.pbf` using osmium-tool.

```bash
# Requires: osmium-tool (brew install osmium-tool)
./extract-osm-pois.sh
```

**Output:** Creates GeoJSON files in `data/geo/osm-extracts/`:
- `barrios.geojson` — admin_level=10 boundaries
- `parks.geojson` — leisure=park
- `metro.geojson` — station=subway
- `beaches.geojson` — natural=beach
- `schools.geojson` — amenity=school
- `supermarkets.geojson` — shop=supermarket
- `healthcare.geojson` — /clinic/doctors

### `import-census-sections.ts`

Imports census section polygons with INE income data.

```bash
npx tsx import-census-sections.ts [options]

Options:
  --dry-run        Preview without writing to DynamoDB
  --region <code>  Only import specific region (e.g., "08" for Barcelona)
```

**Source Files:**
- `data/geo/spain-datasets/data/census/*.json` — Census GeoJSON
- `data/geo/spain-datasets/data/Renta media en España.csv` — Income data

### `import-osm-pois.ts`

Imports named POIs from extracted GeoJSON files.

```bash
npx tsx import-osm-pois.ts [options]

Options:
  --dry-run       Preview without writing to DynamoDB
  --type <type>   Only import specific type (park, metro, beach, etc.)
```

**Note:** Only imports POIs with a `name` property to filter out minor/unnamed features.

### `import-osm-barrios.ts`

Imports neighborhood boundaries (admin_level=10).

```bash
npx tsx import-osm-barrios.ts [options]

Options:
  --dry-run       Preview without writing to DynamoDB
```

**Note:** Handles oversized geometries (>350KB) by storing centroid/bbox only.

### `import-alltheplaces.ts`

Imports AllThePlaces POIs filtered for Spain.

```bash
npx tsx import-alltheplaces.ts [options]

Options:
  --dry-run       Preview without writing to DynamoDB
  --limit <n>     Only import first n POIs
```

**Source:** `data/geo/alltheplaces/output/*.geojson`

### `match-serp-to-barrios.ts`

Matches SERP neighborhood profiles to OSM barrios and updates `serpData` field.

```bash
npx tsx match-serp-to-barrios.ts [options]

Options:
  --dry-run       Preview matches without writing to DynamoDB
```

**Results:** 78/86 profiles matched (91%)
- 72 exact matches
- 6 fuzzy matches (article prefixes)
- 8 unmatched (not in OSM admin_level=10)

**Manual mappings included for:**
- Valencia: Ruzafa→Russafa, Cabanyal→el Cabanyal
- Barcelona: El Born→Sant Pere Santa Caterina, Sant Gervasi→Sant Gervasi-Galvany
- Madrid: Malasaña→Universidad, Lavapiés→Embajadores, etc.

## Prerequisites

### Data Files

1. **OSM PBF files** (download once):
   ```bash
   cd data/geo/pbf
   wget https://geo2day.com/europe/spain.pbf
   wget https://geo2day.com/africa/canary-islands.pbf
   ```

2. **spain-datasets repo** (census + income):
   ```bash
   cd data/geo
   git clone https://github.com/miguel-angel-monjas/spain-datasets.git
   ```

3. **AllThePlaces** (download + extract):
   ```bash
   cd data/geo/alltheplaces
   wget https://data.alltheplaces.xyz/runs/latest/output.zip
   unzip output.zip
   ```

### AWS Credentials

Scripts require AWS credentials with DynamoDB write access:

```bash
source .env.local
export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION
```

## DynamoDB Tables

All tables use `PAY_PER_REQUEST` billing mode (no provisioned capacity).

| Table | PK | SK |
|-------|----|----|
| `leo-census-sections` | "ES" | CUSEC code |
| `leo-osm-pois` | POI type | geohash#osmId |
| `leo-atp-pois` | brand/category | geohash#id |
| `leo-neighborhood-boundaries` | city | neighborhood_id |

## Re-running Imports

All scripts are idempotent — they overwrite existing records with the same key.

To re-import after data source updates:

```bash
# Re-extract from fresh PBF
./extract-osm-pois.sh

# Re-import all
npx tsx import-census-sections.ts
npx tsx import-osm-pois.ts
npx tsx import-osm-barrios.ts
npx tsx import-alltheplaces.ts
```

## Neighborhoods by City

The barrios import infers city from coordinates:

| City | Barrios |
|------|---------|
| Other Spain | 16,085 |
| Málaga | 368 |
| Barcelona | 220 |
| Madrid | 197 |
| Valencia | 138 |
| Sevilla | 128 |
| Bilbao | 68 |
| Zaragoza | 17 |

## Related Documentation

- [P0-19-GEO-DATA-PIPELINE.md](../../docs/plans/P0-19-GEO-DATA-PIPELINE.md) — Full architecture
- [P0-04-LOCATION-SCORING.md](../../docs/plans/P0-04-LOCATION-SCORING.md) — How geo data is used

---

*Created: Dec 7, 2025*
