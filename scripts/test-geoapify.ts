import { generateLifestyleIsochrones } from '../src/lib/lifestyle/geoapify-engine';
import { extractProfileFromText } from '../src/lib/lifestyle/extractor';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import * as turf from '@turf/turf';

// Load env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
  for (const k in envConfig) process.env[k] = envConfig[k];
}

const TEST_PROFILES = [
  // Vibe Test Profile
  "I like Gracia and Poblenou but I want to have nice bakeries and feel like it's safe around me and where I both wouldn't stick out as a foreigner, but also would be a traditional place that isn't gentrifying too quickly. Gracia rent is increasing but there might be other areas in the city that feel similar and are cheaper and up and coming. I am moving to Barcelona from London and saw how Hackney suddenly became safer and got gentrified but some parts of it were pristine. I want to be able to get to the sea with a moped easily and to the national park and to the tennis courts in the hills, and also I want to be able to access Montjuic Municipal Pool easily. I am willing to commute 25 minutes on a moped to The Cover or another nice coworking space. Also, I want to be near an Italian sandwich shop where I work (the coworking space) as I like paninis for lunch."
];

// const OLD_TEST_PROFILES = [
//   "I'm an investment banker working at Torre Espacio in Madrid's business district. My days are long, so I need my commute to be seamless—ideally a short walk or a very quick metro ride, absolutely under 20 minutes door-to-door. Fitness is non-negotiable for me; I need a high-end gym (like a Holmes Place or Metropolitan) within a 5-minute walk of my apartment so I can squeeze in a workout before heading to the office. I also travel frequently for business, so being on a direct line to the airport or Chamartin station is a huge plus. On weekends, I enjoy fine dining, so I'd love to be near some top-rated restaurants, but I prefer a quiet, upscale neighborhood to sleep in, avoiding the noisy late-night bar scenes.",
//   
//   "We are a young couple with a newborn baby looking for our first family home. One of us works at Ciudad Financiera Santander in Boadilla and drives, so we need easy access to the M-50 or A-6, with a commute under 30 minutes. The other works remotely but needs a vibrant environment to step out for coffee, so a high walkability score is important. Our top priority is proximity to green spaces—Retiro or Casa de Campo would be a dream, but any large park within a 10-minute stroller walk is essential. We also need to be close to a 24-hour pharmacy and a pediatrician. We prefer a safe, residential vibe over a party area.",
//
//   "I'm a freelance graphic designer who thrives on energy and chaos. I want to be in the heart of Malasaña or Chueca, surrounded by vintage shops, cool cafes, and art galleries. I don't own a car and rely entirely on walking or the metro. I need a coworking space within a 10-minute walk because I can't focus at home. My social life revolves around live music and craft beer, so being near venues and bars is a must. However, I do need a decent supermarket nearby (Mercadona or similar) because I cook a lot to save money. Budget isn't huge, but location is everything.",
//
//   "I am a professor at IE Business School on Maria de Molina. I value efficiency and intellect. I want to walk to work in under 15 minutes. I spend my evenings reading and writing, so I need a very quiet apartment, ideally on a high floor or facing a courtyard. Proximity to a good library or a quiet bookstore with a cafe is highly desirable. I swim for exercise, so a municipal pool or a gym with a pool within 20 minutes is required. I don't care about nightlife, but I do appreciate a good bakery for my morning routine.",
//
//   "Digital nomad moving to Madrid for a year. I work US hours, so I'm up late. I need a safe area to walk my dog at night. Being near a dog park is the number one priority—max 5 mins walk. I love the Salamanca district for its safety and beauty. I plan to explore Spain on weekends, so being near Atocha station (max 15 mins by metro/bus) is important. I need a specialized pet store nearby. I'm vegan, so having vegan-friendly restaurants or organic markets in the neighborhood would be amazing.",
//
//   "Medical resident at Hospital La Paz. I work crazy shifts and need to prioritize sleep and convenience. I need to be within a 15-minute commute to the hospital, ideally by metro line 10. I don't have time to cook, so I need plenty of healthy takeout options or a 'menu del dia' place nearby. A 24-hour gym is essential for my irregular schedule. I want a modern, functional apartment—no old buildings with plumbing issues. A quiet area is preferred, but safety coming home late is key.",
//
//   "Retired architect from London moving to Madrid to enjoy the art and culture. I want to be within walking distance (20 mins) of the Prado, Thyssen, or Reina Sofia museums. I enjoy sketching in plazas, so being near Plaza de Santa Ana or similar beautiful squares is a plus. I have some mobility issues, so I need a flat area or one with good bus connections, avoiding steep hills. I need a high-quality market (Mercado) nearby to buy fresh produce. I prefer the historic center but away from the main tourist traps.",
//   
//   "Tech startup founder setting up an office in Azca. I bike to work and refuse to take the metro. I need a safe cycling route to Azca, max 20 mins. I'm a climbing enthusiast and need a bouldering gym nearby to decompress. I host a lot of dinner parties, so a large living space is more important than the neighborhood prestige, but I need a gourmet grocery store nearby. I'm single and enjoy the nightlife, so being near Ponzano street for after-work drinks would be ideal.",
//   
//   "Student at Complutense University. On a tight budget. I need to commute to the Moncloa campus in under 30 minutes by bus or metro. I share a flat with 3 others, so I need to escape to a cheap library or study cafe nearby. Cheap nightlife is a plus—near Arguelles or Moncloa is fine. I need a cheap supermarket (Dia/Lidl) within walking distance. I play basketball, so being near a public court is a nice-to-have.",
//   
//   "The ultimate intersection test: I work at the airport (Barajas, T4) and need to drive there in under 20 mins. My partner works at the Kio Towers (Plaza Castilla) and needs to get there by public transport in under 25 mins. We want a spot that satisfies BOTH. This should create two distinct isochrones that overlap in a specific area (like Hortaleza or Valdebebas).",
//
//   "STRESS TEST (10 Anchors): I need to be within 20 mins driving of ALL these Madrid landmarks: 1. Puerta del Sol, 2. Retiro Park, 3. Atocha Station, 4. Plaza de Castilla, 5. Santiago Bernabeu Stadium, 6. Royal Palace of Madrid, 7. Temple of Debod, 8. Matadero Madrid, 9. Wizink Center, 10. Lago Casa de Campo. Finding a spot that satisfies all 10 might be impossible (empty sweet spot), but I want to see all 10 isochrones on the map.",
//
//   "TIGHT STRESS TEST: I am extremely lazy and want everything within a 5 MINUTE WALK. I work at Callao, my gym is at Opera, and my favorite bar is at Plaza Mayor. I need to live somewhere where I can walk to ALL three of these places in under 5 minutes. This should produce tiny, precise isochrones and a very small (or possibly zero) sweet spot."
// ];

