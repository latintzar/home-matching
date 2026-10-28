import { createClient } from '@supabase/supabase-js';
import { SocialRadar } from '@/lib/intelligence/social-radar';
import { StreetViewDetective } from '@/lib/intelligence/street-view';
import { GeologyCheck } from '@/lib/intelligence/geology';
import { TenderWatch } from '@/lib/intelligence/tenders';

// Force node environment for scripts
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

async function runFullTest() {
  const addresses = [
    {
      address: '54 Carrer de Torrent de les Flors, Barcelona',
      city: 'Barcelona',
      lat: 41.4065,
      lng: 2.1594,
      desc: 'Urban Residential (Barcelona)'
    },
    {
      address: 'Portals Nous',
      city: 'Calvia',
      lat: 39.5330,
      lng: 2.5660,
      desc: 'Coastal Luxury (Mallorca)'
    },
    {
      address: 'Calle Serrano 1',
      city: 'Madrid',
      lat: 40.4203,
      lng: -3.6888,
      desc: 'Prime Luxury (Madrid)'
    },
    {
      address: 'Calle de la Princesa 1',
      city: 'Madrid',
      lat: 40.4234,
      lng: -3.7122,
      desc: 'Busy Urban (Madrid)'
    }
  ];

  console.log('🚀 Starting Multi-Location Intelligence Report');
  console.log('================================================');

  const radar = new SocialRadar();
  const svDetective = new StreetViewDetective();
  const geoCheck = new GeologyCheck();
  const tenderWatch = new TenderWatch();

  for (const loc of addresses) {
    console.log(`\n📍 analyzing: ${loc.desc}`);
    console.log(`   Address: ${loc.address}`);
    console.log(`   Coords: ${loc.lat}, ${loc.lng}`);
    console.log('   ----------------------------------------');

    try {
      // Parallel Execution
      const [social, visual, geology, tenders] = await Promise.all([
        radar.analyzeLocation(loc.lat, loc.lng, [loc.address, loc.city], 'exact'),
        (async () => {
           const available = await svDetective.checkAvailability(loc.lat, loc.lng);
           let images = available ? await svDetective.captureScene(loc.lat, loc.lng) : [];
           if (images.length === 0) images = await svDetective.surveyNeighborhood(loc.lat, loc.lng, 200);
           return images.length > 0 ? await svDetective.analyzeVibe(images) : null;
        })(),
        geoCheck.checkPoint(loc.lat, loc.lng),
        tenderWatch.checkStreetWorks(loc.address, loc.city)
      ]);

      // Report
      console.log(`   📡 SOCIAL RADAR:`);
      console.log(`      Risk Level: ${social.riskLevel}`);
      console.log(`      Airbnb: ${social.airbnb.nearbyListings} listings found.`);
      if (social.airbnb.redFlags.length > 0) {
        console.log(`      🚩 Red Flag Sample: "${social.airbnb.redFlags[0].text.substring(0, 60)}..."`);
      }
      console.log(`      Summary: ${social.summary.substring(0, 150)}...`);

      console.log(`\n   📸 VISUAL DETECTIVE:`);
      if (visual) {
        console.log(`      Vibe Score: ${visual.vibe_score}/10`);
        console.log(`      Maintenance: ${visual.maintenance_condition}`);
        console.log(`      Security: ${visual.security_features.join(', ') || 'None'}`);
        console.log(`      Summary: ${visual.summary.substring(0, 150)}...`);
      } else {
        console.log(`      ❌ No Street View images available.`);
      }

      console.log(`\n   🏗️ TENDERS WATCH:`);
      console.log(`      Summary: ${tenders.summary}`);
      if (tenders.activeWorks.length > 0) {
        console.log(`      Active Works: ${tenders.activeWorks.length}`);
        console.log(`      Top Work: ${tenders.activeWorks[0].title.substring(0, 80)}...`);
      }

      console.log(`\n   🪨 GEOLOGY CHECK:`);
      console.log(`      Clay Risk: ${geology.clayRisk ? 'YES' : 'NO'}`);
      console.log(`      Flood Risk: ${geology.floodRisk ? 'YES' : 'NO'}`);
      console.log(`      Details: ${geology.details}`);

    } catch (e) {
      console.error(`   ❌ Failed to analyze ${loc.address}:`, e);
    }
    
    console.log('\n   ========================================');
  }
}

runFullTest();
