import { createClient } from '@supabase/supabase-js';
import { SocialRadar } from '@/lib/intelligence/social-radar';
import { StreetViewDetective } from '@/lib/intelligence/street-view';

// Force node environment for scripts
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runTest() {
  // 1. Test Case A: 54 carrer de torrent de les flors, barcelona
  console.log('\n🧪 Running Test Case A: 54 Carrer de Torrent de les Flors, Barcelona');
  await runIntelligenceForAddress(
    '54 Carrer de Torrent de les Flors, Barcelona',
    'Barcelona',
    41.4065, // Approx lat
    2.1594   // Approx lng
  );

  // 2. Test Case B: Portals Nous, Calvia, Mallorca
  console.log('\n🧪 Running Test Case B: Portals Nous, Calvia, Mallorca');
  await runIntelligenceForAddress(
    'Portals Nous',
    'Calvia',
    39.5330, // Approx lat
    2.5660   // Approx lng
  );
}

async function runIntelligenceForAddress(address: string, city: string, lat: number, lng: number) {
  try {
    console.log(`   📍 Target: ${address} (${lat}, ${lng})`);

    // A. Social Radar
    console.log('   📡 Running Social Radar...');
    const radar = new SocialRadar();
    // Terms: address + city
    const terms = [address, city];
    // Determine mode: if "Portals Nous" (neighborhood/town), use 'neighborhood' mode
    const mode = address.includes('Carrer') ? 'exact' : 'neighborhood';
    
    const socialData = await radar.analyzeLocation(lat, lng, terms, mode);
    console.log(`      ✅ Social Risk: ${socialData.riskLevel}`);
    console.log(`      📝 Summary: ${socialData.summary.substring(0, 100)}...`);
    console.log(`      🏠 Airbnb: ${socialData.airbnb.nearbyListings} listings (Radius: ${socialData.airbnb.radiusUsed}m)`);

    // B. Street View
    console.log('   📸 Running Street View Detective...');
    const svDetective = new StreetViewDetective();
    let images: string[] = [];
    
    // Check availability
    const available = await svDetective.checkAvailability(lat, lng);
    if (available) {
      console.log('      ✅ Exact SV match found.');
      images = await svDetective.captureScene(lat, lng);
    } else {
      console.log('      ⚠️ No exact match, surveying neighborhood...');
      images = await svDetective.surveyNeighborhood(lat, lng, 200);
    }

    if (images.length > 0) {
      const svAnalysis = await svDetective.analyzeVibe(images);
      console.log(`      🏘 Vibe Score: ${svAnalysis.vibe_score}/10`);
      console.log(`      📝 Visual Summary: ${svAnalysis.summary.substring(0, 100)}...`);
    } else {
      console.log('      ❌ No images found.');
    }

  } catch (error) {
    console.error('   ❌ Test Failed:', error);
  }
}

runTest();

