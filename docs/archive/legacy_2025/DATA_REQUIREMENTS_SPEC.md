# Data Requirements Specification for Property Listings

## Purpose
This document defines the **exact data fields required** from property listings to run the full pipeline (A-C text analysis, photo analysis, and beyond). This specification enables:
- Building **forms** for manual data entry
- Creating **scrapers** for new property websites
- Understanding **data dependencies** across pipeline steps
- Ensuring **data completeness** for all features

---

## Data Structure Overview

All scraped data is stored in the `listings` table with:
- **Direct columns**: `title`, `city`, `address`, `price_eur`, `source_url`
- **JSONB column** (`scraped_data`): All other structured data

---

## Required Fields by Pipeline Stage

### Stage A-C: Text Analysis (CRITICAL - Runs First)

These fields are **required immediately** after scraping to run text analysis.

#### A-Facts (Sentence-by-Sentence Fact Extraction)

**Endpoint**: `/api/listings/[id]/text-analysis/a-facts`

**Uses from `listings` table:**
- `title` (string) - Property title with location
- `price_eur` (number) - Price in euros

**Uses from `scraped_data` JSONB:**
```typescript
{
  description: string | null,              // Full property description text
  roomsAndAmenities: string | null,       // Format: "3 hab | 2 baños | terraza • balcón"
  additionalFeatures: string[] | [],      // Array of feature strings
  areas: {
    constructed: number | null,           // Constructed area in m²
    useful: number | null                  // Useful area in m²
  }
}
```

**Example `scraped_data` for A-Facts:**
```json
{
  "description": "Piso luminoso con vistas al mar, completamente reformado...",
  "roomsAndAmenities": "3 hab | 2 baños | terraza • balcón • ascensor",
  "additionalFeatures": ["Calefacción central", "Aire acondicionado", "Armarios empotrados"],
  "areas": {
    "constructed": 95,
    "useful": 78
  }
}
```

#### B1-B3: Categorization (No Direct Scraped Data)

**Endpoints**: 
- `/api/listings/[id]/text-analysis/b1-categorization`
- `/api/listings/[id]/text-analysis/b2-merge`
- `/api/listings/[id]/text-analysis/b3-snippets`

**Uses**: Claims from A-Facts results (stored in `text_analysis_results` table)
- **No direct scraped_data dependency** - works with extracted claims

#### C-Unknowns (Missing Information Detection)

**Endpoint**: `/api/listings/[id]/text-analysis/c-unknowns`

**Uses from `listings` table:**
- `title` (string)

**Uses from `scraped_data` JSONB:**
```typescript
{
  areas: {
    constructed: number | null,
    useful: number | null
  },
  bedrooms: number | null,                // Number of bedrooms
  bathrooms: number | null,                // Number of bathrooms
  additionalFeatures: string[] | []        // Used as "physicalFeatures"
}
```

**Also uses**: Claims from A-Facts and categories from B2-Merge (from `text_analysis_results`)

---

## Complete Scraped Data Schema

### Required Fields (Minimum for A-C)

```typescript
interface ScrapedDataMinimum {
  // Text content (for A-Facts)
  description: string | null;
  roomsAndAmenities: string | null;
  additionalFeatures: string[] | [];
  
  // Areas (for A-Facts and C-Unknowns)
  areas: {
    constructed: number | null;  // m²
    useful: number | null;        // m²
  };
  
  // Room counts (for C-Unknowns)
  bedrooms: number | null;
  bathrooms: number | null;
}
```

### Complete Schema (All Features)

