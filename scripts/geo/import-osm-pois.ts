/**
 * Import OSM POIs to DynamoDB (v3 - FULL SCHEMA)
 * 
 * Source: GeoJSON files extracted by extract-osm-pois.sh
 * Target: leo-osm-pois DynamoDB table
 * 
 * V3 CHANGE: Now captures ALL OSM attributes via ...props spread!
 * This gives Leo Brain access to 289+ attributes including:
 * - sport (tennis, basketball, padel...)
 * - cuisine (japanese, italian, spanish...)
 * - diet:* (vegan, vegetarian, halal, kosher...)
 * - opening_hours
 * - outdoor_seating, indoor_seating
 * - payment:* (cards, cash, bitcoin...)
 * - brand, operator
 * - phone, website, email
 * - addr:* (full address)
 * - And 270+ more!
 * 
 * Usage: npx tsx scripts/geo/import-osm-pois.ts [--dry-run] [--type parks]
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import * as fs from 'fs';
import * as path from 'path';
import Geohash from 'ngeohash';
import * as turf from '@turf/turf';

// Config
const TABLE_NAME = 'leo-osm-pois';
const EXTRACTS_DIR = path.join(process.cwd(), 'data/geo/osm-extracts');
const BATCH_SIZE = 25;

// POI types to import (must match filenames from extract-osm-pois.sh)
const POI_TYPES = [
  // Infrastructure (stable)
  'parks', 'metro', 'beaches', 'schools', 'healthcare', 'playgrounds', 'dog_parks', 'sports_pitches',
  // Businesses (for density scoring)
  'supermarkets', 'cafes', 'bakeries', 'restaurants', 'bars', 'gyms', 'pharmacies'
];

// CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const TYPE_FILTER = args.find(a => a.startsWith('--type='))?.split('=')[1];

// AWS setup
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

interface OSMFeature {
  type: 'Feature';
  id: string;
  properties: {
    name?: string;
    amenity?: string;
    leisure?: string;
    natural?: string;
    shop?: string;
    railway?: string;
    landuse?: string;
    [key: string]: unknown;
  };
  geometry: {
    type: 'Point' | 'Polygon' | 'MultiPolygon' | 'LineString';
    coordinates: number[] | number[][] | number[][][] | number[][][][];
  };
}

// Calculate centroid for different geometry types
function getCentroid(geometry: OSMFeature['geometry']): { lat: number; lng: number } | null {
  if (geometry.type === 'Point') {
    const [lng, lat] = geometry.coordinates as number[];
    return { lat, lng };
  }
  
  if (geometry.type === 'Polygon') {
    const coords = (geometry.coordinates as number[][][])[0];
    let sumLng = 0, sumLat = 0;
    for (const [lng, lat] of coords) {
      sumLng += lng;
      sumLat += lat;
    }
    return { lat: sumLat / coords.length, lng: sumLng / coords.length };
  }
  
  if (geometry.type === 'MultiPolygon') {
    const firstPolygon = (geometry.coordinates as number[][][][])[0][0];
    let sumLng = 0, sumLat = 0;
    for (const [lng, lat] of firstPolygon) {
      sumLng += lng;
      sumLat += lat;
    }
    return { lat: sumLat / firstPolygon.length, lng: sumLng / firstPolygon.length };
  }
  
  if (geometry.type === 'LineString') {
    const coords = geometry.coordinates as number[][];
    const mid = Math.floor(coords.length / 2);
    return { lat: coords[mid][1], lng: coords[mid][0] };
  }
  
  return null;
}

// Calculate area in square meters for polygons
function getAreaM2(geometry: OSMFeature['geometry']): number | null {
  try {
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
      const feature = turf.feature(geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon);
      return Math.round(turf.area(feature));
    }
  } catch {
    // Invalid geometry
  }
  return null;
}

// Check if this is a "notable" POI (has Wikipedia article or is large)
function isNotable(props: OSMFeature['properties'], areaM2: number | null): boolean {
  // Has Wikipedia reference = definitely notable
  if (props.wikidata || props.wikipedia) return true;
  
  // Large area = notable (> 10,000 m² = 1 hectare)
  if (areaM2 && areaM2 > 10000) return true;
  
  return false;
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

// Import a single POI type
async function importPOIType(poiType: string): Promise<number> {
  const filePath = path.join(EXTRACTS_DIR, `${poiType}.geojson`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`   ⚠️  ${poiType}.geojson not found, skipping`);
    return 0;
  }
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const features: OSMFeature[] = data.features || [];
  
  let imported = 0;
  let batch: Record<string, unknown>[] = [];
  const seenKeys = new Set<string>();
  
  for (const feature of features) {
    // Only import named POIs (skip unnamed grass patches, etc.)
    if (!feature.properties.name) continue;
    
    const centroid = getCentroid(feature.geometry);
    if (!centroid) continue;
    
    const geohash = Geohash.encode(centroid.lat, centroid.lng, 7);
    const osmId = feature.id?.toString() || `${poiType}-${imported}`;
    
    // Ensure unique SK within batch
    let sk = `${geohash}#${osmId}`;
    let counter = 0;
    while (seenKeys.has(sk)) {
      counter++;
      sk = `${geohash}#${osmId}-${counter}`;
    }
    seenKeys.add(sk);
    
    // Calculate area for polygons
    const areaM2 = getAreaM2(feature.geometry);
    const props = feature.properties;
    
    // Clean props: remove null, undefined, empty strings (DynamoDB doesn't like them)
    const cleanProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
      if (value !== null && value !== undefined && value !== '') {
        cleanProps[key] = value;
      }
    }
    
    // V3: Spread ALL OSM properties, then override with our computed fields
    const item = {
      // Spread all OSM properties first (sport, cuisine, opening_hours, etc.)
      ...cleanProps,
      
      // Required keys (override any conflicts)
      PK: poiType,
      SK: sk,
      osmId,
      type: poiType,
      lat: centroid.lat,
      lng: centroid.lng,
      geohash,
      
      // Computed fields
      areaM2: areaM2,
      notable: isNotable(props, areaM2),
      importedAt: new Date().toISOString()
    };
    
    batch.push(item);
    
    if (batch.length >= BATCH_SIZE) {
      await writeBatch(batch);
      imported += batch.length;
      batch = [];
      
      // Progress every 500 items
      if (imported % 500 === 0) {
        process.stdout.write(`\r   ${poiType}: ${imported.toLocaleString()} / ${features.length.toLocaleString()} (${Math.round(imported/features.length*100)}%)`);
      }
    }
  }
  
  if (batch.length > 0) {
    await writeBatch(batch);
    imported += batch.length;
  }
  
  console.log(`\r   ${poiType}: ${imported.toLocaleString()} / ${features.length.toLocaleString()} (100%)`);
  return imported;
}

// Main import function
async function importOSMPOIs(): Promise<void> {
  console.log('🚀 OSM POIs Import Script');
  console.log(`   Table: ${TABLE_NAME}`);
  console.log(`   Dry run: ${DRY_RUN}`);
  if (TYPE_FILTER) console.log(`   Type filter: ${TYPE_FILTER}`);
  console.log('');
  
  if (!fs.existsSync(EXTRACTS_DIR)) {
    console.error(`❌ Extracts directory not found: ${EXTRACTS_DIR}`);
    console.error('   Run extract-osm-pois.sh first');
    process.exit(1);
  }
  
  const typesToImport = TYPE_FILTER ? [TYPE_FILTER] : POI_TYPES;
  let totalImported = 0;
  
  for (const poiType of typesToImport) {
    process.stdout.write(`📤 Importing ${poiType}...`);
    const count = await importPOIType(poiType);
    console.log(` ${count.toLocaleString()} items`);
    totalImported += count;
  }
  
  console.log('');
  console.log('✅ Import complete!');
  console.log(`   Total imported: ${totalImported.toLocaleString()}`);
  
  if (DRY_RUN) {
    console.log('');
    console.log('⚠️  DRY RUN - no data was actually written');
  }
}

// Run
importOSMPOIs().catch(console.error);
