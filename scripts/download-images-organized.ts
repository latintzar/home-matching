/**
 * Download all before and after images organized by tier and cluster
 * Includes T6.5 target states for each cluster
 * 
 * Usage: npx tsx scripts/download-images-organized.ts <listingId>
 * Example: npx tsx scripts/download-images-organized.ts 1000000121
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as dotenv from 'dotenv';

// Load environment variables
// Recipient configuration is supplied by tools/runtime-env.py.
// Recipient configuration is supplied by tools/runtime-env.py.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function downloadImage(url: string, filepath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const file = fs.createWriteStream(filepath);
    
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        console.error(`  ❌ Failed to download ${url}: ${response.statusCode}`);
        file.close();
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
        resolve(false);
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(true);
      });
    }).on('error', (err) => {
      console.error(`  ❌ Error downloading ${url}:`, err.message);
      file.close();
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      resolve(false);
    });
  });
}

async function main() {
  const listingId = process.argv[2];
  
  if (!listingId) {
    console.error('❌ Please provide a listing ID');
    console.log('Usage: npx tsx scripts/download-images-organized.ts <listingId>');
    process.exit(1);
  }

  console.log(`📥 Downloading organized images for listing ${listingId}...\n`);

  // Create download directory
  const downloadDir = path.join(process.cwd(), 'downloads', listingId, 'organized');
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  // 1. Get furniture-free photos map
  console.log('🏗️ Fetching furniture-free photos map...');
  const { data: furnitureFreePhotos } = await supabase
    .from('listing_photos_furniture_free')
    .select('original_photo_url, furniture_free_url')
    .eq('listing_id', listingId);

  const furnitureFreeMap = new Map(
    furnitureFreePhotos?.map(f => [f.original_photo_url, f.furniture_free_url]) || []
  );
  console.log(`  Found ${furnitureFreeMap.size} furniture-free photos\n`);

  // 2. Get after photos organized by tier and room_id
  console.log('🎨 Fetching after photos...');
  const { data: afterPhotos, error: afterError } = await supabase
    .from('after_photos')
    .select('id, tier, room_id, photo_url, url, has_furniture')
    .eq('listing_id', listingId)
    .eq('has_furniture', false); // Only unfurnished

  if (afterError) {
    console.error('❌ Error fetching after photos:', afterError.message);
    return;
  }

  console.log(`  Found ${afterPhotos?.length || 0} unfurnished after photos\n`);

  // 3. Get T6.5 target states
  console.log('📋 Fetching T6.5 target states...');
  const { data: targetStates, error: targetError } = await supabase
    .from('e2_tier_target_states')
    .select('tier, room_id, target_state')
    .eq('listing_id', listingId);

  if (targetError) {
    console.error('❌ Error fetching target states:', targetError.message);
  } else {
    console.log(`  Found ${targetStates?.length || 0} target states\n`);
  }

  // Map between UI tier names and database tier names
  const tierNameMap: Record<string, string> = {
    'livable': 'estandar',
    'comfortable': 'optimo',
    'competitive': 'plus'
  };
  const reverseTierMap: Record<string, string> = {
    'estandar': 'livable',
    'optimo': 'comfortable',
    'plus': 'competitive'
  };

  // Create a map of UI tier -> room_id -> target state
  const targetStatesMap = new Map<string, Map<string, any>>();
  for (const state of targetStates || []) {
    const uiTier = reverseTierMap[state.tier] || state.tier;
    if (!targetStatesMap.has(uiTier)) {
      targetStatesMap.set(uiTier, new Map());
    }
    targetStatesMap.get(uiTier)!.set(state.room_id, state.target_state);
  }

  // 4. Organize by tier and cluster
  const tiers = ['livable', 'comfortable', 'competitive'];

  for (const tier of tiers) {
    console.log(`\n📁 Processing tier: ${tier}`);
    const tierDir = path.join(downloadDir, tier);
    if (!fs.existsSync(tierDir)) {
      fs.mkdirSync(tierDir, { recursive: true });
    }

    const tierAfterPhotos = afterPhotos?.filter(p => p.tier === tier) || [];
    
    // Group by room_id (cluster)
    const clustersMap = new Map<string, typeof tierAfterPhotos>();
    for (const photo of tierAfterPhotos) {
      const roomId = photo.room_id;
      if (!clustersMap.has(roomId)) {
        clustersMap.set(roomId, []);
      }
      clustersMap.get(roomId)!.push(photo);
    }

    console.log(`  Found ${clustersMap.size} clusters`);

    // Process each cluster
    for (const [roomId, clusterPhotos] of clustersMap.entries()) {
      const clusterDir = path.join(tierDir, roomId);
      if (!fs.existsSync(clusterDir)) {
        fs.mkdirSync(clusterDir, { recursive: true });
      }

      // Get the first photo (they should all have the same photo_url for before)
      const firstPhoto = clusterPhotos[0];
      const beforePhotoUrl = firstPhoto.photo_url;
      const afterPhotoUrl = firstPhoto.url;

      if (!beforePhotoUrl || !afterPhotoUrl) {
        console.log(`  ⚠️  Skipping ${roomId}: missing URLs`);
        continue;
      }

      // Get furniture-free before photo
      const furnitureFreeUrl = furnitureFreeMap.get(beforePhotoUrl);
      const beforeUrl = furnitureFreeUrl || beforePhotoUrl;

      // Download before (unfurnished)
      const beforeFilename = 'before_unfurnished.jpg';
      const beforeFilepath = path.join(clusterDir, beforeFilename);
      const beforeDownloaded = await downloadImage(beforeUrl, beforeFilepath);
      
      if (beforeDownloaded) {
        console.log(`  ✅ ${roomId}/before_unfurnished.jpg`);
      }

      // Download after (unfurnished)
      const afterFilename = 'after_unfurnished.jpg';
      const afterFilepath = path.join(clusterDir, afterFilename);
      const afterDownloaded = await downloadImage(afterPhotoUrl, afterFilepath);
      
      if (afterDownloaded) {
        console.log(`  ✅ ${roomId}/after_unfurnished.jpg`);
      }

      // Save target state
      const tierTargetStates = targetStatesMap.get(tier);
      if (tierTargetStates) {
        const targetState = tierTargetStates.get(roomId);
        if (targetState) {
          // Save as JSON
          const targetStateFilepath = path.join(clusterDir, 'target_state.json');
          fs.writeFileSync(targetStateFilepath, JSON.stringify(targetState, null, 2));
          
          // Also save as readable text
          const targetStateTextFilepath = path.join(clusterDir, 'target_state.txt');
          const textContent = formatTargetState(targetState, roomId, tier);
          fs.writeFileSync(targetStateTextFilepath, textContent);
          
          console.log(`  ✅ ${roomId}/target_state.json & .txt`);
        }
      }
    }
  }

  console.log(`\n✅ All images organized in: ${downloadDir}`);
  console.log('\nDirectory structure:');
  console.log(`  ${downloadDir}/`);
  for (const tier of tiers) {
    console.log(`    ${tier}/`);
    console.log(`      cluster_XX/`);
    console.log(`        before_unfurnished.jpg`);
    console.log(`        after_unfurnished.jpg`);
    console.log(`        target_state.json`);
    console.log(`        target_state.txt`);
  }
}

function formatTargetState(targetState: any, roomId: string, tier: string): string {
  let text = `T6.5 Target State\n`;
  text += `================\n\n`;
  text += `Room ID: ${roomId}\n`;
  text += `Tier: ${tier}\n\n`;
  
  if (Array.isArray(targetState)) {
    text += `Element Decisions (${targetState.length} elements):\n\n`;
    for (const element of targetState) {
      text += `- ${element.element_name || element.name || 'Unknown'}\n`;
      if (element.decision) {
        text += `  Decision: ${element.decision}\n`;
      }
      if (element.tier_target_state) {
        text += `  Target State: ${JSON.stringify(element.tier_target_state, null, 2)}\n`;
      }
      if (element.details) {
        text += `  Details: ${JSON.stringify(element.details, null, 2)}\n`;
      }
      text += `\n`;
    }
  } else if (typeof targetState === 'object') {
    text += `Element Decisions:\n\n`;
    text += JSON.stringify(targetState, null, 2);
  } else {
    text += `Raw Data:\n\n${targetState}`;
  }
  
  return text;
}

main().catch(console.error);

