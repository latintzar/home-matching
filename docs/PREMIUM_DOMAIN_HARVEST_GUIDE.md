# Premium Domain Harvest Guide

> **Purpose**: Step-by-step agentic process for harvesting individual premium domains
> **Target**: Any AI agent (Opus 4.5, Haiku 3.5, etc.)
> **Last Updated**: December 6, 2025

---

## 🎯 When User Gives You a Domain

When the user provides:
- A domain name (e.g., "donpiso")
- HTML file(s) from a listing page (downloaded via Chrome "Save As")
- Associated `_files` folder with assets

**Your Goal**: Create a Lambda that harvests ALL listings with 100% coverage and verified count.

---

## 📋 The Agentic Process (Step-by-Step)

### Step 1: Analyze the HTML File

**Check for structured data (in order of preference):**

```bash
# 1. JSON-LD (best - structured data)
grep -o 'application/ld+json' file.html

# 2. Next.js SSR data (second best - complete data)
grep -o '__NEXT_DATA__' file.html

# 3. Embedded JSON in scripts
grep -o 'window\.__DATA\|window\.dataLayer' file.html
```

**Extract and examine the structured data:**

```bash
# For JSON-LD - extract and pretty print
grep -A 100 'application/ld+json' file.html | head -100
```

**Document what fields are available:**
- [ ] ID / Reference number
- [ ] Price
- [ ] Coordinates (lat/lng) - **critical!**
- [ ] Address components
- [ ] Bedrooms / Bathrooms
- [ ] Area (m²)
- [ ] Photos
- [ ] Description
- [ ] Amenities
- [ ] Agency contact

### Step 2: Check for Sitemap

```bash
# Check robots.txt for sitemap location
curl -s "https://www.DOMAIN.com/robots.txt" | grep -i sitemap

# Fetch sitemap and check structure
curl -s "https://www.DOMAIN.com/sitemap.xml" | head -100

# Count entries
curl -s "https://www.DOMAIN.com/sitemap.xml" | grep -c "<loc>"
```

**Determine sitemap type:**
- Individual listing URLs (best) → Direct scrape
- List page URLs (common) → Need to extract listings from each
- Sitemap index → Need to fetch child sitemaps

### Step 3: Find the Official Total Count

**This is CRITICAL for verification. Look for:**

```bash
# Check homepage for total count
curl -s "https://www.DOMAIN.com/" | grep -oE '[0-9,]+\s*(inmuebles|listings|properties|propiedades|resultados)'

# Check search/list pages for totals
curl -s "https://www.DOMAIN.com/venta" | grep -oE 'total[^>]*>[0-9,]+|"total":\s*[0-9]+'
```

**If no visible count:**
- Check JavaScript for data loading
- Look for pagination info ("Page 1 of 50")
- Check network requests for API calls

### Step 4: Determine the Harvest Strategy

| Scenario | Strategy |
|----------|----------|
| **Has API** | Direct API calls (fastest) |
| **Has SSR (`__NEXT_DATA__`)** | Parse embedded JSON from HTML |
| **Has JSON-LD on listing pages** | Fetch sitemap → scrape each page |
| **Has Vue/React props** | Extract embedded JSON from component attributes |
| **No structured data** | Cheerio/regex parsing + Nominatim geocoding |

### Step 5: Check for Coordinates

**Priority order for coordinates:**
1. JSON-LD `geo.latitude/longitude` (best)
2. SSR data with coordinates
3. Meta tags with geo info
4. Map embed URLs (Google Maps, Mapbox)
5. Need Nominatim geocoding (slowest)

```bash
# Check if coords are in the page
grep -oE 'latitude|longitude|lat.*lng|geo.*coord' file.html
```

### Step 5b: Coordinate Precision Detection (CRITICAL)

**⚠️ WARNING**: Many real estate sites show CITY CENTER coordinates, not actual property location!

> **📖 Full Documentation**: See `docs/COORDINATE_PRECISION_IMPLEMENTATION.md` for complete details.

