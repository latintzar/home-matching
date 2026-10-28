#!/usr/bin/env npx tsx
/**
 * Fetch Spanish Neighborhood Boundaries via Overpass API
 * 
 * Queries OpenStreetMap's Overpass API directly to get admin boundaries
 * at levels 9-10 (neighborhoods/districts) for all of Spain.
 * 
 * This is cleaner than downloading 1GB+ of PBF files!
 * 
 * Admin levels in Spain:
 *   4 = Autonomous Community (Catalonia, Madrid, etc.)
 *   6 = Province (Barcelona, Tarragona, etc.)  
 *   7 = Comarca (county-like divisions)
 *   8 = Municipality (cities/towns)
 *   9 = District (barrios/neighborhoods in cities)
 *   10 = Sub-district (smaller divisions)
 * 
 * Usage:
 *   npx tsx src/scripts/fetchOverpassBoundaries.ts                    # Fetch all
 *   npx tsx src/scripts/fetchOverpassBoundaries.ts --city barcelona   # Single city
 *   npx tsx src/scripts/fetchOverpassBoundaries.ts --import           # Import to DynamoDB
 */

import * as fs from 'fs';
import * as path from 'path';
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import * as turf from '@turf/turf';

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const OUTPUT_DIR = 'data/spain-neighborhoods';
const DYNAMODB_TABLE = 'leo-neighborhood-boundaries';

// Major Spanish cities to fetch neighborhoods for
const SPANISH_CITIES = [
  // Tier 1: Major metros
  { name: 'Barcelona', osmId: 347950, region: 'catalunya' },
  { name: 'Madrid', osmId: 5326784, region: 'madrid' },
  { name: 'Valencia', osmId: 340556, region: 'valencia' },
  { name: 'Sevilla', osmId: 342563, region: 'andalucia' },
  { name: 'Málaga', osmId: 340779, region: 'andalucia' },
  { name: 'Bilbao', osmId: 339549, region: 'euskadi' },
  
  // Tier 2: Secondary cities
  { name: 'Zaragoza', osmId: 342952, region: 'aragon' },
  { name: 'Palma', osmId: 11044674, region: 'baleares' },
  { name: 'Murcia', osmId: 342798, region: 'murcia' },
  { name: 'Las Palmas de Gran Canaria', osmId: 5449796, region: 'canarias' },
  { name: 'Alicante', osmId: 340528, region: 'valencia' },
  { name: 'Granada', osmId: 340701, region: 'andalucia' },
  
  // Tier 3: Other important cities
  { name: 'San Sebastián', osmId: 339523, region: 'euskadi' },
  { name: 'Córdoba', osmId: 340643, region: 'andalucia' },
  { name: 'Valladolid', osmId: 342907, region: 'castilla_leon' },
  { name: 'Vigo', osmId: 343158, region: 'galicia' },
  { name: 'Gijón', osmId: 339398, region: 'asturias' },
  { name: 'Santander', osmId: 339653, region: 'cantabria' },
];

interface NeighborhoodFeature {
  city: string;
  neighborhood_id: string;
  name: string;
  admin_level: string;
  osm_id: string;
  geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  centroid: { lat: number; lng: number };
  area_km2?: number;
}

/**
 * Build Overpass query for a city's neighborhoods
 */
function buildOverpassQuery(cityOsmId: number): string {
  return `
[out:json][timeout:180];
// Get the city area
area(id:${3600000000 + cityOsmId})->.city;

// Get all admin boundaries level 9-10 within the city
(
  relation["boundary"="administrative"]["admin_level"="9"](area.city);
  relation["boundary"="administrative"]["admin_level"="10"](area.city);
);

// Output with geometry
out geom;
`.trim();
}

/**
 * Fetch data from Overpass API
 */
async function fetchFromOverpass(query: string): Promise<any> {
  console.log('   🌐 Querying Overpass API...');
  
  const response = await fetch(OVERPASS_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  
  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Convert Overpass relation to GeoJSON Polygon/MultiPolygon
 */
function relationToGeoJSON(relation: any): GeoJSON.Polygon | GeoJSON.MultiPolygon | null {
  if (!relation.members) return null;
  
  // Collect all outer and inner ways
  const outerWays: number[][][] = [];
  const innerWays: number[][][] = [];
  
  for (const member of relation.members) {
    if (member.type !== 'way' || !member.geometry) continue;
    
    const coords = member.geometry.map((p: any) => [p.lon, p.lat]);
    
    if (member.role === 'outer' || member.role === '') {
      outerWays.push(coords);
    } else if (member.role === 'inner') {
      innerWays.push(coords);
    }
  }
  
  if (outerWays.length === 0) return null;
  
  // Try to merge outer ways into closed rings
  const rings = mergeWaysIntoRings(outerWays);
  
  if (rings.length === 0) return null;
  
  if (rings.length === 1) {
    // Single polygon
    const polygon: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [rings[0], ...mergeWaysIntoRings(innerWays)],
    };
    return polygon;
  } else {
    // MultiPolygon
    const multiPolygon: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: rings.map(ring => [ring]),
    };
    return multiPolygon;
  }
}

