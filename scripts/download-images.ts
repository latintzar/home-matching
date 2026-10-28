/**
 * Download all before and after images for a listing
 * 
 * Usage: npx tsx scripts/download-images.ts <listingId>
 * Example: npx tsx scripts/download-images.ts 1000000121
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
        fs.unlinkSync(filepath); // Delete empty file
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
    console.log('Usage: npx tsx scripts/download-images.ts <listingId>');
    process.exit(1);
  }

  console.log(`📥 Downloading images for listing ${listingId}...\n`);

  // Create download directory
  const downloadDir = path.join(process.cwd(), 'downloads', listingId);
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  // 1. Get all before photos (original listing photos)
  console.log('📸 Fetching before photos...');
  const { data: listingPhotos, error: photosError } = await supabase
    .from('listing_photos')
    .select('id, url, original_url, filename')
    .eq('listing_id', listingId)
    .order('display_order', { ascending: true });

  if (photosError) {
    console.error('❌ Error fetching listing photos:', photosError.message);
  } else {
    console.log(`  Found ${listingPhotos?.length || 0} listing photos`);
    
    // Download original photos
    const beforeDir = path.join(downloadDir, 'before');
    if (!fs.existsSync(beforeDir)) {
      fs.mkdirSync(beforeDir, { recursive: true });
    }

    const originalDir = path.join(beforeDir, 'original');
    if (!fs.existsSync(originalDir)) fs.mkdirSync(originalDir, { recursive: true });

    let downloaded = 0;
    for (const photo of listingPhotos || []) {
      const originalUrl = photo.original_url || photo.url;
      if (!originalUrl) continue;

      const filename = photo.filename || path.basename(originalUrl).split('?')[0] || `photo_${photo.id}.jpg`;
      const filepath = path.join(originalDir, filename);
      
      if (await downloadImage(originalUrl, filepath)) {
        downloaded++;
        console.log(`  ✅ Downloaded: ${filename}`);
      }
    }
    console.log(`  ✅ Downloaded ${downloaded} original photos`);
  }

  // 1b. Get furniture-free photos
  console.log('\n🏗️ Fetching furniture-free photos...');
  const { data: furnitureFreePhotos, error: ffError } = await supabase
    .from('listing_photos_furniture_free')
    .select('id, original_photo_url, furniture_free_url')
    .eq('listing_id', listingId);

  if (ffError) {
    console.error('❌ Error fetching furniture-free photos:', ffError.message);
  } else {
    console.log(`  Found ${furnitureFreePhotos?.length || 0} furniture-free photos`);
    
    const furnitureFreeDir = path.join(downloadDir, 'before', 'furniture-free');
    if (!fs.existsSync(furnitureFreeDir)) {
      fs.mkdirSync(furnitureFreeDir, { recursive: true });
    }

    let downloaded = 0;
    for (const photo of furnitureFreePhotos || []) {
      if (!photo.furniture_free_url) continue;

      const filename = path.basename(photo.furniture_free_url).split('?')[0] || `furniture_free_${photo.id}.jpg`;
      const filepath = path.join(furnitureFreeDir, filename);
      
      if (await downloadImage(photo.furniture_free_url, filepath)) {
        downloaded++;
        console.log(`  ✅ Downloaded furniture-free: ${filename}`);
      }
    }
    console.log(`  ✅ Downloaded ${downloaded} furniture-free photos\n`);
  }

  // 2. Get all after photos
  console.log('🎨 Fetching after photos...');
  const { data: afterPhotos, error: afterError } = await supabase
    .from('after_photos')
    .select('id, tier, room_id, photo_url, url, has_furniture')
    .eq('listing_id', listingId);

  if (afterError) {
    console.error('❌ Error fetching after photos:', afterError.message);
  } else {
    console.log(`  Found ${afterPhotos?.length || 0} after photos`);

    const afterDir = path.join(downloadDir, 'after');
    if (!fs.existsSync(afterDir)) {
      fs.mkdirSync(afterDir, { recursive: true });
    }

    // Organize by tier
    const tiers = ['livable', 'comfortable', 'competitive'];
    for (const tier of tiers) {
      const tierDir = path.join(afterDir, tier);
      if (!fs.existsSync(tierDir)) {
        fs.mkdirSync(tierDir, { recursive: true });
      }

      const unfurnishedDir = path.join(tierDir, 'unfurnished');
      const furnishedDir = path.join(tierDir, 'furnished');
      
      if (!fs.existsSync(unfurnishedDir)) fs.mkdirSync(unfurnishedDir, { recursive: true });
      if (!fs.existsSync(furnishedDir)) fs.mkdirSync(furnishedDir, { recursive: true });

      const tierPhotos = afterPhotos?.filter(p => p.tier === tier) || [];
      
      let downloaded = 0;
      for (const photo of tierPhotos) {
        if (!photo.url) continue;

        const dir = photo.has_furniture ? furnishedDir : unfurnishedDir;
        const roomId = photo.room_id || 'unknown';
        const filename = `${roomId}_${photo.has_furniture ? 'furnished' : 'unfurnished'}.jpg`;
        const filepath = path.join(dir, filename);

        if (await downloadImage(photo.url, filepath)) {
          downloaded++;
          console.log(`  ✅ Downloaded ${tier}/${photo.has_furniture ? 'furnished' : 'unfurnished'}: ${filename}`);
        }
      }
      console.log(`  ✅ Downloaded ${downloaded} ${tier} after photos`);
    }
    console.log('');
  }

  console.log(`\n✅ All images downloaded to: ${downloadDir}`);
  console.log('\nDirectory structure:');
  console.log(`  ${downloadDir}/`);
  console.log(`    before/`);
  console.log(`      original/`);
  console.log(`      furniture-free/`);
  console.log(`    after/`);
  console.log(`      livable/`);
  console.log(`        unfurnished/`);
  console.log(`        furnished/`);
  console.log(`      comfortable/`);
  console.log(`        unfurnished/`);
  console.log(`        furnished/`);
  console.log(`      competitive/`);
  console.log(`        unfurnished/`);
  console.log(`        furnished/`);
}

main().catch(console.error);

