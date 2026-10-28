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
const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || '2152837cef1b4a159356a9665a701bdd';
const ISOLINE_URL = 'https://api.geoapify.com/v1/isoline';

interface Place {
  name: string;
  lat: number;
  lng: number;
  rating?: number;
  reviews?: number;
  types?: string[];
}

// Helper to fetch places via ScrapingDog
async function searchPlaces(query: string, lat: number, lng: number): Promise<Place[]> {
  if (!SCRAPINGDOG_API_KEY) {
    console.warn(`⚠️ No ScrapingDog API Key. Returning mock data for "${query}".`);
    return getMockPlaces(query, lat, lng);
  }

  // Use a slightly larger zoom for broader search (14z ~ a few km)
  const ll = `@${lat},${lng},14z`;
  const url = `https://api.scrapingdog.com/google_maps?api_key=${SCRAPINGDOG_API_KEY}&query=${encodeURIComponent(query)}&ll=${ll}&domain=google.es`;

  try {
    console.log(`🔍 Searching: "${query}"...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API Error ${res.status}`);
    const data = await res.json();
    
    if (data.search_results) {
      return data.search_results.map((r: any) => ({
        name: r.title,
        lat: r.gps_coordinates.latitude,
        lng: r.gps_coordinates.longitude,
        rating: r.rating,
        reviews: r.reviews,
        types: r.types
      }));
    }
    return [];
  } catch (e) {
    console.error(`❌ Search failed for "${query}":`, e);
    return [];
  }
}

// Mock Data Fallback
function getMockPlaces(query: string, centerLat: number, centerLng: number): Place[] {
  // Generate some random points around center
  const places: Place[] = [];
  const count = query.includes('coworking') ? 8 : 12;
  
  for (let i = 0; i < count; i++) {
    // Random offset ~1km
    const latOffset = (Math.random() - 0.5) * 0.02;
    const lngOffset = (Math.random() - 0.5) * 0.02;
    
    places.push({
      name: `${query} Mock ${i + 1}`,
      lat: centerLat + latOffset,
      lng: centerLng + lngOffset,
      rating: 4.0 + Math.random(),
      reviews: Math.floor(Math.random() * 100)
    });
  }
  return places;
}

// Helper to fetch Isochrone with retry
async function getIsochrone(lat: number, lng: number, mode: string, minutes: number) {
  const apiMode = mode === 'moped' ? 'motorcycle' : 'drive'; 
  const range = minutes * 60;
  const url = `${ISOLINE_URL}?lat=${lat}&lon=${lng}&type=time&mode=${apiMode}&range=${range}&apiKey=${GEOAPIFY_API_KEY}`;
  
  for (let i = 0; i < 3; i++) { // 3 retries
    try {
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        return json.features?.[0] || null;
      }
      if (res.status === 429) await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Backoff
    } catch (e) {
      console.error('Isochrone fetch failed:', e);
    }
  }
  return null;
}

