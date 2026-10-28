# Listing Status Detection Spec

## Overview

Detect when listings are sold, rented, or removed to:
1. Track market velocity (days on market)
2. Train recommender (fast-selling = desirable)
3. Alert users ("Properties like this sell fast!")
4. Preserve pricing intel (last price before sold)

---

## Status Taxonomy

| Status | Meaning | Detection Method |
|--------|---------|------------------|
| `active` | Currently listed | Default state |
| `sold` | Confirmed sold | Page text, badge |
| `rented` | Confirmed rented | Page text, badge |
| `reserved` | Under contract | Page text, badge |
| `removed` | Taken down (unknown reason) | 404, soft 404 |
| `expired` | Listing expired | Page text |
| `likely_sold` | Probably sold (inference) | Price removed, ghost |

---

## Detection Patterns

### 1. HTTP Status Detection

```typescript
// In Lambda: detect-listing-status

async function checkHttpStatus(url: string): Promise<StatusResult> {
  const response = await fetch(url, { 
    redirect: 'manual',  // Don't follow redirects automatically
    timeout: 10000 
  });
  
  // Hard 404
  if (response.status === 404) {
    return { status: 'removed', signal: '404' };
  }
  
  // Redirect to homepage/search = soft 404
  if (response.status === 301 || response.status === 302) {
    const location = response.headers.get('location') || '';
    if (isHomepageOrSearch(location)) {
      return { status: 'removed', signal: 'soft_404_redirect' };
    }
  }
  
  // 200 - need to parse content
  if (response.status === 200) {
    return { status: 'check_content', html: await response.text() };
  }
  
  return { status: 'unknown', signal: `http_${response.status}` };
}

function isHomepageOrSearch(url: string): boolean {
  const patterns = [
    /\/$/, // Root path
    /\/buscar/i,
    /\/search/i,
    /\/resultados/i,
    /\/listings/i,
    /\/inmuebles$/i,
  ];
  return patterns.some(p => p.test(url));
}
```

### 2. Page Text Detection (Spanish)

```typescript
// Sold patterns
const SOLD_PATTERNS = [
  /\bvendido\b/i,
  /\bsold\b/i,
  /propiedad vendida/i,
  /inmueble vendido/i,
  /este piso se ha vendido/i,
  /ya ha sido vendido/i,
];

// Rented patterns  
const RENTED_PATTERNS = [
  /\balquilado\b/i,
  /\brented\b/i,
  /\barrendado\b/i,
  /ya está alquilado/i,
  /piso alquilado/i,
];

// Reserved patterns
const RESERVED_PATTERNS = [
  /\breservado\b/i,
  /\breserved\b/i,
  /en proceso de venta/i,
  /operación en curso/i,
  /señalizado/i,
];

// Generic removal patterns
const REMOVED_PATTERNS = [
  /no disponible/i,
  /ya no está disponible/i,
  /este anuncio ya no existe/i,
  /anuncio no encontrado/i,
  /propiedad no encontrada/i,
  /lo sentimos/i,
  /página no encontrada/i,
  /ha sido eliminado/i,
  /anuncio eliminado/i,
  /anuncio caducado/i,
  /error 404/i,
];

// Expired patterns
const EXPIRED_PATTERNS = [
  /anuncio expirado/i,
  /caducado/i,
  /expired/i,
  /listing expired/i,
];

function detectFromText(html: string): StatusResult | null {
  const text = extractVisibleText(html);
  
  // Check in priority order
  if (SOLD_PATTERNS.some(p => p.test(text))) {
    return { status: 'sold', signal: 'page_text' };
  }
  if (RENTED_PATTERNS.some(p => p.test(text))) {
    return { status: 'rented', signal: 'page_text' };
  }
  if (RESERVED_PATTERNS.some(p => p.test(text))) {
    return { status: 'reserved', signal: 'page_text' };
  }
  if (EXPIRED_PATTERNS.some(p => p.test(text))) {
    return { status: 'expired', signal: 'page_text' };
  }
  if (REMOVED_PATTERNS.some(p => p.test(text))) {
    return { status: 'removed', signal: 'soft_404_content' };
  }
  
  return null; // Still active
}
```