**You MUST detect coordinate precision:**
- `precise` - Has specific street address (e.g., "Calle Mayor 15")
- `approximate` - Has neighborhood but no street
- `city_center` - Only city/province, likely centroid coordinates
- `unknown` - Cannot determine

**Import and use the coordinate precision utility:**
```typescript
import { 
  verifyCoordinates,  // PREFERRED: Full verification with Nominatim
  analyzeCoordinates,  // Simple: No Nominatim, just pattern matching
  extractStreetAddressFromHtml, 
  extractNeighborhoodFromHtml,
  type CoordinatePrecision,
  type AddressComponents
} from '../lib/harvest/coordinate-precision';

// OPTION 1: Full verification (for domains without embedded coords or suspicious coords)
const verification = await verifyCoordinates(
  embeddedLat,  // null if no embedded coords
  embeddedLng,
  addressText,
  { streetAddress, neighborhood, city, province, country: 'Spain' }
);
// Returns: { finalLat, finalLng, precision, precisionSignal, address, usedSource }

// OPTION 2: Simple analysis (for domains with trusted embedded coords like Tecnocasa)
const street_address = extractStreetAddressFromHtml(html);
const neighborhood = extractNeighborhoodFromHtml(html);

const coordInfo = analyzeCoordinates(
  latitude, longitude, address,
  { streetAddress: street_address, neighborhood, city, province, country: 'Spain' }
);

// Store in listing:
coordinate_precision: coordInfo.precision,
coordinate_precision_signal: coordInfo.precisionSignal,
```

**Signs of city center coordinates (BAD):**
- Address is just "City, Province" without street
- Title mentions specific location but coords point to city center
- Multiple listings have identical coordinates
- Google Maps "directions to" link (often points to city center)

**Signs of precise coordinates (GOOD):**
- Address includes street name (Calle, Avenida, Plaza, etc.)
- Address includes street number
- Description mentions specific address
- Coordinates are embedded in property JSON data

### Step 6: Test the Extraction

Create a test script to verify extraction works:

```typescript
// scripts/{domain}-harvest-test.ts
async function main() {
  // 1. Fetch sitemap/list pages
  // 2. Extract 3-5 sample listing URLs
  // 3. Fetch and parse each
  // 4. Print extracted data
  // 5. Verify all required fields present
}
```

**Required fields for recommender:**
- `id` - Unique identifier
- `price` - Number in EUR
- `lat/lng` - Coordinates (or null if unavailable)
- `city/province` - Location text
- `bedrooms/bathrooms/area_m2` - Property details
- `photos` - Array of image URLs
- `amenities` - Array of features

### Step 7: Create the Lambda

**Naming convention**: `{initials}-harvest-delta.ts`
- `ev` = Engel & Völkers
- `lf` = Lucas Fox
- `dp` = donpiso
- `tc` = Tecnocasa
- `c21` = Century21

**Lambda structure:**
```
1. Fetch official count (for verification)
2. Discover all listing IDs (sitemap or list pages)
3. Fetch detail pages (with rate limiting)
   - Check HTTP status (404/410 → mark as removed)
   - Check for redirects (homepage → mark as removed)
4. Parse structured data
   - Detect sold/leased/reserved from HTML content
   - Detect furnished status from HTML content
5. Write to leo-listings DynamoDB table
   - Include status and status_signal fields
   - Update existing records if status changed
6. Save backup to S3
7. Report coverage vs official count
```

**Required imports:**
```typescript
import { 
  detectListingStatus, 
  detectFromHttpStatus, 
  isRemovedRedirect,
  type SaleStatus 
} from '../lib/harvest/listing-status-detection';
```

### Step 8: Update Documentation

After Lambda is working:
1. Add to `docs/HARVEST_DASHBOARD.md`
2. Add to `src/lambda/deploy-lambdas.sh`
3. Commit with accurate listing count

---

## 🔍 Case Studies

### Case 1: Engel & Völkers (SSR)

**Discovery:**
```bash
grep '__NEXT_DATA__' file.html  # Found!
```

