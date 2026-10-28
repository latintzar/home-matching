import { generateLifestylePolygon } from '../src/lib/lifestyle/engine';
import { extractProfileFromText } from '../src/lib/lifestyle/extractor';
import { LifestyleProfile } from '../src/types/lifestyle';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  console.log('Loading environment from .env.local');
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
} else {
    console.warn('⚠️ .env.local not found. API calls may fail.');
}

// Fallback for testing if specific keys are missing but Project ID is there
if (!process.env.GOOGLE_CLOUD_PROJECT_ID) process.env.GOOGLE_CLOUD_PROJECT_ID = 'fifth-incentive-471523-b1';
if (!process.env.GOOGLE_CLOUD_LOCATION) process.env.GOOGLE_CLOUD_LOCATION = 'us-central1';

async function runTest() {
  const testText = "I work at Puerta del Sol in Madrid (approx 40.4169, -3.7035). I want to commute by metro, max 25 minutes. I really need a specialty coffee shop nearby (must have) and a gym (nice to have).";
  
  console.log('--- STEP 1: EXTRACT PROFILE ---');
  console.log('Input:', testText);
  
  let profile: LifestyleProfile;
  
  try {
      profile = await extractProfileFromText(testText);
      console.log('✅ Extracted Profile:', JSON.stringify(profile, null, 2));
  } catch (err) {
      console.error('⚠️ Extraction failed:', err);
      console.log('ℹ️ Using Fallback Profile for Step 2...');
      profile = {
        anchors: [
          {
            location: { lat: 40.4169, lng: -3.7035, address: 'Puerta del Sol, Madrid' },
            type: 'work',
            transport_mode: 'transit',
            max_duration_minutes: 25,
            frequency_per_week: 5
          }
        ],
        vibe: [
          { amenity_type: 'specialty_coffee', importance: 'must_have', specifics: [] },
          { amenity_type: 'gym', importance: 'nice_to_have', specifics: [] }
        ]
      };
  }

  console.log('\n--- STEP 2: GENERATE POLYGON ---');
  
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && !process.env.GOOGLE_MAPS_API_KEY) {
      console.warn('⚠️ Google Maps API Key missing. Skipping real polygon generation.');
      return;
  }

  try {
      const hexes = await generateLifestylePolygon(profile);
      console.log(`✅ Generated ${hexes.length} reachable hexes.`);
      
      if (hexes.length > 0) {
          console.log('Top Hex:', JSON.stringify(hexes[0], null, 2));
      } else {
          console.warn('⚠️ No reachable hexes found. This might be due to API limits or strict constraints.');
      }
  } catch (err) {
      console.error('❌ Polygon Generation Failed:', err);
  }
}

runTest();