```typescript
interface ScrapedDataComplete {
  // === TEXT ANALYSIS (A-C) ===
  description: string | null;
  roomsAndAmenities: string | null;
  additionalFeatures: string[] | [];
  areas: {
    constructed: number | null;
    useful: number | null;
  };
  bedrooms: number | null;
  bathrooms: number | null;
  
  // === LOCATION (For research queries, maps) ===
  lat: number | null;
  lng: number | null;
  
  // === AGENCY INFO (For display, attribution) ===
  agency: {
    name: string | null;
    original_logo_url: string | null;
    stored_logo_url: string | null;
    agent_id: string | null;
  } | null;
  
  // === FULL HTML (For debugging, re-scraping) ===
  htmlContent: string | null;  // Full HTML of property page
  
  // === OPTIONAL METADATA ===
  propertyType?: string;       // "piso", "casa", "ático", etc.
  yearBuilt?: number;
  floor?: number | null;
  orientation?: string | null;
  energyRating?: string | null;
  communityFee?: number | null;
}
```

---

## HTML Extraction Guide

### For Scraper Developers

When building a scraper for a new property website, extract these fields from the HTML:

#### 1. Title & Location
```html
<!-- Look for: -->
<h1 class="property-title">Piso en venta, Cádiz</h1>
<span class="location">Cádiz, Andalucía</span>

<!-- Extract: -->
title: "Piso en venta, Cádiz"
city: "Cádiz"
address: "Cádiz, Andalucía"
```

#### 2. Price
```html
<!-- Look for: -->
<span class="price">250.000 €</span>
<!-- Or: -->
<div data-price="250000">250.000 €</div>

<!-- Extract: -->
price: 250000  // Number, not string
```

#### 3. Description
```html
<!-- Look for: -->
<div class="description">
  <p>Piso luminoso con vistas al mar...</p>
</div>

<!-- Extract: -->
description: "Piso luminoso con vistas al mar..."  // Full text, all paragraphs
```

#### 4. Areas
```html
<!-- Look for: -->
<li>95 m² construidos</li>
<li>78 m² útiles</li>
<!-- Or: -->
<span>95 m²</span>
<span>78 m²</span>

<!-- Extract: -->
areas: {
  constructed: 95,
  useful: 78
}
```

#### 5. Bedrooms & Bathrooms
```html
<!-- Look for: -->
<li>3 habitaciones</li>
<li>2 baños</li>
<!-- Or: -->
<span>3 hab</span>
<span>2 baños</span>

<!-- Extract: -->
bedrooms: 3
bathrooms: 2
```

#### 6. Rooms & Amenities (Combined String)
```html
<!-- Look for: -->
<ul class="features">
  <li>3 habitaciones</li>
  <li>2 baños</li>
  <li>Terraza</li>
  <li>Balcón</li>
  <li>Ascensor</li>
</ul>

<!-- Extract: -->
roomsAndAmenities: "3 hab | 2 baños | terraza • balcón • ascensor"
// Format: "{bedrooms} hab | {bathrooms} baños | {amenity1} • {amenity2} • ..."
```

#### 7. Additional Features (Array)
```html
<!-- Look for: -->
<ul class="amenities">
  <li>Calefacción central</li>
  <li>Aire acondicionado</li>
  <li>Armarios empotrados</li>
  <li>Parquet</li>
</ul>

<!-- Extract: -->
additionalFeatures: [
  "Calefacción central",
  "Aire acondicionado",
  "Armarios empotrados",
  "Parquet"
]
// Exclude: bedrooms, bathrooms, areas (already extracted separately)
// Include: heating, cooling, flooring, storage, etc.
```

---

## Data Validation Checklist

Before running A-C text analysis, verify:

- [ ] `title` exists and is not empty
- [ ] `price_eur` is a valid number
- [ ] `scraped_data.description` exists (can be null, but preferred)
- [ ] `scraped_data.areas.constructed` OR `scraped_data.areas.useful` exists (at least one)
- [ ] `scraped_data.bedrooms` OR `scraped_data.bathrooms` exists (at least one)
- [ ] `scraped_data.roomsAndAmenities` OR (`bedrooms` + `bathrooms`) exists

**Minimum viable**: Title + Price + (Description OR Areas) + (Bedrooms OR Bathrooms)

---

## Form Builder Guide

### For Manual Data Entry Forms

