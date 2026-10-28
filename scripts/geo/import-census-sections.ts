/**
 * Import Census Sections + Income Data to DynamoDB
 * 
 * Source: https://github.com/miguel-angel-monjas/spain-datasets
 * - GeoJSON polygons: data/census/SECC_CE_ES-{region}_*.json
 * - Income CSV: data/Renta media en España.csv
 * 
 * Target: leo-census-sections DynamoDB table
 * 
 * Usage: npx tsx scripts/geo/import-census-sections.ts [--dry-run] [--region CT]
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import Geohash from 'ngeohash';

// Config
const TABLE_NAME = 'leo-census-sections';
const DATA_DIR = path.join(process.cwd(), 'data/geo/spain-datasets/data');
const CENSUS_DIR = path.join(DATA_DIR, 'census');
const INCOME_FILE = path.join(DATA_DIR, 'Renta media en España.csv');
const BATCH_SIZE = 25; // DynamoDB limit

// CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const REGION_FILTER = args.find(a => a.startsWith('--region='))?.split('=')[1];

// AWS setup
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

interface IncomeRecord {
  cusec: string;
  incomePerPerson: number | null;
  incomePerHousehold: number | null;
}

interface CensusFeature {
  type: 'Feature';
  properties: {
    CUSEC: string;
    CPRO: string;
    CMUN: string;
    NMUN: string;
    NPRO: string;
    NCA: string;
    [key: string]: unknown;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

// Calculate centroid of polygon
function calculateCentroid(geometry: CensusFeature['geometry']): { lat: number; lng: number } {
  let coords: number[][];
  
  if (geometry.type === 'Polygon') {
    coords = geometry.coordinates[0] as number[][];
  } else {
    // MultiPolygon - use first polygon
    coords = (geometry.coordinates[0] as number[][][])[0];
  }
  
  let sumLng = 0, sumLat = 0;
  for (const [lng, lat] of coords) {
    sumLng += lng;
    sumLat += lat;
  }
  
  return {
    lng: sumLng / coords.length,
    lat: sumLat / coords.length
  };
}

// Calculate bounding box
function calculateBbox(geometry: CensusFeature['geometry']): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  let allCoords: number[][] = [];
  
  if (geometry.type === 'Polygon') {
    allCoords = geometry.coordinates[0] as number[][];
  } else {
    for (const polygon of geometry.coordinates as number[][][][]) {
      allCoords.push(...polygon[0]);
    }
  }
  
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  
  for (const [lng, lat] of allCoords) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  
  return { minLat, maxLat, minLng, maxLng };
}

// Load income data
function loadIncomeData(): Map<string, IncomeRecord> {
  console.log('📊 Loading income data...');
  
  const csvContent = fs.readFileSync(INCOME_FILE, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ','
  });
  
  const incomeMap = new Map<string, IncomeRecord>();
  
  for (const row of records) {
    const cusec = row['Código de territorio']?.toString().padStart(10, '0');
    const tipo = row['Tipo de elemento'];
    
    // Only use "sección" level data
    if (tipo === 'sección' && cusec) {
      incomeMap.set(cusec, {
        cusec,
        incomePerPerson: row['Renta media por persona'] ? parseFloat(row['Renta media por persona']) : null,
        incomePerHousehold: row['Renta media por hogar'] ? parseFloat(row['Renta media por hogar']) : null
      });
    }
  }
  
  console.log(`   Found ${incomeMap.size.toLocaleString()} income records for census sections`);
  return incomeMap;
}

// Load census GeoJSON files
function loadCensusFiles(): CensusFeature[] {
  console.log('🗺️  Loading census GeoJSON files...');
  
  const files = fs.readdirSync(CENSUS_DIR).filter(f => f.endsWith('.json'));
  const allFeatures: CensusFeature[] = [];
  
  for (const file of files) {
    // Extract region code (e.g., "CT" from "SECC_CE_ES-CT_20190101.json")
    const regionMatch = file.match(/ES-([A-Z]{2})/);
    const regionCode = regionMatch?.[1];
    
    if (REGION_FILTER && regionCode !== REGION_FILTER) {
      continue;
    }
    
    const filePath = path.join(CENSUS_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    console.log(`   ${file}: ${data.features.length.toLocaleString()} sections`);
    allFeatures.push(...data.features);
  }
  
  console.log(`   Total: ${allFeatures.length.toLocaleString()} census sections`);
  return allFeatures;
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

// Main import function
async function importCensusSections(): Promise<void> {
  console.log('🚀 Census Sections Import Script');
  console.log(`   Table: ${TABLE_NAME}`);
  console.log(`   Dry run: ${DRY_RUN}`);
  if (REGION_FILTER) console.log(`   Region filter: ${REGION_FILTER}`);
  console.log('');
  
  // Load data
  const incomeMap = loadIncomeData();
  const features = loadCensusFiles();
  
  console.log('');
  console.log('📤 Importing to DynamoDB...');
  
  let imported = 0;
  let skipped = 0;
  let batch: Record<string, unknown>[] = [];
  
  for (const feature of features) {
    const cusec = feature.properties.CUSEC;
    
    if (!cusec) {
      skipped++;
      continue;
    }
    
    // Get income data (pad to 10 digits to match)
    const income = incomeMap.get(cusec.padStart(10, '0'));
    
    // Calculate spatial data
    const centroid = calculateCentroid(feature.geometry);
    const bbox = calculateBbox(feature.geometry);
    const geohash = Geohash.encode(centroid.lat, centroid.lng, 7);
    
    // Build DynamoDB item
    const item = {
      PK: 'ES',
      SK: cusec,
      cusec,
      provinceCode: feature.properties.CPRO,
      municipalityCode: feature.properties.CMUN,
      municipalityName: feature.properties.NMUN,
      provinceName: feature.properties.NPRO,
      communityName: feature.properties.NCA,
      centroid,
      bbox,
      geohash,
      geometry: feature.geometry,
      incomePerPerson: income?.incomePerPerson ?? null,
      incomePerHousehold: income?.incomePerHousehold ?? null,
      importedAt: new Date().toISOString()
    };
    
    batch.push(item);
    
    if (batch.length >= BATCH_SIZE) {
      await writeBatch(batch);
      imported += batch.length;
      process.stdout.write(`\r   Imported: ${imported.toLocaleString()} / ${features.length.toLocaleString()}`);
      batch = [];
    }
  }
  
  // Write remaining items
  if (batch.length > 0) {
    await writeBatch(batch);
    imported += batch.length;
  }
  
  console.log('');
  console.log('');
  console.log('✅ Import complete!');
  console.log(`   Imported: ${imported.toLocaleString()}`);
  console.log(`   Skipped: ${skipped.toLocaleString()}`);
  
  if (DRY_RUN) {
    console.log('');
    console.log('⚠️  DRY RUN - no data was actually written');
  }
}

// Run
importCensusSections().catch(console.error);