### 3. CSS Badge/Status Detection

```typescript
// Common CSS selectors for status badges
const STATUS_SELECTORS = {
  sold: [
    '.estado-vendido',
    '.badge-sold',
    '.sold-badge',
    '.ribbon-sold',
    '.vendido',
    '[data-status="sold"]',
    '[data-estado="vendido"]',
    '.property-sold',
    '.inmueble-vendido',
  ],
  rented: [
    '.estado-alquilado',
    '.badge-rented',
    '.alquilado',
    '[data-status="rented"]',
    '[data-estado="alquilado"]',
    '.property-rented',
  ],
  reserved: [
    '.estado-reservado',
    '.badge-reserved',
    '.reservado',
    '[data-status="reserved"]',
    '[data-estado="reservado"]',
  ],
};

function detectFromBadge($: cheerio.Root): StatusResult | null {
  for (const [status, selectors] of Object.entries(STATUS_SELECTORS)) {
    for (const selector of selectors) {
      if ($(selector).length > 0) {
        return { status: status as ListingStatus, signal: 'badge' };
      }
    }
  }
  return null;
}
```

### 4. Price Removal Detection

```typescript
interface PriceCheck {
  previousPrice: number | null;
  currentPrice: number | null;
}

function detectFromPriceChange(check: PriceCheck): StatusResult | null {
  // Had price before, now missing or "Consultar"
  if (check.previousPrice && !check.currentPrice) {
    return { status: 'likely_sold', signal: 'price_removed' };
  }
  
  // Dramatic price drop (>50%) could indicate error or sold/relisted
  if (check.previousPrice && check.currentPrice) {
    const drop = (check.previousPrice - check.currentPrice) / check.previousPrice;
    if (drop > 0.5) {
      return { status: 'active', signal: 'price_drop_warning' };
    }
  }
  
  return null;
}
```

### 5. Ghost Detection (Already Planned)

```typescript
// If not seen in sitemap/crawl for 3+ days
function detectGhost(lastSeen: Date): StatusResult | null {
  const daysSinceLastSeen = daysBetween(lastSeen, new Date());
  
  if (daysSinceLastSeen >= 3) {
    return { status: 'removed', signal: 'ghost' };
  }
  
  return null;
}
```

---

## Combined Detection Pipeline

```typescript
async function detectListingStatus(
  url: string,
  previousData: { price?: number; lastSeen?: Date }
): Promise<ListingStatusUpdate> {
  
  // Step 1: HTTP check
  const httpResult = await checkHttpStatus(url);
  if (httpResult.status !== 'check_content') {
    return finalize(httpResult);
  }
  
  const html = httpResult.html!;
  const $ = cheerio.load(html);
  
  // Step 2: Badge check (most reliable)
  const badgeResult = detectFromBadge($);
  if (badgeResult) {
    return finalize(badgeResult);
  }
  
  // Step 3: Text check
  const textResult = detectFromText(html);
  if (textResult) {
    return finalize(textResult);
  }
  
  // Step 4: Price check
  const currentPrice = extractPrice($);
  const priceResult = detectFromPriceChange({
    previousPrice: previousData.price,
    currentPrice,
  });
  if (priceResult) {
    return finalize(priceResult);
  }
  
  // Step 5: Ghost check
  if (previousData.lastSeen) {
    const ghostResult = detectGhost(previousData.lastSeen);
    if (ghostResult) {
      return finalize(ghostResult);
    }
  }
  
  // Still active
  return {
    status: 'active',
    signal: null,
    detectedAt: new Date(),
  };
}

function finalize(result: StatusResult): ListingStatusUpdate {
  return {
    ...result,
    detectedAt: new Date(),
  };
}
```

---

## Database Schema