If building a form for manual property entry, include these fields:

#### Required Section
1. **Title** (text input) - "Piso en venta, Cádiz"
2. **Price** (number input) - 250000
3. **City** (text input) - "Cádiz"
4. **Address** (text input) - "Calle Example, 123"

#### Property Details Section
5. **Description** (textarea) - Full property description
6. **Constructed Area** (number input, m²) - 95
7. **Useful Area** (number input, m²) - 78
8. **Bedrooms** (number input) - 3
9. **Bathrooms** (number input) - 2

#### Features Section
10. **Rooms & Amenities** (text input) - "3 hab | 2 baños | terraza • balcón"
11. **Additional Features** (multi-select or tags) - ["Calefacción", "Aire acondicionado"]

#### Optional Section
12. **Latitude** (number input) - 36.5270
13. **Longitude** (number input) - -6.2886
14. **Property Type** (select) - "piso", "casa", "ático"
15. **Year Built** (number input) - 1995
16. **Floor** (number input) - 3
17. **Orientation** (select) - "Sur", "Este", etc.

---

## Pipeline Dependencies Map

```
SCRAPING
  ↓
scraped_data JSONB
  ↓
A-FACTS (uses: title, price_eur, description, roomsAndAmenities, additionalFeatures, areas)
  ↓
text_analysis_results (claims)
  ↓
B1-B3 (uses: claims from A-Facts)
  ↓
text_analysis_results (categorized claims, snippets)
  ↓
C-UNKNOWNS (uses: title, price_eur, areas, bedrooms, bathrooms, additionalFeatures + claims)
  ↓
text_analysis_results (unknowns)
  ↓
INTEGRATED DIAGNOSTIC (uses: all text analysis results)
  ↓
... rest of pipeline
```

---

## Future-Proofing Notes

### Extensibility
- **New fields**: Add to `scraped_data` JSONB (no migration needed)
- **New analysis steps**: Check this spec to see what data is available
- **New scrapers**: Follow HTML extraction guide above

### Data Quality
- **Null handling**: All fields can be `null` except `title` and `price_eur`
- **Fallbacks**: Pipeline handles missing data gracefully
- **Validation**: Run validation checklist before A-C steps

### Scraper Patterns
- **CSS selectors**: Use specific classes/IDs when available
- **Regex fallbacks**: Use regex for price, areas, rooms when selectors fail
- **Text parsing**: Parse structured text (e.g., "3 hab | 2 baños")
- **Full HTML storage**: Store `htmlContent` for debugging/re-scraping

---

## Example: Idealista Scraper Reference

See `/src/app/api/scrape/robust/route.ts` for a complete implementation:

**Key extraction patterns:**
- Title: `.main-info__title-main` + `.main-info__title-minor`
- Price: `.info-data-price` with regex fallback
- Areas: `.details-property_features` with regex for "m² construidos/útiles"
- Bedrooms/Bathrooms: Regex from features text
- Description: `.comment .adCommentsLanguage p`
- Features: `.details-property_features li` (filtered)

**Reference lines**: 425-597 in `route.ts`

---

## Testing Checklist

When adding a new scraper or form:

1. **Extract all required fields** (see "Required Fields by Pipeline Stage")
2. **Run A-Facts** - Should extract claims from description
3. **Run B1-B3** - Should categorize claims
4. **Run C-Unknowns** - Should identify missing info
5. **Verify data quality** - Check that claims are meaningful
6. **Test with minimal data** - Ensure pipeline handles nulls gracefully

---

## Related Documentation

- `docs/ULTIMATE_PIPELINE.md` - Full pipeline flow
- `docs/J_SPLIT_IMPLEMENTATION_PLAN.md` - J-General/J-Reno split
- `src/app/api/scrape/robust/route.ts` - Reference scraper implementation
- `src/lib/prompts/text-analysis.ts` - A-C prompt definitions

---

**Last Updated**: 2025-01-27
**Maintainer**: Pipeline Team