**Data location:**
```
__NEXT_DATA__ → props.pageProps.searchModule.initialSearchResults.listings[]
```

**Key insight:** SSR includes `totalCount` in search results, giving exact number.

**Coordinates:** Embedded in SSR data as `latitude/longitude` ✅

**Strategy:**
1. Geo-segmented search URLs (barcelona, madrid, etc.)
2. Parse `__NEXT_DATA__` for listings + totalCount
3. Fetch detail pages for enrichment (amenities, full photos)

**Result:** 6,016 listings (exact count from SSR)

---

### Case 2: Lucas Fox (JSON-LD + Sitemap)

**Discovery:**
```bash
grep 'application/ld+json' file.html  # Found!
curl -s "https://www.lucasfox.com/sitemap.xml" | head -50  # Has listing URLs
```

**Data location:**
```
JSON-LD @type: "Product" or "RealEstateListing"
```

**Key insight:** Sitemap contains ALL listing URLs directly (no list page crawling needed).

**Coordinates:** NOT in JSON-LD ❌ → Need Nominatim geocoding

**Strategy:**
1. Fetch sitemap → get all listing URLs
2. Fetch each listing page
3. Parse JSON-LD for structured data
4. Geocode addresses via Nominatim

**Result:** ~2,000 listings (from sitemap count)

---

### Case 3: donpiso (JSON-LD + List Pages)

**Discovery:**
```bash
grep 'application/ld+json' file.html  # Found!
curl -s "https://www.donpiso.com/sitemap.xml" | grep listado | wc -l  # 1325 list pages
```

**Data location:**
```
JSON-LD @type: ["Product", "SingleFamilyResidence"]
```

**Key insight:** Sitemap has list page URLs, not individual listings. Must crawl all list pages.

**Coordinates:** In JSON-LD as `geo.latitude/longitude` ✅

**Official count:** Homepage shows "2803 inmuebles"

**Strategy:**
1. Fetch official count from homepage
2. Crawl ALL 1,325 list pages
3. Extract unique listing IDs
4. Fetch detail pages
5. Parse JSON-LD
6. Verify coverage vs official count

**Result:** 2,803 listings (verified against homepage)

---

### Case 4: Tecnocasa (Embedded Vue JSON)

**Discovery:**
```bash
grep ':estate=' file.html  # Found Vue prop with complete JSON!
```

**Data location:**
```
Vue component prop :estate="{...}" contains COMPLETE listing data
```

**Key insight:** Uses Vue.js SSR - data embedded as component prop, not in separate JSON-LD.

**Coordinates:** In embedded JSON as `latitude/longitude` ✅

**Strategy:**
1. Fetch sitemap → get all listing URLs
2. Fetch each listing page
3. Extract `:estate="{...}"` attribute
4. Parse embedded JSON
5. Best data quality found!

**Result:** 7,355 listings with complete data

---

### Case 5: Century21 (HTML Parsing + Nominatim)

**Discovery:**
```bash
grep 'application/ld+json' live_page.html  # 0 results - JSON-LD only renders client-side
grep 'tagline-1' live_page.html  # Found price element
grep 'tagline-2' live_page.html  # Found specs elements (beds, baths, area)
```

**Data location:**
```
HTML elements:
- Price: .tagline-1 class
- Specs: .tagline-2 class (3 elements: beds, baths, area)
- Photos: regex for images.century21.pt URLs
- Address: og:image URL parameters
```

**Key insight:** Uses Next.js App Router with React Server Components. JSON-LD exists in client-rendered HTML (Chrome "Save As") but NOT in initial server response. Must parse HTML elements directly.

**Coordinates:** NOT available in HTML ❌ → Need Nominatim geocoding from address

**Official count:** Sitemap at `https://century21.es/ref/sitemap/0.xml` contains 23,056 URLs

**Strategy:**
1. Fetch sitemap → get all listing URLs (23,056)
2. Fetch each listing page
3. Parse HTML elements with Cheerio
4. Extract address from og:image URL parameters
5. Geocode via Nominatim
6. Rate limit for large volume

