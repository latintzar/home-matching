#!/bin/bash
# Extract POIs and Barrios from spain.pbf using osmium
#
# Prerequisites: brew install osmium-tool
#
# Usage: ./scripts/geo/extract-osm-pois.sh

set -e

DATA_DIR="data/geo"
PBF_DIR="$DATA_DIR/pbf"
OUTPUT_DIR="$DATA_DIR/osm-extracts"

mkdir -p "$OUTPUT_DIR"

echo "🗺️  OSM Data Extraction Script"
echo ""

# Check for osmium
if ! command -v osmium &> /dev/null; then
    echo "❌ osmium not found. Install with: brew install osmium-tool"
    exit 1
fi

# Check for spain.pbf
if [ ! -f "$PBF_DIR/spain.pbf" ]; then
    echo "❌ spain.pbf not found at $PBF_DIR/spain.pbf"
    exit 1
fi

echo "📦 Source: $PBF_DIR/spain.pbf"
echo "📂 Output: $OUTPUT_DIR"
echo ""

# 1. Extract neighborhood boundaries (admin_level=10)
echo "🏘️  Extracting neighborhood boundaries (admin_level=10)..."
osmium tags-filter "$PBF_DIR/spain.pbf" \
    r/boundary=administrative \
    r/admin_level=10 \
    -o "$OUTPUT_DIR/barrios.pbf" --overwrite

echo "   Converting to GeoJSON..."
osmium export "$OUTPUT_DIR/barrios.pbf" \
    -o "$OUTPUT_DIR/barrios.geojson" --overwrite

# Count features
BARRIO_COUNT=$(grep -c '"type":"Feature"' "$OUTPUT_DIR/barrios.geojson" || echo "0")
echo "   ✅ Extracted $BARRIO_COUNT barrio boundaries"
echo ""

# 2. Extract parks and green spaces
echo "🌳 Extracting parks and green spaces..."
osmium tags-filter "$PBF_DIR/spain.pbf" \
    nw/leisure=park \
    nw/landuse=recreation_ground \
    nw/leisure=garden \
    nw/leisure=nature_reserve \
    -o "$OUTPUT_DIR/parks.pbf" --overwrite

osmium export "$OUTPUT_DIR/parks.pbf" \
    -o "$OUTPUT_DIR/parks.geojson" --overwrite

PARK_COUNT=$(grep -c '"type":"Feature"' "$OUTPUT_DIR/parks.geojson" || echo "0")
echo "   ✅ Extracted $PARK_COUNT parks"
echo ""

# 3. Extract metro/subway stations
echo "🚇 Extracting metro stations..."
osmium tags-filter "$PBF_DIR/spain.pbf" \
    n/railway=station \
    n/station=subway \
    n/railway=subway_entrance \
    -o "$OUTPUT_DIR/metro.pbf" --overwrite

osmium export "$OUTPUT_DIR/metro.pbf" \
    -o "$OUTPUT_DIR/metro.geojson" --overwrite

METRO_COUNT=$(grep -c '"type":"Feature"' "$OUTPUT_DIR/metro.geojson" || echo "0")
echo "   ✅ Extracted $METRO_COUNT metro stations/entrances"
echo ""

# 4. Extract beaches
echo "🏖️  Extracting beaches..."
osmium tags-filter "$PBF_DIR/spain.pbf" \
    nw/natural=beach \
    -o "$OUTPUT_DIR/beaches.pbf" --overwrite

osmium export "$OUTPUT_DIR/beaches.pbf" \
    -o "$OUTPUT_DIR/beaches.geojson" --overwrite

BEACH_COUNT=$(grep -c '"type":"Feature"' "$OUTPUT_DIR/beaches.geojson" || echo "0")
echo "   ✅ Extracted $BEACH_COUNT beaches"
echo ""

# 5. Extract schools
echo "🏫 Extracting schools..."
osmium tags-filter "$PBF_DIR/spain.pbf" \
    nw/amenity=school \
    nw/amenity=university \
    nw/amenity=college \
    -o "$OUTPUT_DIR/schools.pbf" --overwrite

osmium export "$OUTPUT_DIR/schools.pbf" \
    -o "$OUTPUT_DIR/schools.geojson" --overwrite

SCHOOL_COUNT=$(grep -c '"type":"Feature"' "$OUTPUT_DIR/schools.geojson" || echo "0")
echo "   ✅ Extracted $SCHOOL_COUNT schools"
echo ""

