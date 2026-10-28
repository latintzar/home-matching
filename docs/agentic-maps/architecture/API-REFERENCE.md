---
status: design
last_updated: 2024-12-12
---

# API Reference

> Consolidated pricing and usage for all external services.

## Quick Reference

| Service | Primary Use | Cost | Free Tier |
|---------|-------------|------|-----------|
| Gemini 2.5 Pro | Area generation with grounding | $0.00025/1K input | 15 RPM |
| Gemini 2.5 Flash | Query classification | $0.000075/1K input | 15 RPM |
| Gemini 2.5 Flash Lite | Text curation | $0.00003/1K input | 15 RPM |
| ScrapingDog | Web scraping, GMaps | $0.001/request | 1000/month |
| Geoapify | Isochrones, geometry | $0.0049/call | 3000/day |
| Mapbox Maps GL | Map display | $0.005/load | 50K/month |
| Mapbox Geocoding | Address lookup | $0.50/1K | 100K/month |
| Mapbox Directions | Route calculation | $1.00/1K | 100K/month |
| Mapbox Matrix | Travel time matrix | $0.50/1K elements | 100K/month |

## Gemini API

### Models

| Model | Best For | Input Cost | Output Cost |
|-------|----------|------------|-------------|
| `gemini-2.5-pro` | Complex reasoning, grounding | $0.00025/1K tokens | $0.00075/1K tokens |
| `gemini-2.5-flash` | Fast classification | $0.000075/1K tokens | $0.0003/1K tokens |
| `gemini-2.5-flash-lite` | Simple curation | $0.00003/1K tokens | $0.00015/1K tokens |

### With Google Search Grounding

When using `gemini-2.5-pro` with Google Search grounding:
- Additional cost: ~$0.003-0.005 per grounded query
- Provides real-time, accurate location data
- Required for area recommendations

### Usage by Scenario

| Scenario | Model | Grounding | Est. Cost |
|----------|-------|-----------|-----------|
| Things to Do | Pro | Yes | ~$0.005 |
| Where to Stay | Pro | Yes | ~$0.005 |
| Stay + Do | Pro | Yes | ~$0.010 |
| Single Place | Flash + Lite | No | ~$0.002 |
| Meet in Middle | Flash + Lite | No | ~$0.002 |
| Areas to Explore | Pro | Yes | ~$0.005 |
| Multi-Stop | Mixed | Mixed | ~$0.005-0.015 |

### Rate Limits

- Free tier: 15 requests per minute (RPM)
- Pay-as-you-go: 60 RPM (Pro), 1000 RPM (Flash)

## ScrapingDog API

### Endpoints

| Endpoint | Cost | Returns |
|----------|------|---------|
| Google Search | $0.001/search | 10 organic results |
| Web Scraper | $0.001/page | Full HTML content |
| Google Maps Search | $0.001/search | Places with details |
| Google Maps Reviews | $0.001/place | Array of reviews |

### Usage Examples

```typescript
// Google Search
const searchUrl = `https://api.scrapingdog.com/google?api_key=${API_KEY}&query=${encodeURIComponent(query)}&results=10`;

// Google Maps Place
const mapsUrl = `https://api.scrapingdog.com/google_maps?api_key=${API_KEY}&query=${encodeURIComponent(placeName + ' ' + city)}`;

// Google Maps Reviews  
const reviewsUrl = `https://api.scrapingdog.com/google_maps_reviews?api_key=${API_KEY}&place_id=${placeId}`;
```

### Response Examples

**Google Maps Search Response:**
```json
{
  "name": "Fuunji",
  "address": "2-14-3 Yoyogi, Shibuya City, Tokyo",
  "rating": 4.5,
  "reviews": 2847,
  "price_level": "$$",
  "hours": "11:00 AM - 3:00 PM, 5:00 PM - 9:00 PM",
  "coordinates": { "lat": 35.6833, "lng": 139.7020 },
  "place_id": "ChIJ..."
}
```

**Google Maps Reviews Response:**
```json
{
  "reviews": [
    {
      "author": "John D.",
      "rating": 5,
      "text": "Best ramen I've ever had...",
      "date": "2024-01-15"
    }
  ]
}
```

### Pricing Tiers

| Monthly Requests | Price per Request |
|-----------------|-------------------|
| 0 - 10,000 | $0.001 |
| 10,000 - 100,000 | $0.0009 |
| 100,000+ | $0.0008 |

## Geoapify API

### Endpoints

| Endpoint | Cost | Purpose |
|----------|------|---------|
| Isochrones | $0.0049/call | Travel time polygons |
| Geometry (Intersection) | $0.0049/call | Polygon operations |
| Geocoding | $0.0049/call | Address → coordinates |
| Reverse Geocoding | $0.0049/call | Coordinates → address |

### Isochrones API

```typescript
const getIsochrone = async (
  lat: number,
  lng: number, 
  mode: 'walk' | 'transit' | 'drive',
  minutes: number
) => {
  const url = new URL('https://api.geoapify.com/v1/isoline');
  url.searchParams.set('lat', lat.toString());
  url.searchParams.set('lon', lng.toString());
  url.searchParams.set('type', 'time');
  url.searchParams.set('mode', mode);
  url.searchParams.set('range', (minutes * 60).toString());
  url.searchParams.set('apiKey', GEOAPIFY_KEY);
  
  const response = await fetch(url);
  return response.json();
};
```

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[lng, lat], ...]]
    },
    "properties": {
      "mode": "walk",
      "range": 1800
    }
  }]
}
```