**Result:** 23,056 listings (from sitemap)

---

## 🔄 Status Detection Requirements (MANDATORY)

Every harvester MUST implement comprehensive status detection using the shared utility:

```typescript
import { 
  detectListingStatus,      // HTML content analysis
  detectFromHttpStatus,     // HTTP 404/410 detection
  isRemovedRedirect,        // Redirect to homepage/error detection
  type SaleStatus 
} from '../lib/harvest/listing-status-detection';
```

### 1. HTTP Status Detection (404/410)

When fetching any listing page, check for removal:

```typescript
interface FetchResult {
  html: string | null;
  removed?: { status: SaleStatus; signal: string };
}

async function fetchPage(url: string): Promise<FetchResult> {
  const response = await fetch(url, {...});
  
  // CHECK 1: HTTP status code
  const httpStatus = detectFromHttpStatus(response.status, true);
  if (httpStatus) {
    return { html: null, removed: httpStatus };
  }
  
  // CHECK 2: Redirects to homepage/error
  const redirectStatus = isRemovedRedirect(response.url, url);
  if (redirectStatus) {
    return { html: null, removed: redirectStatus };
  }
  
  return { html: await response.text() };
}
```

### 2. HTML Content Status Detection

When parsing HTML, detect sold/leased/reserved:

```typescript
const statusDetection = detectListingStatus(html);
// Returns: { saleStatus: 'active'|'sold'|'leased'|'reserved'|'removed', 
//            statusSignal: 'html_vendido'|'html_property_sold'|etc,
//            isFurnished: boolean|null,
//            furnishedSignal: string|null }
```

### 3. Update Removed Listings in DynamoDB

When a 404 or redirect is detected, update the existing record:

```typescript
if (removed) {
  await dynamoClient.send(new UpdateCommand({
    TableName: LISTINGS_TABLE,
    Key: { domain: DOMAIN, listing_id: id },
    UpdateExpression: 'SET #status = :status, status_signal = :signal, last_seen = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': removed.status,
      ':signal': removed.signal,
      ':now': new Date().toISOString(),
    },
  }));
}
```

### 4. Status Priority (when writing to DynamoDB)

```typescript
// Priority: HTML-detected > HTTP-detected > Sitemap tracking
status: listing.saleStatus !== 'active' 
  ? listing.saleStatus           // 'sold', 'leased', 'reserved' from HTML
  : removed?.status              // 'removed' from 404/redirect
  ?? tracking.status             // 'removed' from sitemap disappearance
  ?? 'active'
```

### 5. Required Status Signals

| Signal | Detection Method |
|--------|-----------------|
| `http_404_previously_known` | HTTP 404 response |
| `http_410_gone` | HTTP 410 response |
| `redirect_to_homepage` | Redirected to site root |
| `redirect_to_removed_page` | Redirected to /404, /not-found |
| `html_vendido` / `html_property_sold` | Found in HTML content |
| `html_alquilado` / `html_property_leased` | Found in HTML content |
| `not_in_sitemap` | Disappeared from sitemap |
| `in_sitemap` | Active, present in sitemap |

---

## 🌐 HTML vs JavaScript Rendering

### ALWAYS Prefer HTML/SSR Parsing

**Rule**: Extract data from HTML/SSR responses whenever possible. JavaScript rendering (ScrapFly ASP, Puppeteer) should be a **last resort**.

### Why HTML is Better:
- ⚡ **Faster** - No JS execution overhead
- 💰 **Cheaper** - ScrapFly basic vs ASP credits
- 🔒 **More reliable** - No race conditions waiting for JS
- 📊 **Simpler** - Cheerio/regex vs headless browser

### Check Data Availability (in order):