# 6. Extract supermarkets
echo "🛒 Extracting supermarkets..."
osmium tags-filter "$PBF_DIR/spain.pbf" \
    nw/shop=supermarket \
    -o "$OUTPUT_DIR/supermarkets.pbf" --overwrite

osmium export "$OUTPUT_DIR/supermarkets.pbf" \
    -o "$OUTPUT_DIR/supermarkets.geojson" --overwrite

SUPER_COUNT=$(grep -c '"type":"Feature"' "$OUTPUT_DIR/supermarkets.geojson" || echo "0")
echo "   ✅ Extracted $SUPER_COUNT supermarkets"
echo ""

# 7. Extract hospitals/clinics
echo "🏥 Extracting healthcare facilities..."
osmium tags-filter "$PBF_DIR/spain.pbf" \
    nw/ \
    nw/amenity=clinic \
    nw/amenity=doctors \
    -o "$OUTPUT_DIR/healthcare.pbf" --overwrite

osmium export "$OUTPUT_DIR/healthcare.pbf" \
    -o "$OUTPUT_DIR/healthcare.geojson" --overwrite

HEALTH_COUNT=$(grep -c '"type":"Feature"' "$OUTPUT_DIR/healthcare.geojson" || echo "0")
echo "   ✅ Extracted $HEALTH_COUNT healthcare facilities"
echo ""

# 8. Extract cafes
echo "☕ Extracting cafes..."
osmium tags-filter "$PBF_DIR/spain.pbf" \
    nw/amenity=cafe \
    -o "$OUTPUT_DIR/cafes.pbf" --overwrite

osmium export "$OUTPUT_DIR/cafes.pbf" \
    -o "$OUTPUT_DIR/cafes.geojson" --overwrite

CAFE_COUNT=$(grep -c '"type":"Feature"' "$OUTPUT_DIR/cafes.geojson" || echo "0")
echo "   ✅ Extracted $CAFE_COUNT cafes"
echo ""

# 9. Extract bakeries
echo "🥐 Extracting bakeries..."
osmium tags-filter "$PBF_DIR/spain.pbf" \
    nw/shop=bakery \
    nw/shop=pastry \
    -o "$OUTPUT_DIR/bakeries.pbf" --overwrite

osmium export "$OUTPUT_DIR/bakeries.pbf" \
    -o "$OUTPUT_DIR/bakeries.geojson" --overwrite

BAKERY_COUNT=$(grep -c '"type":"Feature"' "$OUTPUT_DIR/bakeries.geojson" || echo "0")
echo "   ✅ Extracted $BAKERY_COUNT bakeries"
echo ""

# 10. Extract restaurants
echo "🍽️  Extracting restaurants..."
osmium tags-filter "$PBF_DIR/spain.pbf" \
    nw/amenity=restaurant \
    -o "$OUTPUT_DIR/restaurants.pbf" --overwrite

osmium export "$OUTPUT_DIR/restaurants.pbf" \
    -o "$OUTPUT_DIR/restaurants.geojson" --overwrite

RESTAURANT_COUNT=$(grep -c '"type":"Feature"' "$OUTPUT_DIR/restaurants.geojson" || echo "0")
echo "   ✅ Extracted $RESTAURANT_COUNT restaurants"
echo ""

# 11. Extract bars
echo "🍺 Extracting bars..."
osmium tags-filter "$PBF_DIR/spain.pbf" \
    nw/amenity=bar \
    nw/amenity=pub \
    -o "$OUTPUT_DIR/bars.pbf" --overwrite

osmium export "$OUTPUT_DIR/bars.pbf" \
    -o "$OUTPUT_DIR/bars.geojson" --overwrite

BAR_COUNT=$(grep -c '"type":"Feature"' "$OUTPUT_DIR/bars.geojson" || echo "0")
echo "   ✅ Extracted $BAR_COUNT bars"
echo ""

# 12. Extract gyms/fitness
echo "💪 Extracting gyms..."
osmium tags-filter "$PBF_DIR/spain.pbf" \
    nw/leisure=fitness_centre \
    nw/leisure=sports_centre \
    -o "$OUTPUT_DIR/gyms.pbf" --overwrite

osmium export "$OUTPUT_DIR/gyms.pbf" \
    -o "$OUTPUT_DIR/gyms.geojson" --overwrite

GYM_COUNT=$(grep -c '"type":"Feature"' "$OUTPUT_DIR/gyms.geojson" || echo "0")
echo "   ✅ Extracted $GYM_COUNT gyms"
echo ""