### Geometry API (Intersection)

```typescript
const getIntersection = async (polygons: GeoJSON.Polygon[]) => {
  const response = await fetch(
    `https://api.geoapify.com/v1/geometry/intersection?apiKey=${GEOAPIFY_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: polygons.map(p => ({ type: 'Feature', geometry: p }))
      })
    }
  );
  return response.json();
};
```

### Free Tier

- 3,000 API calls per day
- No credit card required
- All endpoints included

## Mapbox API

### Maps GL (Map Display)

| Usage | Cost |
|-------|------|
| 0 - 50,000 loads/month | FREE |
| 50,001 - 100,000 | $0.005/load |
| 100,001+ | $0.004/load |

**Critical**: Every map display = 1 load = $0.005 (after free tier)

### Geocoding API

```typescript
const geocode = async (query: string) => {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}`;
  const response = await fetch(url);
  return response.json();
};
```

| Usage | Cost |
|-------|------|
| 0 - 100,000/month | FREE |
| 100,001+ | $0.50/1000 requests |

### Directions API

```typescript
const getDirections = async (
  origin: [number, number],
  destination: [number, number],
  mode: 'walking' | 'driving' | 'cycling'
) => {
  const coords = `${origin.join(',')};${destination.join(',')}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/${mode}/${coords}?access_token=${MAPBOX_TOKEN}&geometries=polyline`;
  const response = await fetch(url);
  return response.json();
};
```

| Usage | Cost |
|-------|------|
| 0 - 100,000/month | FREE |
| 100,001+ | $1.00/1000 requests |

### Matrix API

