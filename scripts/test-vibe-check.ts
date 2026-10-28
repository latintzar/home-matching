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

async function runVibeCheck() {
  console.log('🚀 Starting Vibe Check Cost & Quality Simulation...');

  // 1. Load the Sweet Spot from previous results
  const resultsPath = path.resolve(process.cwd(), 'src/data/lifestyle-test-results.json');
  if (!fs.existsSync(resultsPath)) {
    console.error('❌ No test results found. Run test-geoapify.ts first.');
    return;
  }

  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  // Use the last result (Profile 1 which is the 81km2 one, or Profile 2 which is smaller)
  // The user just ran the "expanded" profile, so it should be the large one (81km2).
  const profile = results[results.length - 1];
  
  if (!profile.mapData || !profile.mapData.sweetSpot) {
    console.error('❌ No sweet spot found in the last result.');
    return;
  }

  const sweetSpot = profile.mapData.sweetSpot;
  const areaKm2 = turf.area(sweetSpot) / 1000000;
  console.log(`\n📍 Sweet Spot Area: ${areaKm2.toFixed(2)} km²`);

  // 2. Calculate Grid for Google Maps Search
  // We use a 1.5km grid (approx zoom 14/15) to be safe and cover the area.
  // ScrapingDog/Google usually returns 20 results per page.
  // For "Bakery", density is high, so we need a tighter grid (e.g., 500m-1km) or use pagination.
  // Let's assume 1km grid for optimal density.
  const bbox = turf.bbox(sweetSpot);
  const cellSide = 1; // 1km
  const grid = turf.pointGrid(bbox, cellSide, { units: 'kilometers', mask: sweetSpot });
  
  // If the shape is irregular, pointGrid with mask is better than squareGrid.
  // Each point represents the CENTER of a search.
  const searchPoints = grid.features;
  console.log(`\n🔢 Grid Calculation (1km resolution):`);
  console.log(`   - Search Points generated: ${searchPoints.length}`);
  
  // 3. Queries to Run
  const queries = [
    "bakery",           // Amenity
    "specialty coffee", // Gentrification Signal (High)
    "bodega"            // Gentrification Signal (Low/Traditional)
  ];
  
  const totalCalls = searchPoints.length * queries.length;
  const costPer1k = 1.00; // $1 per 1000
  const totalCost = (totalCalls / 1000) * costPer1k;

  console.log(`\n💰 Cost Simulation:`);
  console.log(`   - Queries per point: ${queries.length}`);
  console.log(`   - Total API Calls: ${totalCalls}`);
  console.log(`   - Estimated Cost: $${totalCost.toFixed(4)}`);

  // 4. LIVE TEST (One Point Only)
  // We will pick the CENTER point of the sweet spot and run 1 live query to check data quality.
  if (SCRAPINGDOG_API_KEY && searchPoints.length > 0) {
    console.log('\n🧪 Running LIVE Vibe Check (1 Point Sample)...');
    
    // Pick a central point
    const samplePoint = searchPoints[Math.floor(searchPoints.length / 2)];
    const [lng, lat] = samplePoint.geometry.coordinates;
    const query = "bakery";
    
    // Format for ScrapingDog: @lat,lng,zoom
    // Zoom 15 is standard for neighborhood search
    const ll = `@${lat},${lng},15z`;
    
    const url = `https://api.scrapingdog.com/google_maps?api_key=${SCRAPINGDOG_API_KEY}&query=${query}&ll=${ll}&domain=google.es`;
    
    console.log(`   - Query: "${query}"`);
    console.log(`   - Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    console.log(`   - URL: ${url.replace(SCRAPINGDOG_API_KEY, 'HIDDEN_KEY')}`);
    
    try {
      const start = Date.now();
      const res = await fetch(url);
      const duration = Date.now() - start;
      
      if (!res.ok) {
        throw new Error(`API Error ${res.status}: ${await res.text()}`);
      }
      
      const data = await res.json();
      
      console.log(`   ✅ Success (${duration}ms)`);
      
      if (data.search_results) {
        console.log(`   - Found: ${data.search_results.length} bakeries`);
        console.log(`   - Top 3 Results:`);
        data.search_results.slice(0, 3).forEach((r: any, i: number) => {
            console.log(`     ${i+1}. ${r.title} (${r.rating}⭐, ${r.reviews} reviews)`);
        });
        
        // Vibe Check Logic Sample
        const goodBakeries = data.search_results.filter((r: any) => r.rating >= 4.5);
        console.log(`   - "Nice" Bakeries (4.5+): ${goodBakeries.length}`);
      } else {
        console.warn('   ⚠️ No results field in response:', data);
      }
      
    } catch (e: any) {
      console.error(`   ❌ Failed: ${e.message}`);
    }
  } else {
    console.log('\n⚠️ Skipping Live Test: No API Key or No Grid Points.');
  }
}

runVibeCheck();