### DynamoDB: `listings` Table (Enhanced)

```javascript
{
  // ... existing fields ...
  
  // Status tracking
  "status": "active",                    // active|sold|rented|reserved|removed|expired|likely_sold
  "status_signal": null,                 // 404|soft_404|page_text|badge|price_removed|ghost
  "status_detected_at": null,            // When status changed
  
  // Market analytics
  "first_seen": "2025-10-15T03:00:00Z",  // When first crawled
  "last_seen": "2025-11-28T03:00:00Z",   // Last successful crawl
  "days_on_market": null,                // Calculated when status changes
  
  // Price history (for analytics)
  "last_known_price": 250000,            // Preserve before removal
  "price_history": [                     // Optional: track changes
    { "price": 260000, "date": "2025-10-15" },
    { "price": 250000, "date": "2025-11-01" }
  ]
}
```

### DynamoDB: `market_velocity` Table (New - Analytics)

```javascript
{
  "location": "Madrid/Salamanca",        // Partition key
  "property_type": "apartment",          // Sort key
  "period": "2025-11",                   // Month
  
  // Aggregated stats
  "avg_days_on_market": 34,
  "median_days_on_market": 28,
  "total_sold": 45,
  "total_rented": 12,
  "total_removed": 8,
  
  // Price stats
  "avg_sold_price": 285000,
  "median_sold_price": 275000,
  "price_per_sqm": 4200,
}
```

---

## Lambda: detect-listing-status

### Schedule
- **Daily at 5:00 AM** (after harvest)
- Check ~5,000 listings per run (sample or priority queue)

### Priority Queue
Check these more frequently:
1. Listings with viewing requests (user interested)
2. Listings in user watchlists
3. Listings matched to active user profiles
4. Recently added listings (< 30 days)

### Implementation

```typescript
// Lambda handler
export async function handler(event: any) {
  const startTime = Date.now();
  const MAX_DURATION_MS = 50000; // 50s (Lambda timeout is 60s)
  
  // Get listings to check (prioritized)
  const listings = await getListingsToCheck(5000);
  
  const results = {
    checked: 0,
    statusChanges: [] as StatusChange[],
    errors: [] as Error[],
  };
  
  for (const listing of listings) {
    // Time check
    if (Date.now() - startTime > MAX_DURATION_MS) {
      console.log('Time limit reached, stopping');
      break;
    }
    
    try {
      const update = await detectListingStatus(listing.url, {
        price: listing.price,
        lastSeen: listing.last_seen,
      });
      
      results.checked++;
      
      // Status changed?
      if (update.status !== listing.status) {
        // Calculate days on market
        const daysOnMarket = listing.first_seen 
          ? daysBetween(new Date(listing.first_seen), update.detectedAt)
          : null;
        
        // Update DynamoDB
        await updateListingStatus(listing, {
          status: update.status,
          status_signal: update.signal,
          status_detected_at: update.detectedAt.toISOString(),
          days_on_market: daysOnMarket,
          last_known_price: listing.price, // Preserve
        });
        
        results.statusChanges.push({
          url: listing.url,
          from: listing.status,
          to: update.status,
          signal: update.signal,
          daysOnMarket,
        });
      }
      
      // Rate limit
      await sleep(100); // 10 requests/second
      
    } catch (error) {
      results.errors.push({ url: listing.url, error: error.message });
    }
  }
  
  // Log summary
  console.log(`Checked: ${results.checked}`);
  console.log(`Status changes: ${results.statusChanges.length}`);
  console.log(`Errors: ${results.errors.length}`);
  
  // Send to daily report
  await sendToReport(results);
  
  return results;
}
```

---

## Analytics Queries

### Average Days on Market by Location

```sql
SELECT 
  location,
  property_type,
  AVG(days_on_market) as avg_dom,
  COUNT(*) as sample_size
FROM listings
WHERE status IN ('sold', 'rented')
  AND days_on_market IS NOT NULL
  AND status_detected_at > NOW() - INTERVAL '90 days'
GROUP BY location, property_type
ORDER BY avg_dom;
```

