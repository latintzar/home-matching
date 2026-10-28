import fs from 'fs';
import path from 'path';
import * as turf from '@turf/turf';
import dotenv from 'dotenv';

// Load env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
  for (const k in envConfig) process.env[k] = envConfig[k];
}

const SCRAPINGDOG_API_KEY = process.env.SCRAPINGDOG_API_KEY;

// Helper: Delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Call ScrapingDog
async function searchPlaces(query: string, lat: number, lng: number, zoom: string = '15z') {
    if (!SCRAPINGDOG_API_KEY) return [];
    const ll = `@${lat},${lng},${zoom}`;
    const url = `https://api.scrapingdog.com/google_maps?api_key=${SCRAPINGDOG_API_KEY}&query=${encodeURIComponent(query)}&ll=${ll}&domain=google.es`;
    
    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`   ❌ API Error: ${res.status}`);
            return [];
        }
        const data = await res.json();
        return data.search_results || [];
    } catch (e) {
        console.error(`   ❌ Fetch Error:`, e);
        return [];
    }
}

async function generateFullVibeStack() {
  console.log('🚀 Generating Full Vibe Stack (Cost & Visualization Test)...');

  // 1. Load Sweet Spot (Use Profile 2 from previous run - 2.12km2 - better for testing than 81km2)
  // We will manually override to use the smaller profile if available, or crop the large one.
  const resultsPath = path.resolve(process.cwd(), 'src/data/lifestyle-test-results.json');
  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  
  // Let's look for the smaller sweet spot (Profile 2 from 2 runs ago was 2.12km2)
  // The current file might only have the 81km2 one.
  // Let's just use the current one but LIMIT the grid to the center 2x2km area to save time/cost for this demo.
  const profile = results[results.length - 1];
  const sweetSpot = profile.mapData.sweetSpot;
  
  // Create a 2km x 2km box around the center of the Sweet Spot to test.
  const center = turf.center(sweetSpot);
  const bbox = turf.bbox(turf.buffer(center, 1, { units: 'kilometers' })); // 1km radius = ~2km box
  
  // Grid: 1km resolution
  const cellSide = 1; 
  const grid = turf.pointGrid(bbox, cellSide, { units: 'kilometers' });
  const searchPoints = grid.features; // Should be ~4 points

  console.log(`\n📍 Focus Area: 2km x 2km Center of Sweet Spot`);
  console.log(`   - Grid Points: ${searchPoints.length}`);

  // 2. Define Vibe Layers
  const vibeLayers = {
      amenities: { query: "bakery", minRating: 4.5, color: "#10B981" }, // Green
      gentrification_high: { query: "specialty coffee", color: "#EF4444" }, // Red
      gentrification_low: { query: "bodega tradicional", color: "#3B82F6" }, // Blue
      lunch: { query: "italian sandwich", color: "#F59E0B" } // Orange (Profile Request)
  };

  const allResults: any[] = [];

  // 3. Run Searches (Parallel Batches)
  let totalCost = 0;
  
  for (const point of searchPoints) {
      const [lng, lat] = point.geometry.coordinates;
      console.log(`\n🔎 Scanning Grid Cell: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      
      for (const [key, config] of Object.entries(vibeLayers)) {
          console.log(`   - Fetching "${config.query}"...`);
          const items = await searchPlaces(config.query, lat, lng);
          totalCost += 0.001;
          
          // Process Items
          const validItems = items.map((item: any) => ({
              type: 'Feature',
              geometry: {
                  type: 'Point',
                  coordinates: [item.gps_coordinates.longitude, item.gps_coordinates.latitude]
              },
              properties: {
                  name: item.title,
                  rating: item.rating,
                  reviews: item.reviews,
                  layer: key,
                  icon: config.query
              }
          }));
          
          // Filter High Quality for Amenities
          if (config.minRating) {
              const highQuality = validItems.filter((i: any) => i.properties.rating >= config.minRating);
              console.log(`     -> Found ${validItems.length}, kept ${highQuality.length} (4.5+)`);
              allResults.push(...highQuality);
          } else {
              console.log(`     -> Found ${validItems.length}`);
              allResults.push(...validItems);
          }
          
          await delay(500); // Be nice to API
      }
  }

  console.log(`\n💰 Total Cost for Demo: $${totalCost.toFixed(4)}`);

  // 4. Generate "Archipelago" (Islands)
  // Buffer around "amenities" points
  const amenitiesPoints = allResults.filter(r => r.properties.layer === 'amenities');
  let archipelago = null;
  let perfectSweetSpot = null;
  
  if (amenitiesPoints.length > 0) {
      const pointCollection = turf.featureCollection(amenitiesPoints);
      // 400m buffer = 0.4km
      const islands = turf.buffer(pointCollection, 0.4, { units: 'kilometers' });
      archipelago = turf.union(turf.featureCollection(islands.features));
      
      if (archipelago) {
          archipelago.properties = { layerType: 'archipelago', fill: '#10B981', opacity: 0.3 };
          
          // 5. Calculate "Perfect Sweet Spot" (Intersection of Sweet Spot + Archipelago)
          try {
              // Ensure sweetSpot is a Polygon/MultiPolygon
              const sweetSpotPoly = sweetSpot.geometry ? sweetSpot : { type: 'Feature', geometry: sweetSpot, properties: {} };
              
              // Intersect
              perfectSweetSpot = turf.intersect(turf.featureCollection([sweetSpotPoly, archipelago]));
              
              if (perfectSweetSpot) {
                  perfectSweetSpot.properties = { 
                      layerType: 'perfect_sweetspot', 
                      fill: '#FFD700', // Gold
                      opacity: 0.8 
                  };
                  console.log(`   - Perfect Sweet Spot Area: ${(turf.area(perfectSweetSpot) / 1000000).toFixed(2)} km² (Gold)`);
              }
          } catch (e) {
              console.error('Error calculating perfect sweet spot:', e);
          }
      }
  }

  // 6. Save GeoJSON for Frontend
  // We will inject this into the 'geojsonData' structure so the map can render it.
  // We'll add a 'vibe_markers', 'vibe_polygons' and 'perfect_sweet_spot' field.
  
  const outputData = {
      ...profile.mapData,
      vibeMarkers: allResults,
      vibePolygons: archipelago ? [archipelago] : [],
      perfectSweetSpot: perfectSweetSpot
  };
  
  // Update the result file
  results[results.length - 1].mapData = outputData;
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  
  console.log(`\n💾 Saved Vibe Data to ${resultsPath}`);
  console.log(`   - Markers: ${allResults.length}`);
  console.log(`   - Archipelago: ${archipelago ? 'Generated' : 'None'}`);
}

generateFullVibeStack();