async function runGeoapifyTest() {
  console.log(`🚀 Starting Geoapify Test with ${TEST_PROFILES.length} profiles...`);
  const results: any[] = [];

  for (let i = 0; i < TEST_PROFILES.length; i++) {
    const text = TEST_PROFILES[i];
    console.log(`\nProcessing Profile ${i + 1}: "${text.substring(0, 50)}..."`);
    
    try {
      const profile = await extractProfileFromText(text);
      
      // Safety check: ensure anchors exist and have valid lat/lng
      // The extractor might fail to geocode sometimes.
      const validAnchors = profile.anchors.filter(a => a.location && a.location.lat && a.location.lng);
      if (validAnchors.length === 0) {
          console.warn('  ⚠️ No valid anchors found (geocoding failed?). Skipping.');
          // Fallback for testing: Inject a default anchor if none found
          // profile.anchors = [{ location: { lat: 40.4168, lng: -3.7038, address: "Madrid" }, type: "work", transport_mode: "transit", max_duration_minutes: 20 }];
          continue;
      }
      profile.anchors = validAnchors;

      console.log('  - Generating Isochrones...');
      const mapData = await generateLifestyleIsochrones(profile);
      
      let sweetSpotAreaKm2 = 0;
      if (mapData.sweetSpot) {
        const areaSqM = turf.area(mapData.sweetSpot);
        sweetSpotAreaKm2 = Math.round((areaSqM / 1000000) * 100) / 100; // Round to 2 decimals
      }

      results.push({
        id: i + 1,
        input_text: text,
        profile,
        mapData, // This contains { sweetSpot, anchors } geojson
        stats: {
            sweetSpotAreaKm2,
            anchorsCount: mapData.anchors.length
        },
        type: 'geojson' // Flag for frontend
      });
      
      console.log(`  ✅ Done. Sweet Spot Area: ${sweetSpotAreaKm2} km²`);
      
    } catch (err: any) {
      console.error(`  ❌ Failed: ${err.message}`);
    }
    
    // Geoapify rate limit is generous (5 req/sec), but let's be nice.
    await new Promise(r => setTimeout(r, 500));
  }

  const outputPath = path.resolve(process.cwd(), 'src/data/lifestyle-test-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to ${outputPath}`);
}

runGeoapifyTest();