### Fast-Selling Property Features

```sql
-- Find what features correlate with fast sales
SELECT 
  has_terrace,
  has_parking,
  floor,
  AVG(days_on_market) as avg_dom
FROM listings
WHERE status = 'sold'
  AND days_on_market IS NOT NULL
GROUP BY has_terrace, has_parking, floor
ORDER BY avg_dom;
```

### Market Velocity Trend

```sql
SELECT 
  DATE_TRUNC('week', status_detected_at) as week,
  COUNT(*) FILTER (WHERE status = 'sold') as sold,
  COUNT(*) FILTER (WHERE status = 'rented') as rented,
  AVG(days_on_market) as avg_dom
FROM listings
WHERE status IN ('sold', 'rented')
GROUP BY week
ORDER BY week;
```

---

## User-Facing Features

### 1. Listing Page Badge

```tsx
// Show market velocity on listing page
<div className="market-velocity">
  <span className="badge">⚡ Fast Market</span>
  <p>Similar properties sell in ~23 days</p>
</div>
```

### 2. User Alerts

```typescript
// Daily cron: check user watchlist for status changes
async function notifyWatchlistChanges(userId: string) {
  const watchlist = await getUserWatchlist(userId);
  
  for (const listing of watchlist) {
    if (listing.status !== 'active') {
      await sendNotification(userId, {
        type: 'watchlist_status_change',
        listing: listing.url,
        newStatus: listing.status,
        message: `A property you're watching has been ${listing.status}`,
      });
    }
  }
}
```

### 3. Recommender Training

```typescript
// Use sold data to boost similar properties
function calculateDesirabilityBoost(listing: Listing): number {
  // Find similar sold listings
  const similarSold = await findSimilarSold(listing, {
    location: listing.neighborhood,
    priceRange: [listing.price * 0.8, listing.price * 1.2],
    propertyType: listing.property_type,
  });
  
  if (similarSold.length === 0) return 0;
  
  // Fast sellers = desirable area/features
  const avgDaysOnMarket = average(similarSold.map(l => l.days_on_market));
  
  // Boost if area sells fast (< 30 days = hot market)
  if (avgDaysOnMarket < 30) return 0.2;  // 20% boost
  if (avgDaysOnMarket < 45) return 0.1;  // 10% boost
  
  return 0;
}
```

---

## Cost Estimate

| Component | Volume | Cost |
|-----------|--------|------|
| HTTP checks | 5,000/day | ~$0.05 (Lambda) |
| DynamoDB writes | ~500/day (status changes) | ~$0.01 |
| **Total** | | **~$2/month** |

---

## Implementation Priority

| Phase | Task | Status |
|-------|------|--------|
| 1 | Add status fields to schema | 🔲 TODO |
| 2 | Implement HTTP + soft 404 detection | 🔲 TODO |
| 3 | Implement text pattern detection | 🔲 TODO |
| 4 | Implement badge detection | 🔲 TODO |
| 5 | Create Lambda function | 🔲 TODO |
| 6 | Add to daily cron schedule | 🔲 TODO |
| 7 | Build analytics queries | 🔲 TODO |
| 8 | User-facing features | 🔲 TODO |

---

## Testing

### Test URLs by Status

```typescript
const TEST_CASES = [
  // 404
  { url: 'https://example.com/listing/deleted-123', expected: 'removed' },
  
  // Sold badge
  { url: 'https://idealista.com/inmueble/12345/', expected: 'sold' },
  
  // Text detection
  { url: 'https://fotocasa.es/es/comprar/vivienda/madrid/vendido/', expected: 'sold' },
  
  // Still active
  { url: 'https://pisos.com/comprar/piso-madrid_capital/', expected: 'active' },
];
```

---

*Last Updated: 2025-11-28*
*Status: Spec Complete, Implementation TODO*

