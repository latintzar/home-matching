/**
 * Download static Barcelona map from Mapbox
 * Run: npx tsx scripts/download-barcelona-map.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as dotenv from 'dotenv';

// Recipient configuration is supplied by tools/runtime-env.py.
// Mapbox token from env (leo.casa account)
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

if (!MAPBOX_TOKEN) {
  console.error('❌ Missing NEXT_PUBLIC_MAPBOX_TOKEN in .env.local');
  process.exit(1);
}

// Barcelona center coordinates
const config = {
  lng: 2.1734,
  lat: 41.3851,
  zoom: 12,
  width: 800,
  height: 600,
  style: 'mapbox/light-v11', // Clean, minimal style
  retina: true, // @2x for crisp display
};

const url = `https://api.mapbox.com/styles/v1/${config.style}/static/${config.lng},${config.lat},${config.zoom},0/${config.width}x${config.height}${config.retina ? '@2x' : ''}?access_token=${MAPBOX_TOKEN}`;

const outputDir = path.join(process.cwd(), 'public/images/landing');
const outputPath = path.join(outputDir, 'barcelona-map-base.png');

// Ensure directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`📁 Created directory: ${outputDir}`);
}

console.log('🗺️  Downloading Barcelona map from Mapbox...');
console.log(`   Center: ${config.lat}, ${config.lng}`);
console.log(`   Zoom: ${config.zoom}`);
console.log(`   Size: ${config.width}x${config.height}${config.retina ? ' @2x' : ''}`);

const file = fs.createWriteStream(outputPath);

https.get(url, (response) => {
  if (response.statusCode !== 200) {
    console.error(`❌ Failed to download: HTTP ${response.statusCode}`);
    process.exit(1);
  }

  response.pipe(file);

  file.on('finish', () => {
    file.close();
    const stats = fs.statSync(outputPath);
    console.log(`✅ Saved to: ${outputPath}`);
    console.log(`   Size: ${(stats.size / 1024).toFixed(1)} KB`);
  });
}).on('error', (err) => {
  fs.unlink(outputPath, () => {}); // Delete partial file
  console.error('❌ Download error:', err.message);
  process.exit(1);
});