```typescript
const getMatrix = async (
  coordinates: [number, number][],
  mode: 'walking' | 'driving'
) => {
  const coords = coordinates.map(c => c.join(',')).join(';');
  const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/${mode}/${coords}?access_token=${MAPBOX_TOKEN}`;
  const response = await fetch(url);
  return response.json();
};
```

**Cost**: $0.50 per 1000 **elements** (not requests!)

Example: 5 stops = 25 elements = $0.0125

| Stops | Elements | Cost |
|-------|----------|------|
| 3 | 9 | $0.0045 |
| 5 | 25 | $0.0125 |
| 8 | 64 | $0.032 |
| 10 | 100 | $0.05 |

## Cost by Scenario

### Scenario 1: Things to Do

| Component | Service | Cost |
|-----------|---------|------|
| Classification | Gemini Flash | $0.001 |
| Area generation | Gemini Pro + Grounding | $0.005 |
| Map display | Mapbox Maps GL | $0.005 |
| **Total** | | **$0.011** |

### Scenario 2: Where to Stay

Same as Scenario 1: **$0.011**

### Scenario 3: Stay + Do

| Component | Service | Cost |
|-----------|---------|------|
| Classification | Gemini Flash | $0.001 |
| Stay areas | Gemini Pro + Grounding | $0.005 |
| Activity areas | Gemini Pro + Grounding | $0.005 |
| Map display | Mapbox Maps GL | $0.005 |
| **Total** | | **$0.016** |

*Can optimize to $0.011 with single Gemini call*

### Scenario 4: Single Place

| Component | Service | Cost |
|-----------|---------|------|
| Classification | Gemini Flash | $0.001 |
| Google search | ScrapingDog | $0.001 |
| Extract candidates | Gemini Flash Lite | $0.0005 |
| Place details (×3) | ScrapingDog GMaps | $0.003 |
| Reviews (×1) | ScrapingDog Reviews | $0.001 |
| Curation | Gemini Flash Lite | $0.0005 |
| Map display | Mapbox Maps GL | $0.005 |
| **Total** | | **$0.012** |

### Scenario 5: Meet in Middle

| Component | Service | Cost |
|-----------|---------|------|
| Classification | Gemini Flash | $0.001 |
| Geocoding (×2) | Mapbox | $0.001 |
| Isochrones (×2) | Geoapify | $0.0098 |
| Intersection | Geoapify | $0.0049 |
| Google search | ScrapingDog | $0.001 |
| Place details (×3) | ScrapingDog | $0.003 |
| Reviews | ScrapingDog | $0.001 |
| Curation | Gemini Flash Lite | $0.001 |
| Map display | Mapbox Maps GL | $0.005 |
| **Total** | | **$0.035** |

### Scenario 6: Areas to Explore

| Component | Service | Cost |
|-----------|---------|------|
| Classification | Gemini Flash | $0.001 |
| Geocoding (×2) | Mapbox | $0.001 |
| Isochrones (×6) | Geoapify | $0.029 |
| Intersections | Turf.js (local) | FREE |
| Area generation | Gemini Pro + Grounding | $0.005 |
| Map display | Mapbox Maps GL | $0.005 |
| Directions (×2) | Mapbox | $0.002 |
| **Total** | | **$0.043** |

### Scenario 7: Multi-Stop Route

**Variable based on mix ratio:**

| Mix | 5 Stops | 8 Stops |
|-----|---------|---------|
| 100% areas | $0.038 | $0.055 |
| 50/50 | $0.083 | $0.120 |
| 100% places | $0.128 | $0.200 |

## Heavy User Analysis

### 100 Queries/Month by Scenario

| Scenario | 100 queries |
|----------|-------------|
| Things to Do | $1.10 |
| Where to Stay | $1.10 |
| Stay + Do | $1.60 |
| Single Place | $1.20 |
| Meet in Middle | $3.50 |
| Areas to Explore | $4.30 |
| Multi-Stop (avg) | $8.00 |

### Typical User Mix (100 queries)

| Mix | Monthly Cost |
|-----|--------------|
| 60% area-based, 30% single place, 10% multi-stop | $2.50 |
| 40% area-based, 40% single place, 20% multi-stop | $4.10 |
| 20% area-based, 50% single place, 30% multi-stop | $6.20 |

## Free Alternatives

### Turf.js (Local Processing)

Free client-side geospatial operations:
- Distance calculations
- Point-in-polygon checks
- Polygon intersections
- Buffer/circle generation
- Area calculations

```typescript
import * as turf from '@turf/turf';

// Distance between points
const dist = turf.distance(point1, point2, { units: 'kilometers' });

// Create circle (for vibe areas)
const circle = turf.circle(center, radius, { units: 'meters' });

// Intersection of polygons
const intersection = turf.intersect(polygon1, polygon2);
```

### Google Maps URLs (No API)

Generate GMaps links without API calls:

```typescript
// Search URL
const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;

// Directions URL
const directionsUrl = `https://www.google.com/maps/dir/${origin}/${destination}`;

// Place URL (if you have place ID)
const placeUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;
```

### OpenStreetMap Data

Free POI data for offline processing:
- Download: [Geofabrik](https://download.geofabrik.de/)
- Filter with Osmium or osmtogeojson
- Great for road trip POI discovery

## Rate Limiting Strategy

```typescript
// Simple rate limiter
const rateLimiter = {
  gemini: { calls: 0, resetAt: Date.now() + 60000, limit: 15 },
  scrapingdog: { calls: 0, resetAt: Date.now() + 60000, limit: 60 },
  geoapify: { calls: 0, resetAt: Date.now() + 86400000, limit: 3000 },
};

const checkRateLimit = async (service: keyof typeof rateLimiter): Promise<boolean> => {
  const limiter = rateLimiter[service];
  
  if (Date.now() > limiter.resetAt) {
    limiter.calls = 0;
    limiter.resetAt = Date.now() + (service === 'geoapify' ? 86400000 : 60000);
  }
  
  if (limiter.calls >= limiter.limit) {
    return false; // Rate limited
  }
  
  limiter.calls++;
  return true;
};
```

## Cost Optimization Tips

1. **Cache aggressively**: City+vibe combinations rarely change
2. **Use Turf.js locally**: Save Geoapify calls for production accuracy
3. **Batch API calls**: Combine multiple operations where possible
4. **Use Flash for classification**: 10x cheaper than Pro
5. **Limit reviews to top pick**: Don't fetch reviews for all candidates
6. **Stay in free tiers**: 50K Mapbox loads, 3K Geoapify calls/day

---

[← Chrome Extension](CHROME-EXTENSION.md) | [Back to Index](../AGENTIC_MAPS.md)