async function runActiveIntrovertTest() {
  console.log('🚀 Starting "Active Introvert" Test (Hard Constraints + Negative Vibe Checks)...');
  const costs = {
    scrapingDog: 0,
    geoapify: 0
  };

  // 1. Define Anchors
  const ANCHORS = {
      BEACH: { lat: 41.3804, lng: 2.1923, name: 'Barceloneta Beach' },
      POOL: { lat: 41.3695, lng: 2.1625, name: 'Montjuïc Municipal Pool' },
      TENNIS: { lat: 41.4283, lng: 2.1465, name: 'Vall d\'Hebron Tennis (Hills)' },
      GRACIA_CENTER: { lat: 41.4010, lng: 2.1560 } // For work search
  };

  // 2. Vibe Check: Gentrification & Party Zones
  console.log('\n🔍 Phase 1: Scanning Vibes (Gentrification, Tradition, Party)...');
  
  // A. "Party" (Avoid) - High density of nightclubs
  const partySpots = await searchPlaces('nightclub', ANCHORS.GRACIA_CENTER.lat, ANCHORS.GRACIA_CENTER.lng);
  costs.scrapingDog++;
  console.log(`   Found ${partySpots.length} Nightclubs (Avoid Zone).`);

  // B. "Foreigner Friendly" (Gold Signal) - Specialty Coffee
  const coffeeShops = await searchPlaces('specialty coffee', ANCHORS.GRACIA_CENTER.lat, ANCHORS.GRACIA_CENTER.lng);
  costs.scrapingDog++;
  console.log(`   Found ${coffeeShops.length} Specialty Coffee shops (Foreigner Friendly Signal).`);

  // C. "Traditional/Safe" (Silver Signal) - Bodegas / Farmacies
  const bodegas = await searchPlaces('bodega tradicional', ANCHORS.GRACIA_CENTER.lat, ANCHORS.GRACIA_CENTER.lng);
  costs.scrapingDog++;
  console.log(`   Found ${bodegas.length} Traditional Bodegas (Safety/Tradition Signal).`);

  // 3. Work Search (Coworking + Food)
  console.log('\n💼 Phase 2: Finding Work Options...');
  const candidateCoworkings = await searchPlaces('coworking', ANCHORS.GRACIA_CENTER.lat, ANCHORS.GRACIA_CENTER.lng);
  costs.scrapingDog++;
  
  const italianShops = await searchPlaces('italian sandwich', ANCHORS.GRACIA_CENTER.lat, ANCHORS.GRACIA_CENTER.lng);
  costs.scrapingDog++;
  
  const traditionalFood = await searchPlaces('menu del dia', ANCHORS.GRACIA_CENTER.lat, ANCHORS.GRACIA_CENTER.lng);
  costs.scrapingDog++;

  // Validation Logic
  const SANDWICH_RADIUS_KM = 0.8;
  const goldCoworkings: Place[] = [];
  const silverCoworkings: Place[] = [];
  const validCoworkingFeatures: any[] = [];

  for (const coworking of candidateCoworkings) {
      const pt = turf.point([coworking.lng, coworking.lat]);
      
      const nearItalian = italianShops.some(s => turf.distance(pt, turf.point([s.lng, s.lat]), { units: 'kilometers' }) <= SANDWICH_RADIUS_KM);
      const nearTrad = traditionalFood.some(s => turf.distance(pt, turf.point([s.lng, s.lat]), { units: 'kilometers' }) <= SANDWICH_RADIUS_KM);

      if (nearItalian) {
          goldCoworkings.push(coworking);
          validCoworkingFeatures.push({
              type: 'Feature', 
              geometry: { type: 'Point', coordinates: [coworking.lng, coworking.lat] },
              properties: { title: coworking.name, layer: 'valid_coworking_gold' }
          });
      } else if (nearTrad) {
          silverCoworkings.push(coworking);
          validCoworkingFeatures.push({
              type: 'Feature', 
              geometry: { type: 'Point', coordinates: [coworking.lng, coworking.lat] },
              properties: { title: coworking.name, layer: 'valid_coworking_silver' }
          });
      }
  }

  // 4. Generate Hard Anchor Isochrones (The "Triangle of Truth")
  console.log('\n🛑 Phase 3: Generating Hard Constraints (Triangle of Truth)...');
  
  const beachIso = await getIsochrone(ANCHORS.BEACH.lat, ANCHORS.BEACH.lng, 'moped', 15); costs.geoapify++;
  const poolIso = await getIsochrone(ANCHORS.POOL.lat, ANCHORS.POOL.lng, 'moped', 10); costs.geoapify++;
  const tennisIso = await getIsochrone(ANCHORS.TENNIS.lat, ANCHORS.TENNIS.lng, 'moped', 10); costs.geoapify++;

  if (!beachIso || !poolIso || !tennisIso) {
      console.error('Failed to generate hard anchors. Aborting.');
      return;
  }

  // Intersect Hard Anchors
  let hardConstraintZone = null;
  try {
      const beachPool = turf.intersect(turf.featureCollection([beachIso, poolIso]));
      if (beachPool) {
          hardConstraintZone = turf.intersect(turf.featureCollection([beachPool, tennisIso]));
      }
  } catch (e) { console.error(e); }

  if (!hardConstraintZone) {
      console.warn('⚠️ No intersection found between Beach, Pool, and Tennis. Try increasing travel times.');
      // For demo purposes, fallback to just Beach + Pool to show *something*
      try { hardConstraintZone = turf.intersect(turf.featureCollection([beachIso, poolIso])); } catch(e){}
  }

  // 5. Generate Flexible Work Zones
  console.log('\n🛵 Phase 4: Generating Flexible Work Zones...');
  const createZone = async (places: Place[]) => {
    if (places.length === 0) return null;
    const polys = [];
    for (const p of places) {
      await new Promise(r => setTimeout(r, 200));
      const iso = await getIsochrone(p.lat, p.lng, 'moped', 15);
      if (iso) { polys.push(iso); costs.geoapify++; }
    }
    if (polys.length === 0) return null;
    let union = polys[0];
    for (let i = 1; i < polys.length; i++) {
        try { union = turf.union(turf.featureCollection([union, polys[i]])); } catch(e){}
    }
    return union;
  };

  const goldWorkZone = await createZone(goldCoworkings);
  const silverWorkZone = await createZone(silverCoworkings);

  // 6. Calculate Sweet Spots (Hard Constraints + Work)
  console.log('\n🎯 Phase 5: Calculating Sweet Spots...');
  let goldSweetSpot = null;
  let silverSweetSpot = null;

  if (hardConstraintZone) {
      if (goldWorkZone) {
          try { goldSweetSpot = turf.intersect(turf.featureCollection([hardConstraintZone, goldWorkZone])); } catch(e){}
      }
      if (silverWorkZone) {
          try { silverSweetSpot = turf.intersect(turf.featureCollection([hardConstraintZone, silverWorkZone])); } catch(e){}
      }
  }

  // 7. Apply Negative Constraints (The "Party" Holes) & Positive "Village" Logic
  console.log('\n🚫 Phase 6: punching holes for Party Neighborhoods (Peaceful Village Logic)...');
  // "Peaceful Village": expanded buffer to 500m (ensure neighborhood peace)
  const partyBufferKm = 0.5; 
  const partyPolys = partySpots.map(p => turf.circle([p.lng, p.lat], partyBufferKm, { steps: 10, units: 'kilometers' }));
  
  const subtractPolygons = (basePoly: any, holes: any[]) => {
      if (!basePoly) return null;
      let result = basePoly;
      for (const hole of holes) {
          try { result = turf.difference(turf.featureCollection([result, hole])); } catch(e){}
      }
      return result;
  };

  if (goldSweetSpot) goldSweetSpot = subtractPolygons(goldSweetSpot, partyPolys);
  if (silverSweetSpot) silverSweetSpot = subtractPolygons(silverSweetSpot, partyPolys);

  // 7b. Add "Social Access" Logic (15m walk to Good Bars)
  console.log('\n🍻 Phase 6b: Ensuring Social Access (15m walk to Good Bars)...');
  // Mocking "Good Bars" search for now to save cost/time in this specific run, 
  // or we can reuse partySpots but filter for quality if we had rating data.
  // For this test, let's assume we want to be near the "Foreigner Friendly" coffee spots as a proxy for "Social/Vibe"
  // OR strict interpretation: we need a new search. Let's do a quick search if budget allows.
  // We'll reuse 'specialty coffee' as a proxy for "Nice Vibe Area" to save a call, 
  // OR we can assume the "Party Zones" (Nightclubs) also contain the "Good Bars".
  // The constraint is: "Not ON the party street, but <15m from it".
  // So we intersect with a BUFFER around the party spots (e.g., 1km / 15min walk)
  
  const accessBufferKm = 1.0; // ~12-15 min walk
  const accessPolys = partySpots.map(p => turf.circle([p.lng, p.lat], accessBufferKm, { steps: 10, units: 'kilometers' }));
  let accessZone = null;
  if (accessPolys.length > 0) {
      accessZone = accessPolys[0];
      for(let i=1; i<accessPolys.length; i++) { try { accessZone = turf.union(turf.featureCollection([accessZone, accessPolys[i]])); } catch(e){} }
  }

  // Intersect Sweet Spots with Access Zone
  if (goldSweetSpot && accessZone) {
      try { goldSweetSpot = turf.intersect(turf.featureCollection([goldSweetSpot, accessZone])); } catch(e){}
  }
  if (silverSweetSpot && accessZone) {
      try { silverSweetSpot = turf.intersect(turf.featureCollection([silverSweetSpot, accessZone])); } catch(e){}
  }

  // 8. Generate Vibe Layers (Gentrification vs Tradition)
  // Create small "islands" around clusters of coffee (Gentrification) and bodegas (Tradition)
  const coffeeBuffer = 0.4;
  const bodegaBuffer = 0.4;
  
  const coffeeIslands = coffeeShops.map(p => turf.circle([p.lng, p.lat], coffeeBuffer, { steps: 10, units: 'kilometers' }));
  const bodegaIslands = bodegas.map(p => turf.circle([p.lng, p.lat], bodegaBuffer, { steps: 10, units: 'kilometers' }));
  
  let highGentrificationZone = null; // Union of coffee circles
  let traditionalZone = null; // Union of bodega circles

  // Union logic for vibes
  if (coffeeIslands.length > 0) {
      highGentrificationZone = coffeeIslands[0];
      for(let i=1; i<coffeeIslands.length; i++) { try { highGentrificationZone = turf.union(turf.featureCollection([highGentrificationZone, coffeeIslands[i]])); } catch(e){} }
  }
  if (bodegaIslands.length > 0) {
      traditionalZone = bodegaIslands[0];
      for(let i=1; i<bodegaIslands.length; i++) { try { traditionalZone = turf.union(turf.featureCollection([traditionalZone, bodegaIslands[i]])); } catch(e){} }
  }

  // 9. Output
    const mapData = {
    anchors: [
        { ...beachIso, properties: { type: 'Beach (Hard)', mode: '15m' } },
        { ...poolIso, properties: { type: 'Pool (Hard)', mode: '10m' } },
        { ...tennisIso, properties: { type: 'Tennis (Hard)', mode: '10m' } }
    ],
    sweetSpot: hardConstraintZone, // The "Base" viable zone
    perfectSweetSpot: goldSweetSpot, // The "Perfect" (Work + Hard + Safe)
    opportunitySweetSpot: silverSweetSpot, // The "Opportunity" (Alt Work + Hard + Safe)
    
    // Vibe Polygons
    vibePolygons: [
        ...(highGentrificationZone ? [{ ...highGentrificationZone, properties: { layer: 'gentrification_high' } }] : []),
        ...(traditionalZone ? [{ ...traditionalZone, properties: { layer: 'gentrification_low' } }] : [])
    ],

    vibeMarkers: [
        ...validCoworkingFeatures,
        ...partySpots.map(s => ({
            type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
            properties: { title: s.name, layer: 'gentrification_high' } // Re-using red for "Avoid" visual
        })),
        ...coffeeShops.map(s => ({
            type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
            properties: { title: s.name, layer: 'amenities' } // Green for coffee
        })),
        ...bodegas.map(s => ({
            type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
            properties: { title: s.name, layer: 'gentrification_low' } // Blue for bodegas
        }))
    ]
  };

  const outputData = [{
    id: 'active-introvert-test',
    input_text: "Active Introvert: Beach(15m), Pool(10m), Tennis(10m). Work(15m) near Italian(Gold) or MenuDelDia(Silver). No Party Neighborhoods (500m buffer) but <15m walk to bars.",
    profile: {
        anchors: [
            { type: 'Beach', location: { lat: ANCHORS.BEACH.lat, lng: ANCHORS.BEACH.lng }, transport_mode: 'moped' },
            { type: 'Pool', location: { lat: ANCHORS.POOL.lat, lng: ANCHORS.POOL.lng }, transport_mode: 'moped' },
            { type: 'Tennis', location: { lat: ANCHORS.TENNIS.lat, lng: ANCHORS.TENNIS.lng }, transport_mode: 'moped' }
        ],
        vibe: []
    },
    stats: {
        sweetSpotAreaKm2: goldSweetSpot ? (turf.area(goldSweetSpot) / 1000000).toFixed(2) : 0,
        anchorsCount: 3
    },
    mapData: mapData
  }];

  const outputPath = path.resolve(process.cwd(), 'src/data/lifestyle-test-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  console.log(`\n💾 Results saved to ${outputPath}`);

  console.log('\n💰 Final Cost Calculation:');
  console.log(`   - ScrapingDog Calls: ${costs.scrapingDog} ($${(costs.scrapingDog * 0.001).toFixed(4)})`);
  console.log(`   - Geoapify Credits:  ${costs.geoapify} (Free tier)`);
  console.log('   ----------------------------------------');
  console.log(`   TOTAL ESTIMATED COST: $${(costs.scrapingDog * 0.001).toFixed(4)}`);
}

runActiveIntrovertTest();

