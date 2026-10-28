import { generateLifestylePolygon } from '../src/lib/lifestyle/engine';
import { extractProfileFromText } from '../src/lib/lifestyle/extractor';
import { LifestyleProfile, HexScore } from '../src/types/lifestyle';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
  console.log('Loaded .env.local');
}

// Ensure API Key is present in process.env for the engine to pick up
if (!process.env.GOOGLE_MAPS_API_KEY && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    process.env.GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

// Manually verify API key presence and propagate it
const apiKey = process.env.GOOGLE_MAPS_API_KEY;
if (apiKey) {
    // The issue might be that the imported module doesn't see the env var if it's not set when module loads
    // But in TSX/Node, imports are usually evaluated at start.
    // However, let's make sure the environment is set BEFORE we call the function
    process.env.GOOGLE_MAPS_API_KEY = apiKey;
    // Also set it for the next-public one just in case
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = apiKey;
}

// Fallback environment setup
if (!process.env.GOOGLE_CLOUD_PROJECT_ID) process.env.GOOGLE_CLOUD_PROJECT_ID = 'fifth-incentive-471523-b1';
if (!process.env.GOOGLE_CLOUD_LOCATION) process.env.GOOGLE_CLOUD_LOCATION = 'us-central1';

const TEST_PROFILES = [
  "I'm an investment banker working at Torre Espacio in Madrid's business district. My days are long, so I need my commute to be seamless—ideally a short walk or a very quick metro ride, absolutely under 20 minutes door-to-door. Fitness is non-negotiable for me; I need a high-end gym (like a Holmes Place or Metropolitan) within a 5-minute walk of my apartment so I can squeeze in a workout before heading to the office. I also travel frequently for business, so being on a direct line to the airport or Chamartin station is a huge plus. On weekends, I enjoy fine dining, so I'd love to be near some top-rated restaurants, but I prefer a quiet, upscale neighborhood to sleep in, avoiding the noisy late-night bar scenes.",

  "I'm a master's student at IE Business School on Maria de Molina. I spend most of my time on campus, so I want to walk to class in under 15 minutes. I'm on a student budget but I'm a foodie, so I'm looking for a vibrant area with lots of affordable, authentic tapas bars and cheap eats—not tourist traps. A good public library or a quiet study-friendly cafe nearby is essential for exam season. I don't have a car, so I rely entirely on walking and public transport. I love running, so being close to a park where I can jog in the mornings would be amazing. I'd prefer a lively neighborhood with a younger crowd.",

  "We are a young family with two children (ages 5 and 8). My partner works at Ciudad Financiera Santander in Boadilla, and I work remotely from home. We need a driving commute for my partner that is consistently under 30 minutes, even with traffic. The absolute priority is schools—we need to be within walking distance of a reputable bilingual or international primary school. We also need plenty of green space; a large park with playgrounds is a must-have for the weekends. We prefer a safe, quiet suburban feel over the city center hustle. A nearby Mercadona or Carrefour for weekly grocery runs is also important.",

  "I'm a freelance graphic designer who works entirely from home, but I can't stand being cooped up all day. I absolutely love Retiro Park—it's my sanctuary. I want to live within a 10-minute leisurely walk of any of the park's entrances. Since I work from home, I don't have a commute, but I do need a variety of 'third places' to work from occasionally—cool coworking spaces or laptop-friendly specialty coffee shops are a must. I'm a vegetarian, so having a good organic market or health food store nearby is important to me. I get around by bike, so bike lanes or bike-friendly streets are a big plus.",

  "I'm an ER nurse at Hospital La Paz. My shifts are erratic—sometimes I finish late at night or start very early in the morning. Safety is my number one concern; I need a neighborhood that feels secure walking alone at odd hours. I'd prefer a very short metro or bus commute (max 20 mins) or even walking if possible. Because of my schedule, I rely on convenience: a 24-hour pharmacy and a supermarket with extended hours nearby are lifesavers. I value peace and quiet when I'm off-shift, so I want to avoid loud nightlife areas. A cozy bakery for my morning coffee would be a nice bonus.",

  "Tech worker relocating to Madrid to work at Google (Torre Picasso). I'm an avid cyclist and I refuse to take the metro. I want to cycle to work in under 20 minutes, so I need a location that has safe cycling routes to Azca. My lifestyle revolves around climbing and coffee. I need a bouldering gym within a 15-minute cycle or walk, and I'm obsessed with specialty coffee, so I need at least one top-tier roaster or cafe nearby. I'm single and enjoy a bit of nightlife, specifically craft beer bars and indie music venues, but I don't want to live strictly in a party zone.",

  "We are a retired couple from the US looking to spend our golden years in Madrid. We fell in love with the historic charm of the Opera and Palacio Real area. We want to be right in the thick of it—walking distance (max 10 mins) to the Opera House and the Royal Palace. We don't drive, so we need a highly walkable neighborhood with flat streets if possible. We enjoy culture, so being near theaters and museums is a priority. We also need a high-quality fresh food market nearby where we can buy daily produce. We prefer a classic, historic building but with modern amenities like an elevator.",

  "I work in sales and travel constantly by train, so I need to be near Atocha Station. My ideal commute to the station is a walk of less than 15 minutes so I never miss a train. When I'm in town, I'm all about efficiency. I need a well-stocked supermarket and a solid commercial gym (with free weights) within a 5-minute radius of my apartment—I don't want to waste time traveling to chores. I'm not too fussy about 'vibe' or aesthetics, I just want practical convenience and good transport links to the rest of the city for meetings.",

  "I'm a visual artist looking for a live-work studio space. I feel most inspired near Matadero Madrid and the river. I want to be within walking or cycling distance of the Matadero cultural center. I need a neighborhood that feels gritty and authentic, not polished or gentrified. Art supply stores and hardware stores nearby are important for my work. I also love the social scene of dive bars and underground music venues, so having those nearby is a 'nice to have'. I mostly get around by walking or cargo bike.",

  "I'm a young lawyer working at a firm near Cuzco. I work long hours and often finish late. I want a short commute, max 20 minutes by metro or taxi. When I'm finally off the clock, I want to blow off steam. I'm looking for a high-energy neighborhood with a vibrant nightlife—cocktail bars, clubs, and trendy restaurants are a must. I want to be able to walk out of my door and be in the middle of the action. A dry cleaner and a tailor nearby are essential for keeping my work wardrobe in check. I don't cook much, so plenty of delivery options or takeout places are important."
];

interface TestResult {
  id: number;
  input_text: string;
  profile: LifestyleProfile;
  hexes: HexScore[];
  top_hex_score: number;
  reachable_hex_count: number;
}

async function runBulkTest() {
  console.log(`🚀 Starting Bulk Test with ${TEST_PROFILES.length} profiles...`);
  console.log(`🔑 API Key Check: ${process.env.GOOGLE_MAPS_API_KEY ? 'Present' : 'MISSING'}`);
  
  const results: TestResult[] = [];

  for (let i = 0; i < TEST_PROFILES.length; i++) {
    const text = TEST_PROFILES[i];
    console.log(`\nProcessing Profile ${i + 1}/${TEST_PROFILES.length}: "${text.substring(0, 50)}..."`);
    
    try {
      // 1. Extract
      console.log('  - Extracting...');
      const profile = await extractProfileFromText(text);
      
      // 2. Generate Polygon
      console.log('  - Generating Map...');
      const hexes = await generateLifestylePolygon(profile);
      
      results.push({
        id: i + 1,
        input_text: text,
        profile,
        hexes,
        top_hex_score: hexes.length > 0 ? hexes[0].scores.total : 0,
        reachable_hex_count: hexes.length
      });
      
      console.log(`  ✅ Done. ${hexes.length} reachable hexes.`);
      
    } catch (err: any) {
      console.error(`  ❌ Failed: ${err.message}`);
    }
    
    // Small delay to be nice to APIs
    await new Promise(r => setTimeout(r, 1000));
  }

  // Save results to a JSON file for the frontend to read
  const outputPath = path.resolve(process.cwd(), 'src/data/lifestyle-test-results.json');
  
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 All results saved to ${outputPath}`);
}

runBulkTest();