```bash
# 1. JSON-LD (server-rendered, always available)
grep -o 'application/ld+json' response.html

# 2. SSR data (__NEXT_DATA__, window.__DATA__)
grep -o '__NEXT_DATA__\|window\.__DATA' response.html

# 3. Vue/React props (embedded JSON)
grep -o ':estate="\|data-props=' response.html

# 4. Meta tags / og: tags
grep -o 'og:latitude\|geo.position' response.html

# 5. HTML elements (Cheerio parsing)
# .price, .specs, .address classes etc.
```

### When JavaScript IS Required

Document clearly when JS rendering is needed:

| Scenario | Solution | Cost |
|----------|----------|------|
| **Infinite scroll** | ScrapFly ASP or Puppeteer | High |
| **Client-side routing (SPA)** | ScrapFly ASP | High |
| **Data loaded via XHR after page load** | Direct API calls (if discoverable) | Low |
| **Anti-bot JS challenges** | ScrapFly ASP | High |

### Lambda Header Comment

Every harvester MUST document its rendering requirements:

```typescript
/**
 * {Domain} Harvest Lambda
 * 
 * DATA EXTRACTION METHOD:
 * - [ ] JSON-LD (server-rendered)
 * - [ ] SSR (__NEXT_DATA__)
 * - [ ] HTML parsing (Cheerio)
 * - [ ] Requires JS rendering: NO / YES (reason: _______)
 * 
 * If JS required, specify:
 * - ScrapFly ASP mode: yes/no
 * - Puppeteer: yes/no
 * - Reason: (e.g., "data loaded via XHR 2s after page load")
 */
```

### Example: E&V (SSR - NO JS needed)

```typescript
/**
 * Engel & Völkers Harvest Lambda
 * 
 * DATA EXTRACTION METHOD:
 * - [x] SSR (__NEXT_DATA__) - complete listing data
 * - [ ] Requires JS rendering: NO
 * 
 * Note: Despite being a Next.js app, ALL data is in __NEXT_DATA__
 * on initial server response. No client-side hydration needed.
 */
```

### Example: If JS WAS Required

```typescript
/**
 * Example Domain Harvest Lambda
 * 
 * DATA EXTRACTION METHOD:
 * - [ ] JSON-LD: Not present in SSR
 * - [ ] SSR: Empty __NEXT_DATA__
 * - [x] Requires JS rendering: YES
 * 
 * REASON: Listing data loaded via GraphQL 3s after page load.
 * Attempted alternatives:
 * 1. Direct GraphQL API - requires auth token
 * 2. SSR response - only contains shell HTML
 * 
 * SOLUTION: ScrapFly with ASP (render_js=true, wait=5000)
 * COST IMPACT: ~10x higher ScrapFly credits
 */
```

---

## ✅ Quality Checklist

Before marking a domain complete:

### Core Requirements
- [ ] **Exact count obtained** (not estimated)
- [ ] **100% coverage verified** (discovered ≥ official)
- [ ] **Coordinates available** (JSON-LD or Nominatim)
- [ ] **All required fields extracted**

### Status Detection (MANDATORY)
- [ ] **HTTP 404/410 detection** implemented
- [ ] **Redirect detection** (homepage, error pages)
- [ ] **HTML status detection** (sold/leased/reserved patterns)
- [ ] **Furnished status detection** (amueblado/furnished patterns)
- [ ] **Uses shared utility** (`listing-status-detection.ts`)

### Rendering Method (MANDATORY)
- [ ] **HTML/SSR extraction attempted first**
- [ ] **JS requirement documented** (if needed, with reason)
- [ ] **Lambda header comment** includes data extraction method

### Deployment
- [ ] **Test script works locally**
- [ ] **Lambda deployed and scheduled**
- [ ] **Documentation updated**

---

## 🚫 Common Pitfalls

### Data Extraction
1. **Estimating instead of counting** - Always find the official total
2. **Missing pagination** - Some sites need infinite scroll handling
3. **Rate limiting** - Add delays (200-500ms between requests)
4. **Coordinates assumption** - Check if lat/lng actually exists
5. **Stale sitemaps** - Some sitemaps don't include new listings immediately