/**
 * Merge ways into closed rings
 */
function mergeWaysIntoRings(ways: number[][][]): number[][][] {
  if (ways.length === 0) return [];
  
  const rings: number[][][] = [];
  const remaining = [...ways];
  
  while (remaining.length > 0) {
    let currentRing = remaining.shift()!;
    let changed = true;
    
    while (changed) {
      changed = false;
      
      for (let i = 0; i < remaining.length; i++) {
        const way = remaining[i];
        const ringStart = currentRing[0];
        const ringEnd = currentRing[currentRing.length - 1];
        const wayStart = way[0];
        const wayEnd = way[way.length - 1];
        
        // Check if way connects to ring end
        if (coordsEqual(ringEnd, wayStart)) {
          currentRing = [...currentRing, ...way.slice(1)];
          remaining.splice(i, 1);
          changed = true;
          break;
        }
        
        // Check if reversed way connects to ring end
        if (coordsEqual(ringEnd, wayEnd)) {
          currentRing = [...currentRing, ...way.slice(0, -1).reverse()];
          remaining.splice(i, 1);
          changed = true;
          break;
        }
        
        // Check if way connects to ring start
        if (coordsEqual(ringStart, wayEnd)) {
          currentRing = [...way.slice(0, -1), ...currentRing];
          remaining.splice(i, 1);
          changed = true;
          break;
        }
        
        // Check if reversed way connects to ring start
        if (coordsEqual(ringStart, wayStart)) {
          currentRing = [...way.slice(1).reverse(), ...currentRing];
          remaining.splice(i, 1);
          changed = true;
          break;
        }
      }
    }
    
    // Ensure ring is closed
    if (!coordsEqual(currentRing[0], currentRing[currentRing.length - 1])) {
      currentRing.push(currentRing[0]);
    }
    
    if (currentRing.length >= 4) {
      rings.push(currentRing);
    }
  }
  
  return rings;
}

function coordsEqual(a: number[], b: number[]): boolean {
  return Math.abs(a[0] - b[0]) < 0.0000001 && Math.abs(a[1] - b[1]) < 0.0000001;
}

/**
 * Process Overpass response into neighborhood features
 */
function processOverpassResponse(data: any, cityName: string): NeighborhoodFeature[] {
  const features: NeighborhoodFeature[] = [];
  
  if (!data.elements) return features;
  
  for (const element of data.elements) {
    if (element.type !== 'relation') continue;
    
    const name = element.tags?.name || element.tags?.['name:es'] || `Area ${element.id}`;
    const adminLevel = element.tags?.admin_level || '9';
    
    const geojson = relationToGeoJSON(element);
    if (!geojson) continue;
    
    try {
      const centroid = turf.centroid(geojson as any);
      const area = turf.area(geojson as any) / 1000000; // Convert to km²
      
      features.push({
        city: cityName.toLowerCase(),
        neighborhood_id: `osm-${element.id}`,
        name,
        admin_level: adminLevel,
        osm_id: element.id.toString(),
        geojson,
        centroid: {
          lat: centroid.geometry.coordinates[1],
          lng: centroid.geometry.coordinates[0],
        },
        area_km2: Math.round(area * 100) / 100,
      });
    } catch (e) {
      console.warn(`   ⚠️ Failed to process ${name}: ${e}`);
    }
  }
  
  return features;
}

/**
 * Fetch neighborhoods for a single city
 */
async function fetchCityNeighborhoods(
  city: { name: string; osmId: number; region: string }
): Promise<NeighborhoodFeature[]> {
  console.log(`\n📍 ${city.name}`);
  
  const query = buildOverpassQuery(city.osmId);
  
  try {
    const data = await fetchFromOverpass(query);
    const features = processOverpassResponse(data, city.name);
    
    console.log(`   ✅ Found ${features.length} neighborhoods`);
    
    return features;
  } catch (error) {
    console.error(`   ❌ Error: ${error}`);
    return [];
  }
}

