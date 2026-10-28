/**
 * Import AllThePlaces POIs (Spain only) to DynamoDB
 * 
 * Source: https://alltheplaces.xyz/ (global GeoJSON, ~22M POIs)
 * Filters: country_code = "ES" or coordinates within Spain bbox
 * 
 * Target: leo-atp-pois DynamoDB table
 * 
 * Usage: npx tsx scripts/geo/import-alltheplaces.ts [--dry-run] [--limit 1000]
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import Geohash from 'ngeohash';
import { execSync } from 'child_process';

// Config
const TABLE_NAME = 'leo-atp-pois';
const DATA_DIR = path.join(process.cwd(), 'data/geo/alltheplaces');
const ZIP_FILE = path.join(DATA_DIR, 'output.zip');
const GEOJSON_FILE = path.join(DATA_DIR, 'output.geojson');
const BATCH_SIZE = 25;

// Spain bounding box (including Canary Islands)
const SPAIN_BBOX = {
  minLng: -18.5,  // Canary Islands west
  maxLng: 4.5,    // Catalonia east
  minLat: 27.5,   // Canary Islands south
  maxLat: 43.8    // Galicia north
};

// CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');

// AWS setup
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

interface ATPFeature {
  type: 'Feature';
  id: string;
  properties: {
    '@spider': string;
    ref?: string;
    name?: string;
    brand?: string;
    'brand:wikidata'?: string;
    addr_full?: string;
    addr_city?: string;
    addr_state?: string;
    addr_postcode?: string;
    addr_country?: string;
    phone?: string;
    website?: string;
    opening_hours?: string;
    [key: string]: unknown;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
}

// Check if point is in Spain
function isInSpain(feature: ATPFeature): boolean {
  // Check country code first
  const country = feature.properties.addr_country?.toUpperCase();
  if (country === 'ES' || country === 'ESP' || country === 'SPAIN' || country === 'ESPAÑA') {
    return true;
  }
  
  // Fall back to bounding box check
  if (feature.geometry?.type === 'Point') {
    const [lng, lat] = feature.geometry.coordinates;
    return (
      lng >= SPAIN_BBOX.minLng &&
      lng <= SPAIN_BBOX.maxLng &&
      lat >= SPAIN_BBOX.minLat &&
      lat <= SPAIN_BBOX.maxLat
    );
  }
  
  return false;
}

// Config for extracted files
const OUTPUT_DIR = path.join(DATA_DIR, 'output');

// Extract zip if needed
function extractZip(): void {
  if (fs.existsSync(OUTPUT_DIR) && fs.readdirSync(OUTPUT_DIR).length > 0) {
    console.log('📦 GeoJSON already extracted');
    return;
  }
  
  if (!fs.existsSync(ZIP_FILE)) {
    throw new Error(`ZIP file not found: ${ZIP_FILE}`);
  }
  
  console.log('📦 Extracting ZIP file...');
  execSync(`cd "${DATA_DIR}" && unzip -o output.zip`, { stdio: 'inherit' });
}

// Write batch to DynamoDB
async function writeBatch(items: Record<string, unknown>[]): Promise<void> {
  if (DRY_RUN) return;
  
  const requests = items.map(item => ({
    PutRequest: { Item: item }
  }));
  
  try {
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: requests
      }
    }));
  } catch (error) {
    console.error('❌ Batch write failed:', error);
    throw error;
  }
}

// Process individual GeoJSON files
async function importAllThePlaces(): Promise<void> {
  console.log('🚀 AllThePlaces Import Script (Spain)');
  console.log(`   Table: ${TABLE_NAME}`);
  console.log(`   Dry run: ${DRY_RUN}`);
  if (LIMIT) console.log(`   Limit: ${LIMIT.toLocaleString()}`);
  console.log('');
  
  // Extract if needed
  extractZip();
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    throw new Error(`Output directory not found: ${OUTPUT_DIR}`);
  }
  
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.geojson'));
  console.log(`📁 Found ${files.length} GeoJSON files`);
  console.log('📤 Processing and filtering Spain...');
  
  let totalRead = 0;
  let spainPOIs = 0;
  let imported = 0;
  let filesProcessed = 0;
  let batch: Record<string, unknown>[] = [];
  const seenKeys = new Set<string>();
  let limitReached = false;
  
  for (const file of files) {
    if (limitReached) break;
    
    filesProcessed++;
    const filePath = path.join(OUTPUT_DIR, file);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const features: ATPFeature[] = data.features || [];
      
      for (const feature of features) {
        if (limitReached) break;
        totalRead++;
        
        if (isInSpain(feature) && feature.geometry?.coordinates) {
          spainPOIs++;
          
          const [lng, lat] = feature.geometry.coordinates;
          if (typeof lat !== 'number' || typeof lng !== 'number') continue;
          
          const geohash = Geohash.encode(lat, lng, 7);
          const featureId = feature.id || `${file}-${totalRead}`;
          
          // Ensure unique SK
          let sk = `${geohash}#${featureId}`;
          let counter = 0;
          while (seenKeys.has(sk)) {
            counter++;
            sk = `${geohash}#${featureId}-${counter}`;
          }
          seenKeys.add(sk);
          
          const item = {
            PK: geohash.substring(0, 4),
            SK: sk,
            id: featureId,
            spider: feature.properties['@spider'],
            name: feature.properties.name || null,
            brand: feature.properties.brand || null,
            brandWikidata: feature.properties['brand:wikidata'] || null,
            address: feature.properties.addr_full || null,
            city: feature.properties.addr_city || null,
            postcode: feature.properties.addr_postcode || null,
            phone: feature.properties.phone || null,
            website: feature.properties.website || null,
            openingHours: feature.properties.opening_hours || null,
            lat,
            lng,
            geohash,
            importedAt: new Date().toISOString()
          };
          
          batch.push(item);
          
          if (batch.length >= BATCH_SIZE) {
            await writeBatch(batch);
            imported += batch.length;
            batch = [];
          }
          
          if (LIMIT && spainPOIs >= LIMIT) {
            console.log(`\n   Reached limit of ${LIMIT}`);
            limitReached = true;
          }
        }
      }
      
      // Progress update every 100 files
      if (filesProcessed % 100 === 0) {
        process.stdout.write(`\r   Files: ${filesProcessed}/${files.length} | Read: ${totalRead.toLocaleString()} | Spain: ${spainPOIs.toLocaleString()} | Imported: ${imported.toLocaleString()}`);
      }
      
    } catch (e) {
      // Skip malformed files
    }
  }
  
  // Write remaining batch
  if (batch.length > 0) {
    await writeBatch(batch);
    imported += batch.length;
  }
  
  console.log('');
  console.log('');
  console.log('✅ Import complete!');
  console.log(`   Files processed: ${filesProcessed.toLocaleString()}`);
  console.log(`   Total read: ${totalRead.toLocaleString()}`);
  console.log(`   Spain POIs found: ${spainPOIs.toLocaleString()}`);
  console.log(`   Imported: ${imported.toLocaleString()}`);
  
  if (DRY_RUN) {
    console.log('');
    console.log('⚠️  DRY RUN - no data was actually written');
  }
}

// Run
importAllThePlaces().catch(console.error);