# 13. Extract pharmacies
echo "💊 Extracting pharmacies..."
osmium tags-filter "$PBF_DIR/spain.pbf" \
    nw/amenity=pharmacy \
    -o "$OUTPUT_DIR/pharmacies.pbf" --overwrite

osmium export "$OUTPUT_DIR/pharmacies.pbf" \
    -o "$OUTPUT_DIR/pharmacies.geojson" --overwrite

PHARMACY_COUNT=$(grep -c '"type":"Feature"' "$OUTPUT_DIR/pharmacies.geojson" || echo "0")
echo "   ✅ Extracted $PHARMACY_COUNT pharmacies"
echo ""

# 14. Extract playgrounds
echo "🛝 Extracting playgrounds..."
osmium tags-filter "$PBF_DIR/spain.pbf" \
    nw/leisure=playground \
    -o "$OUTPUT_DIR/playgrounds.pbf" --overwrite

osmium export "$OUTPUT_DIR/playgrounds.pbf" \
    -o "$OUTPUT_DIR/playgrounds.geojson" --overwrite

PLAYGROUND_COUNT=$(grep -c '"type":"Feature"' "$OUTPUT_DIR/playgrounds.geojson" || echo "0")
echo "   ✅ Extracted $PLAYGROUND_COUNT playgrounds"
echo ""

# 15. Extract dog parks
echo "🐕 Extracting dog parks..."
osmium tags-filter "$PBF_DIR/spain.pbf" \
    nw/leisure=dog_park \
    -o "$OUTPUT_DIR/dog_parks.pbf" --overwrite

osmium export "$OUTPUT_DIR/dog_parks.pbf" \
    -o "$OUTPUT_DIR/dog_parks.geojson" --overwrite

DOG_PARK_COUNT=$(grep -c '"type":"Feature"' "$OUTPUT_DIR/dog_parks.geojson" || echo "0")
echo "   ✅ Extracted $DOG_PARK_COUNT dog parks"
echo ""

# 16. Extract tennis courts
echo "🎾 Extracting tennis courts..."
osmium tags-filter "$PBF_DIR/spain.pbf" \
    nw/leisure=pitch \
    -o "$OUTPUT_DIR/sports_pitches.pbf" --overwrite

# Filter for tennis specifically in post-processing
osmium export "$OUTPUT_DIR/sports_pitches.pbf" \
    -o "$OUTPUT_DIR/sports_pitches.geojson" --overwrite

PITCH_COUNT=$(grep -c '"type":"Feature"' "$OUTPUT_DIR/sports_pitches.geojson" || echo "0")
echo "   ✅ Extracted $PITCH_COUNT sports pitches (filter for tennis in import)"
echo ""

# Summary
echo "═══════════════════════════════════════"
echo "📊 Extraction Summary"
echo "═══════════════════════════════════════"
echo "   INFRASTRUCTURE (stable):"
echo "   ├─ Barrios:      $BARRIO_COUNT"
echo "   ├─ Parks:        $PARK_COUNT"
echo "   ├─ Metro:        $METRO_COUNT"
echo "   ├─ Beaches:      $BEACH_COUNT"
echo "   ├─ Schools:      $SCHOOL_COUNT"
echo "   ├─ Healthcare:   $HEALTH_COUNT"
echo "   ├─ Playgrounds:  $PLAYGROUND_COUNT"
echo "   ├─ Dog Parks:    $DOG_PARK_COUNT"
echo "   └─ Sports:       $PITCH_COUNT"
echo ""
echo "   BUSINESSES (use for density):"
echo "   ├─ Supermarkets: $SUPER_COUNT"
echo "   ├─ Cafes:        $CAFE_COUNT"
echo "   ├─ Bakeries:     $BAKERY_COUNT"
echo "   ├─ Restaurants:  $RESTAURANT_COUNT"
echo "   ├─ Bars:         $BAR_COUNT"
echo "   ├─ Gyms:         $GYM_COUNT"
echo "   └─ Pharmacies:   $PHARMACY_COUNT"
echo ""
echo "📁 Output files in: $OUTPUT_DIR"
ls -lh "$OUTPUT_DIR"/*.geojson 2>/dev/null || echo "   (no files yet)"
echo ""
echo "✅ Done! Run import scripts next:"
echo "   npx tsx scripts/geo/import-osm-pois.ts"
echo "   npx tsx scripts/geo/import-osm-barrios.ts"
