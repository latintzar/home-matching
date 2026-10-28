/**
 * Import OSM Barrio Boundaries to DynamoDB
 * 
 * Source: barrios.geojson extracted by extract-osm-pois.sh (admin_level=10)
 * Target: leo-neighborhood-boundaries DynamoDB table
 * 
 * Usage: npx tsx scripts/geo/import-osm-barrios.ts [--dry-run]
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import * as fs from 'fs';
import * as path from 'path';
import Geohash from 'ngeohash';

// Config
const TABLE_NAME = 'leo-neighborhood-boundaries';
const GEOJSON_FILE = path.join(process.cwd(), 'data/geo/osm-extracts/barrios.geojson');
const BATCH_SIZE = 25;

// CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

// AWS setup
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

interface BarrioFeature {
  type: 'Feature';
  id: string;
  properties: {
    name?: string;
    'name:es'?: string;
    'name:ca'?: string;
    admin_level?: string;
    boundary?: string;
    wikidata?: string;
    wikipedia?: string;
    [key: string]: unknown;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

// Calculate centroid
function calculateCentroid(geometry: BarrioFeature['geometry']): { lat: number; lng: number } | null {
  try {
    let coords: number[][];
    
    if (geometry.type === 'Polygon') {
      coords = geometry.coordinates[0] as number[][];
    } else if (geometry.type === 'MultiPolygon') {
      const firstPoly = geometry.coordinates[0] as number[][][];
      coords = firstPoly[0];
    } else {
      return null;
    }
    
    if (!coords || !Array.isArray(coords) || coords.length === 0) {
      return null;
    }
    
    let sumLng = 0, sumLat = 0;
    for (const coord of coords) {
      if (Array.isArray(coord) && coord.length >= 2) {
        sumLng += coord[0];
        sumLat += coord[1];
      }
    }
    
    return {
      lng: sumLng / coords.length,
      lat: sumLat / coords.length
    };
  } catch {
    return null;
  }
}

// Calculate bounding box
function calculateBbox(geometry: BarrioFeature['geometry']): { minLat: number; maxLat: number; minLng: number; maxLng: number } | null {
  try {
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;
    
    if (geometry.type === 'Polygon') {
      const coords = geometry.coordinates[0] as number[][];
      for (const coord of coords) {
        if (Array.isArray(coord) && coord.length >= 2) {
          minLng = Math.min(minLng, coord[0]);
          maxLng = Math.max(maxLng, coord[0]);
          minLat = Math.min(minLat, coord[1]);
          maxLat = Math.max(maxLat, coord[1]);
        }
      }
    } else if (geometry.type === 'MultiPolygon') {
      for (const polygon of geometry.coordinates as number[][][][]) {
        if (polygon[0]) {
          for (const coord of polygon[0]) {
            if (Array.isArray(coord) && coord.length >= 2) {
              minLng = Math.min(minLng, coord[0]);
              maxLng = Math.max(maxLng, coord[0]);
              minLat = Math.min(minLat, coord[1]);
              maxLat = Math.max(maxLat, coord[1]);
            }
          }
        }
      }
    }
    
    if (minLng === Infinity) return null;
    return { minLat, maxLat, minLng, maxLng };
  } catch {
    return null;
  }
}

// Determine city from coordinates (basic heuristic)
function inferCity(centroid: { lat: number; lng: number }): string {
  // Major Spanish cities bounding boxes (rough)
  const cities: { name: string; minLat: number; maxLat: number; minLng: number; maxLng: number }[] = [
    { name: 'barcelona', minLat: 41.3, maxLat: 41.5, minLng: 2.0, maxLng: 2.3 },
    { name: 'madrid', minLat: 40.3, maxLat: 40.6, minLng: -3.9, maxLng: -3.5 },
    { name: 'valencia', minLat: 39.4, maxLat: 39.6, minLng: -0.5, maxLng: -0.2 },
    { name: 'sevilla', minLat: 37.3, maxLat: 37.5, minLng: -6.1, maxLng: -5.8 },
    { name: 'bilbao', minLat: 43.2, maxLat: 43.4, minLng: -3.1, maxLng: -2.8 },
    { name: 'malaga', minLat: 36.6, maxLat: 36.8, minLng: -4.6, maxLng: -4.3 },
    { name: 'zaragoza', minLat: 41.6, maxLat: 41.7, minLng: -0.95, maxLng: -0.8 },
  ];
  
  for (const city of cities) {
    if (centroid.lat >= city.minLat && centroid.lat <= city.maxLat &&
        centroid.lng >= city.minLng && centroid.lng <= city.maxLng) {
      return city.name;
    }
  }
  
  return 'other';
}

// Normalize barrio name for SK
function normalizeBarrioName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-')     // Replace non-alphanumeric with dashes
    .replace(/^-|-$/g, '');          // Trim dashes
}

// Write batch to DynamoDB
async function writeBatch(items: Record<string, unknown>[]): Promise<number> {
  if (DRY_RUN) return items.length;
  
  const requests = items.map(item => ({
    PutRequest: { Item: item }
  }));
  
  try {
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: requests
      }
    }));
    return items.length;
  } catch (error: unknown) {
    // If batch fails due to size, try individual writes
    if ((error as { name?: string }).name === 'ValidationException') {
      let written = 0;
      for (const item of items) {
        try {
          await docClient.send(new BatchWriteCommand({
            RequestItems: {
              [TABLE_NAME]: [{ PutRequest: { Item: item } }]
            }
          }));
          written++;
        } catch {
          // Skip individual items that fail
        }
      }
      return written;
    }
    console.error('❌ Batch write failed:', error);
    throw error;
  }
}

// Main import function
async function importBarrios(): Promise<void> {
  console.log('🚀 OSM Barrios Import Script');
  console.log(`   Table: ${TABLE_NAME}`);
  console.log(`   Dry run: ${DRY_RUN}`);
  console.log('');
  
  if (!fs.existsSync(GEOJSON_FILE)) {
    console.error(`❌ Barrios GeoJSON not found: ${GEOJSON_FILE}`);
    console.error('   Run extract-osm-pois.sh first');
    process.exit(1);
  }
  
  console.log('📂 Loading barrios.geojson...');
  const data = JSON.parse(fs.readFileSync(GEOJSON_FILE, 'utf-8'));
  const features: BarrioFeature[] = data.features || [];
  
  console.log(`   Found ${features.length.toLocaleString()} barrio boundaries`);
  console.log('');
  console.log('📤 Importing to DynamoDB...');
  
  let imported = 0;
  let skipped = 0;
  let batch: Record<string, unknown>[] = [];
  const cityCounts: Record<string, number> = {};
  const seenKeys = new Set<string>();
  
  for (const feature of features) {
    const name = feature.properties.name || feature.properties['name:es'];
    
    if (!name) {
      skipped++;
      continue;
    }
    
    const centroid = calculateCentroid(feature.geometry);
    if (!centroid) {
      skipped++;
      continue;
    }
    
    const bbox = calculateBbox(feature.geometry);
    const city = inferCity(centroid);
    const geohash = Geohash.encode(centroid.lat, centroid.lng, 7);
    let normalizedName = normalizeBarrioName(name);
    
    // Ensure unique key (city + neighborhood_id)
    let key = `${city}#${normalizedName}`;
    let counter = 0;
    while (seenKeys.has(key)) {
      counter++;
      normalizedName = `${normalizeBarrioName(name)}-${counter}`;
      key = `${city}#${normalizedName}`;
    }
    seenKeys.add(key);
    
    cityCounts[city] = (cityCounts[city] || 0) + 1;
    
    // Check geometry size - skip if > 350KB (DynamoDB limit is 400KB)
    const geometrySize = JSON.stringify(feature.geometry).length;
    const skipGeometry = geometrySize > 350000;
    
    const item = {
      city: city,
      neighborhood_id: normalizedName,
      osmId: feature.id,
      name,
      nameEs: feature.properties['name:es'] || null,
      nameCa: feature.properties['name:ca'] || null,
      adminLevel: feature.properties.admin_level || '10',
      wikidata: feature.properties.wikidata || null,
      wikipedia: feature.properties.wikipedia || null,
      centroid,
      bbox,
      geohash,
      // Skip oversized geometries, store just centroid/bbox for lookup
      geometry: skipGeometry ? null : feature.geometry,
      geometryOversized: skipGeometry,
      // SERP data will be added later via matching
      serpData: null,
      importedAt: new Date().toISOString()
    };
    
    batch.push(item);
    
    if (batch.length >= BATCH_SIZE) {
      const written = await writeBatch(batch);
      imported += written;
      process.stdout.write(`\r   Imported: ${imported.toLocaleString()} / ${features.length.toLocaleString()}`);
      batch = [];
    }
  }
  
  if (batch.length > 0) {
    const written = await writeBatch(batch);
    imported += written;
  }
  
  console.log('');
  console.log('');
  console.log('✅ Import complete!');
  console.log(`   Imported: ${imported.toLocaleString()}`);
  console.log(`   Skipped (no name): ${skipped.toLocaleString()}`);
  console.log('');
  console.log('📊 By city:');
  for (const [city, count] of Object.entries(cityCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${city}: ${count}`);
  }
  
  if (DRY_RUN) {
    console.log('');
    console.log('⚠️  DRY RUN - no data was actually written');
  }
}

// Run
importBarrios().catch(console.error);
