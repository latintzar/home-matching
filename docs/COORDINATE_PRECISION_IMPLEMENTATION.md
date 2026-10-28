# Coordinate Precision Implementation

## Overview

All harvesters now implement coordinate precision detection and verification. This ensures we don't claim street-level accuracy when we only have city/neighborhood center coordinates.

## Precision Levels

| Level | Description | Example Signal |
|-------|-------------|----------------|
| `precise` | Street address level accuracy | `coords_match_0.15km_has_street` |
| `approximate` | Neighborhood level accuracy | `api_with_neighborhood` |
| `city_center` | Only city center coordinates | `near_madrid_center` |
| `unknown` | Cannot determine accuracy | `no_coordinates` |

## Shared Utility: `coordinate-precision.ts`

Location: `src/lib/harvest/coordinate-precision.ts`

### Key Functions

```typescript
// Forward geocode with full address details
geocodeAddress(address: string): Promise<GeocodingResult | null>

// Reverse geocode coordinates to address
reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null>

// MAIN FUNCTION: Verify embedded coords against address
verifyCoordinates(
  embeddedLat: number | null,
  embeddedLng: number | null,
  addressText: string,
  existingComponents?: Partial<AddressComponents>
): Promise<CoordinateVerification>

// Calculate distance between coordinates (km)
haversineDistance(lat1, lng1, lat2, lng2): number

// Check if address has street-level detail
hasStreetAddress(address: string): { hasStreet: boolean; signal: string }

// Extract address components from HTML
extractStreetAddressFromHtml(html: string): string | null
extractNeighborhoodFromHtml(html: string): string | null
```

### Distance Thresholds

- **< 0.5 km**: Coordinates match well → `precise` (if has street) or `approximate`
- **< 2 km**: Slight mismatch but acceptable → `approximate`
- **< 5 km**: Significant mismatch → use geocoded coords, `approximate`
- **> 5 km**: Large mismatch → embedded was city center, use geocoded

## Domain-by-Domain Implementation

### 1. Tecnocasa (`tc-harvest-delta.ts`)
- **Coords Source**: Embedded in Vue `:estate` prop
- **Quality**: HIGH - Has street address in JSON
- **Verification**: Local precision check (no Nominatim needed)
- **Precision Signal**: `embedded_with_street_*` or `embedded_neighborhood_level`

### 2. Lucas Fox (`lf-harvest-delta.ts`)
- **Coords Source**: Nominatim geocoding (no embedded coords)
- **Quality**: WAS LOW (city center), NOW FIXED
- **Verification**: Full `verifyCoordinates()` with street extraction
- **Key Fix**: Now extracts `streetAddress` from JSON-LD and HTML

### 3. donpiso (`dp-harvest-delta.ts`)
- **Coords Source**: JSON-LD `geo` property
- **Quality**: MEDIUM - Has coords but often no street
- **Verification**: Local precision check with street extraction
- **Precision Signal**: `jsonld_with_street_*` or `jsonld_neighborhood_level`

### 4. Century21 (`c21-harvest-delta.ts`)
- **Coords Source**: Google Maps "directions to" link
- **Quality**: WAS LOW (city center), NOW FIXED
- **Verification**: Full `verifyCoordinates()` comparing Maps coords vs geocoded
- **Key Fix**: Detects when Google Maps coords point to city center

### 5. RE/MAX (`remax-harvest-delta.ts`)
- **Coords Source**: Nominatim geocoding (no embedded coords)
- **Quality**: MEDIUM - Depends on address quality
- **Verification**: Full `verifyCoordinates()` with street extraction
- **Key Change**: Now extracts street address from HTML before geocoding

### 6. aProperties (`aproperties-harvest-delta.ts`)
- **Coords Source**: Nominatim geocoding (no embedded coords)
- **Quality**: MEDIUM - Depends on address quality
- **Verification**: Full `verifyCoordinates()` with street extraction
- **Key Change**: Now extracts street address from HTML before geocoding

### 7. Engel & Völkers (`ev-harvest-delta.ts`)
- **Coords Source**: API `displayLat`/`displayLng`
- **Quality**: APPROXIMATE - Luxury sites hide exact locations
- **Verification**: Local precision check (API coords are intentionally approximate)
- **Precision Signal**: `api_with_neighborhood` or `api_city_level_only`

## DynamoDB Schema Changes

All harvesters now store these fields in the `location` object:

```typescript
{
  location: {
    // Existing fields
    lat: number | null,
    lng: number | null,
    city: string | null,
    province: string | null,
    country: string,
    
    // NEW: Coordinate precision fields
    street_address: string | null,      // Specific street if found
    neighborhood: string | null,         // Neighborhood/barrio
    coordinate_precision: CoordinatePrecision,  // 'precise' | 'approximate' | 'city_center' | 'unknown'
    coordinate_precision_signal: string,         // Debug info about how precision was determined
  }
}
```

## Testing

### Check Precision Distribution

After running harvesters, check DynamoDB for precision stats:

```bash
# Count by precision level for a domain
aws dynamodb scan \
  --table-name leo-listings \
  --filter-expression "domain = :d" \
  --expression-attribute-values '{":d":{"S":"lucasfox.com"}}' \
  --projection-expression "coordinate_precision" \
  | jq '.Items | group_by(.coordinate_precision.S) | map({precision: .[0].coordinate_precision.S, count: length})'
```

### Expected Results

| Domain | Expected `precise` | Expected `approximate` | Expected `city_center` |
|--------|-------------------|----------------------|----------------------|
| tecnocasa.es | ~60% | ~35% | ~5% |
| lucasfox.com | ~10% | ~50% | ~40% |
| donpiso.com | ~20% | ~60% | ~20% |
| century21.es | ~15% | ~50% | ~35% |
| remax.es | ~10% | ~50% | ~40% |
| aproperties.es | ~10% | ~50% | ~40% |
| engelvoelkers.com | ~0% | ~70% | ~30% |

## UI Implications

When displaying listings on a map:

1. **`precise`**: Show marker at exact location
2. **`approximate`**: Show marker with radius indicator (~500m)
3. **`city_center`**: Show neighborhood/city area highlight instead of pin
4. **`unknown`**: Don't show on map, or show with "approximate location" warning

## Future Improvements

1. **Nominatim Caching**: Cache geocoding results in DynamoDB to reduce API calls
2. **Confidence Scores**: Add numeric confidence (0-100) in addition to precision level
3. **Address Standardization**: Normalize addresses before comparison
4. **Reverse Verification**: For listings with coords but no address, reverse geocode to fill in

---

**Last Updated**: December 2024
**Author**: Cursor Agent