/**
 * Setup DynamoDB table
 */
async function setupDynamoDBTable(): Promise<DynamoDBDocumentClient> {
  const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
  const docClient = DynamoDBDocumentClient.from(client);
  
  try {
    await client.send(new DescribeTableCommand({ TableName: DYNAMODB_TABLE }));
    console.log(`\n📦 Table ${DYNAMODB_TABLE} already exists`);
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      console.log(`\n📦 Creating table ${DYNAMODB_TABLE}...`);
      
      await client.send(new CreateTableCommand({
        TableName: DYNAMODB_TABLE,
        KeySchema: [
          { AttributeName: 'city', KeyType: 'HASH' },
          { AttributeName: 'neighborhood_id', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: [
          { AttributeName: 'city', AttributeType: 'S' },
          { AttributeName: 'neighborhood_id', AttributeType: 'S' },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      }));
      
      console.log('   ⏳ Waiting for table to be active...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      console.log('   ✅ Table created');
    } else {
      throw error;
    }
  }
  
  return docClient;
}

/**
 * Import features to DynamoDB
 */
async function importToDynamoDB(
  docClient: DynamoDBDocumentClient,
  features: NeighborhoodFeature[]
): Promise<void> {
  let imported = 0;
  let failed = 0;
  
  for (const feature of features) {
    try {
      await docClient.send(new PutCommand({
        TableName: DYNAMODB_TABLE,
        Item: {
          city: feature.city,
          neighborhood_id: feature.neighborhood_id,
          name: feature.name,
          admin_level: feature.admin_level,
          osm_id: feature.osm_id,
          geojson: feature.geojson,
          centroid: feature.centroid,
          area_km2: feature.area_km2,
        },
      }));
      imported++;
    } catch (error) {
      console.error(`   ❌ Failed to import ${feature.name}: ${error}`);
      failed++;
    }
  }
  
  console.log(`   📥 Imported ${imported} neighborhoods (${failed} failed)`);
}

/**
 * Save features to local GeoJSON files
 */
function saveToGeoJSON(features: NeighborhoodFeature[], city: string): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const geojsonCollection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: features.map(f => ({
      type: 'Feature' as const,
      properties: {
        name: f.name,
        admin_level: f.admin_level,
        osm_id: f.osm_id,
        area_km2: f.area_km2,
      },
      geometry: f.geojson,
    })),
  };
  
  const filepath = path.join(OUTPUT_DIR, `${city.toLowerCase()}-neighborhoods.geojson`);
  fs.writeFileSync(filepath, JSON.stringify(geojsonCollection, null, 2));
  console.log(`   💾 Saved to ${filepath}`);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const singleCity = args.find(a => a.startsWith('--city='))?.split('=')[1];
  const shouldImport = args.includes('--import');
  
  console.log('🇪🇸 Spain Neighborhood Boundary Fetcher');
  console.log('═'.repeat(40));
  console.log(`Using Overpass API: ${OVERPASS_API}`);
  console.log(`Import to DynamoDB: ${shouldImport}`);
  console.log('');
  
  // Determine which cities to fetch
  let citiesToFetch = SPANISH_CITIES;
  if (singleCity) {
    citiesToFetch = SPANISH_CITIES.filter(
      c => c.name.toLowerCase() === singleCity.toLowerCase()
    );
    if (citiesToFetch.length === 0) {
      console.error(`❌ City not found: ${singleCity}`);
      console.log('Available cities:', SPANISH_CITIES.map(c => c.name).join(', '));
      process.exit(1);
    }
  }
  
  // Setup DynamoDB if importing
  let docClient: DynamoDBDocumentClient | null = null;
  if (shouldImport) {
    docClient = await setupDynamoDBTable();
  }
  
  // Fetch neighborhoods for each city
  const allFeatures: NeighborhoodFeature[] = [];
  
  for (const city of citiesToFetch) {
    const features = await fetchCityNeighborhoods(city);
    allFeatures.push(...features);
    
    // Save to GeoJSON
    if (features.length > 0) {
      saveToGeoJSON(features, city.name);
    }
    
    // Import to DynamoDB
    if (shouldImport && docClient && features.length > 0) {
      await importToDynamoDB(docClient, features);
    }
    
    // Rate limit between cities
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Cities processed: ${citiesToFetch.length}`);
  console.log(`Total neighborhoods: ${allFeatures.length}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  if (shouldImport) {
    console.log(`DynamoDB table: ${DYNAMODB_TABLE}`);
  }
  
  console.log('\n✅ Done!');
}

main().catch(console.error);