### Status Detection
6. **Ignoring 404s** - Don't just skip, mark as `removed` in DB
7. **Missing sold/leased detection** - Always scan HTML for status indicators
8. **Not using shared utility** - Use `listing-status-detection.ts` for consistency
9. **Forgetting redirects** - Sites often redirect removed listings to homepage

### Rendering Method
10. **Jumping to JS rendering** - Always try HTML/SSR extraction first
11. **Not documenting JS requirement** - If JS is needed, explain WHY
12. **Assuming JSON-LD is client-rendered** - Many Next.js sites include it in SSR

---

## 📁 File Locations

| Purpose | Path |
|---------|------|
| Lambda files | `src/lambda/{domain}-harvest-delta.ts` |
| Test scripts | `scripts/{domain}-harvest-test.ts` |
| Deploy script | `src/lambda/deploy-lambdas.sh` |
| Dashboard | `docs/HARVEST_DASHBOARD.md` |
| This guide | `docs/PREMIUM_DOMAIN_HARVEST_GUIDE.md` |

---

## 🤖 For Cursor Auto (Haiku 3.5)

When processing a new domain:

1. **Read the HTML file** provided by user
2. **Search for structured data patterns** (JSON-LD, __NEXT_DATA__)
3. **Check sitemap** via curl commands
4. **Find official count** from homepage/search
5. **Verify HTML extraction works** (avoid JS rendering if possible)
6. **Create test script** to verify extraction
7. **Create Lambda** with status detection
8. **Update documentation** with exact numbers

**Always verify:**
- The exact listing count (not an estimate)
- Whether coordinates are available
- The complete field mapping
- **Data is available in HTML/SSR** (not just client-rendered)
- **Status detection patterns work** (sold/leased/reserved keywords)

**MANDATORY for every Lambda:**
- Import and use `listing-status-detection.ts` utility
- Implement 404/redirect detection
- Implement HTML-based sold/leased/reserved detection
- Document rendering method in Lambda header comment

**Template prompt for new domain:**
```
Analyze {domain} for harvest:
1. What structured data format? (JSON-LD, SSR, none)
2. Is data in HTML/SSR or requires JS rendering?
3. What's the official listing count?
4. Are coordinates in the data?
5. What's the sitemap structure?
6. What sold/leased status indicators exist in HTML?
7. Create Lambda following docs/PREMIUM_DOMAIN_HARVEST_GUIDE.md
   - Use listing-status-detection.ts utility
   - Implement 404/redirect detection
   - Document if JS rendering is required (and why)
```



## 🤖 For Cursor Auto (Haiku 3.5)

When processing a new domain:

1. **Read the HTML file** provided by user
2. **Search for structured data patterns** (JSON-LD, __NEXT_DATA__)
3. **Check sitemap** via curl commands
4. **Find official count** from homepage/search
5. **Verify HTML extraction works** (avoid JS rendering if possible)
6. **Create test script** to verify extraction
7. **Create Lambda** with status detection
8. **Update documentation** with exact numbers

**Always verify:**
- The exact listing count (not an estimate)
- Whether coordinates are available
- The complete field mapping
- **Data is available in HTML/SSR** (not just client-rendered)
- **Status detection patterns work** (sold/leased/reserved keywords)

**MANDATORY for every Lambda:**
- Import and use `listing-status-detection.ts` utility
- Implement 404/redirect detection
- Implement HTML-based sold/leased/reserved detection
- Document rendering method in Lambda header comment

**Template prompt for new domain:**
```
Analyze {domain} for harvest:
1. What structured data format? (JSON-LD, SSR, none)
2. Is data in HTML/SSR or requires JS rendering?
3. What's the official listing count?
4. Are coordinates in the data?
5. What's the sitemap structure?
6. What sold/leased status indicators exist in HTML?
7. Create Lambda following docs/PREMIUM_DOMAIN_HARVEST_GUIDE.md
   - Use listing-status-detection.ts utility
   - Implement 404/redirect detection
   - Document if JS rendering is required (and why)
```

