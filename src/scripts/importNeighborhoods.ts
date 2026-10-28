#!/usr/bin/env npx tsx
/**
 * Import Spanish Neighborhood Boundaries from OpenStreetMap
 * 
 * Uses Overpass API to fetch admin boundaries at neighborhood level
 * (admin_level 9-10 in Spain) and stores them in DynamoDB.
 * 
 * Spain administrative levels:
 *   4 = Autonomous Community (e.g., Cataluña)
 *   6 = Province (e.g., Barcelona)
 *   7 = Comarca (e.g., Barcelonès)
 *   8 = Municipality (e.g., Barcelona city)
 *   9 = District (e.g., Gràcia)
 *   10 = Neighborhood/Barrio (e.g., Vila de Gràcia)
 * 
 * Usage:
 *   cd /Users/peterneyra/puedo_casa && source .env.local && \
 *   export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION && \
 *   npx tsx src/scripts/importNeighborhoods.ts
 * 
 * Options:
 *   npx tsx src/scripts/importNeighborhoods.ts barcelona  # Just Barcelona
 *   npx tsx src/scripts/importNeighborhoods.ts madrid     # Just Madrid
 *   npx tsx src/scripts/importNeighborhoods.ts all        # All of Spain
 *   npx tsx src/scripts/importNeighborhoods.ts list barcelona  # List stored
 */

import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import * as turf from '@turf/turf';

const TABLE_NAME = 'leo-neighborhood-boundaries';
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

// City bounding boxes for targeted queries
const CITY_BOUNDS: Record<string, { name: string; bbox: string; adminLevel: number }> = {
  barcelona: {
    name: 'Barcelona',
    bbox: '41.32,2.05,41.47,2.23', // S,W,N,E
    adminLevel: 10, // Barrios
  },
  madrid: {
    name: 'Madrid', 
    bbox: '40.33,-3.85,40.52,-3.55',
    adminLevel: 9, // Distritos have barrios at level 10
  },
  valencia: {
    name: 'Valencia',
    bbox: '39.42,-0.45,39.52,-0.30',
    adminLevel: 10,
  },
  sevilla: {
    name: 'Sevilla',
    bbox: '37.33,-6.05,37.45,-5.85',
    adminLevel: 10,
  },
  malaga: {
    name: 'Málaga',
    bbox: '36.68,-4.50,36.78,-4.35',
    adminLevel: 10,
  },
  bilbao: {
    name: 'Bilbao',
    bbox: '43.22,-3.02,43.30,-2.88',
    adminLevel: 9,
  },
};

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

/**
 * Ensure DynamoDB table exists
 */
async function ensureTableExists(): Promise<void> {
  try {
    await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    console.log(`✅ Table ${TABLE_NAME} exists`);
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      console.log(`📦 Creating table ${TABLE_NAME}...`);
      
      await client.send(new CreateTableCommand({
        TableName: TABLE_NAME,
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
      
      console.log('⏳ Waiting for table to be active...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      console.log(`✅ Table ${TABLE_NAME} created`);
    } else {
      throw error;
    }
  }
}

/**
 * Build Overpass query for a city's neighborhoods
 */
function buildOverpassQuery(bbox: string, adminLevel: number): string {
  // Query for admin boundaries as relations with geometry
  return `
[out:json][timeout:120];
(
  relation["boundary"="administrative"]["admin_level"="${adminLevel}"](${bbox});
);
out body;
>;
out skel qt;
`.trim();
}

/**
 * Convert Overpass response to GeoJSON features
 */
function overpassToGeoJSON(data: any): GeoJSON.Feature[] {
  const features: GeoJSON.Feature[] = [];
  
  // Build node lookup
  const nodes: Record<string, [number, number]> = {};
  for (const element of data.elements) {
    if (element.type === 'node') {
      nodes[element.id] = [element.lon, element.lat];
    }
  }
  
  // Build way lookup
  const ways: Record<string, [number, number][]> = {};
  for (const element of data.elements) {
    if (element.type === 'way' && element.nodes) {
      ways[element.id] = element.nodes
        .map((nodeId: number) => nodes[nodeId])
        .filter(Boolean);
    }
  }
  
  // Process relations into polygons
  for (const element of data.elements) {
    if (element.type === 'relation' && element.tags?.boundary === 'administrative') {
      const name = element.tags.name || element.tags['name:es'] || `Area-${element.id}`;
      
      // Collect outer rings from members
      const outerRings: [number, number][][] = [];
      
      for (const member of element.members || []) {
        if (member.type === 'way' && member.role === 'outer') {
          const wayCoords = ways[member.ref];
          if (wayCoords && wayCoords.length > 0) {
            outerRings.push(wayCoords);
          }
        }
      }
      
      if (outerRings.length === 0) continue;
      
      // Try to merge rings into a closed polygon
      const mergedRing = mergeRings(outerRings);
      if (mergedRing.length < 4) continue;
      
      // Close the ring if needed
      const first = mergedRing[0];
      const last = mergedRing[mergedRing.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        mergedRing.push(first);
      }
      
      const feature: GeoJSON.Feature = {
        type: 'Feature',
        properties: {
          osm_id: element.id,
          name,
          admin_level: element.tags.admin_level,
          wikidata: element.tags.wikidata,
          ...element.tags,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [mergedRing],
        },
      };
      
      features.push(feature);
    }
  }
  
  return features;
}

/**
 * Merge multiple way segments into a single ring
 */
function mergeRings(rings: [number, number][][]): [number, number][] {
  if (rings.length === 0) return [];
  if (rings.length === 1) return rings[0];
  
  const result = [...rings[0]];
  const remaining = rings.slice(1);
  
  while (remaining.length > 0) {
    const lastPoint = result[result.length - 1];
    let foundMatch = false;
    
    for (let i = 0; i < remaining.length; i++) {
      const ring = remaining[i];
      const firstPoint = ring[0];
      const ringLastPoint = ring[ring.length - 1];
      
      // Check if this ring connects to our result
      if (coordsEqual(lastPoint, firstPoint)) {
        result.push(...ring.slice(1));
        remaining.splice(i, 1);
        foundMatch = true;
        break;
      } else if (coordsEqual(lastPoint, ringLastPoint)) {
        result.push(...ring.slice(0, -1).reverse());
        remaining.splice(i, 1);
        foundMatch = true;
        break;
      }
    }
    
    if (!foundMatch) break;
  }
  
  return result;
}

function coordsEqual(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) < 0.0001 && Math.abs(a[1] - b[1]) < 0.0001;
}

/**
 * Fetch neighborhoods from Overpass API
 */
async function fetchNeighborhoods(cityKey: string): Promise<GeoJSON.Feature[]> {
  const config = CITY_BOUNDS[cityKey];
  if (!config) {
    throw new Error(`Unknown city: ${cityKey}. Available: ${Object.keys(CITY_BOUNDS).join(', ')}`);
  }
  
  console.log(`\n📥 Fetching ${config.name} neighborhoods from OpenStreetMap...`);
  console.log(`   Bbox: ${config.bbox}`);
  console.log(`   Admin level: ${config.adminLevel}`);
  
  const query = buildOverpassQuery(config.bbox, config.adminLevel);
  
  const response = await fetch(OVERPASS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  
  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log(`   Received ${data.elements?.length || 0} OSM elements`);
  
  const features = overpassToGeoJSON(data);
  console.log(`   Converted to ${features.length} GeoJSON features`);
  
  return features;
}

/**
 * Import neighborhoods for a city into DynamoDB
 */
async function importCity(cityKey: string): Promise<number> {
  const features = await fetchNeighborhoods(cityKey);
  
  if (features.length === 0) {
    console.log(`⚠️ No neighborhoods found for ${cityKey}`);
    return 0;
  }
  
  console.log(`\n📊 Importing ${features.length} neighborhoods to DynamoDB...\n`);
  
  let imported = 0;
  
  for (const feature of features) {
    const name = feature.properties?.name || 'Unknown';
    const osmId = feature.properties?.osm_id || Math.random().toString(36).slice(2);
    const neighborhoodId = `osm-${osmId}`;
    
    // Calculate centroid
    let centroid = { lat: 0, lng: 0 };
    try {
      const c = turf.centroid(feature);
      centroid = { lng: c.geometry.coordinates[0], lat: c.geometry.coordinates[1] };
    } catch (e) {
      console.warn(`⚠️ Could not calculate centroid for ${name}`);
    }
    
    try {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          city: cityKey.toLowerCase(),
          neighborhood_id: neighborhoodId,
          name,
          geojson: feature,
          centroid,
          properties: feature.properties || {},
        },
      }));
      
      imported++;
      process.stdout.write(`\r   ✓ ${imported}/${features.length} - ${name.padEnd(35)}`);
    } catch (error) {
      console.error(`\n❌ Error importing ${name}:`, error);
    }
  }
  
  console.log(`\n\n✅ Imported ${imported} neighborhoods for ${cityKey}`);
  return imported;
}

/**
 * Import all cities
 */
async function importAllCities(): Promise<void> {
  const stats: Record<string, number> = {};
  
  for (const cityKey of Object.keys(CITY_BOUNDS)) {
    try {
      stats[cityKey] = await importCity(cityKey);
      // Rate limit - Overpass API is shared resource
      console.log('⏳ Waiting 5 seconds before next city...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.error(`❌ Failed to import ${cityKey}:`, error);
      stats[cityKey] = 0;
    }
  }
  
  console.log('\n\n📊 IMPORT SUMMARY:');
  console.log('═'.repeat(40));
  let total = 0;
  for (const [city, count] of Object.entries(stats)) {
    console.log(`   ${city.padEnd(15)} ${count} neighborhoods`);
    total += count;
  }
  console.log('─'.repeat(40));
  console.log(`   ${'TOTAL'.padEnd(15)} ${total} neighborhoods`);
}

/**
 * List neighborhoods for a city
 */
async function listNeighborhoods(cityKey: string): Promise<void> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'city = :city',
    ExpressionAttributeValues: { ':city': cityKey.toLowerCase() },
  }));
  
  const items = result.Items || [];
  console.log(`\n📍 Neighborhoods in ${cityKey}:\n`);
  
  for (const item of items.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`   - ${item.name} (${item.neighborhood_id})`);
  }
  
  console.log(`\n   Total: ${items.length} neighborhoods`);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'barcelona';
  
  if (command === 'help' || command === '-h' || command === '--help') {
    console.log(`
Spanish Neighborhood Importer
─────────────────────────────
Fetches neighborhood boundaries from OpenStreetMap and stores in DynamoDB.

Usage:
  npx tsx src/scripts/importNeighborhoods.ts [command]

Commands:
  barcelona    Import Barcelona neighborhoods (default)
  madrid       Import Madrid neighborhoods
  valencia     Import Valencia neighborhoods
  sevilla      Import Sevilla neighborhoods
  malaga       Import Málaga neighborhoods
  bilbao       Import Bilbao neighborhoods
  all          Import all supported cities
  list <city>  List stored neighborhoods for a city

Examples:
  npx tsx src/scripts/importNeighborhoods.ts barcelona
  npx tsx src/scripts/importNeighborhoods.ts all
  npx tsx src/scripts/importNeighborhoods.ts list barcelona
`);
    return;
  }
  
  await ensureTableExists();
  
  if (command === 'list') {
    const city = args[1] || 'barcelona';
    await listNeighborhoods(city);
  } else if (command === 'all') {
    await importAllCities();
  } else if (CITY_BOUNDS[command.toLowerCase()]) {
    await importCity(command.toLowerCase());
    await listNeighborhoods(command.toLowerCase());
  } else {
    console.error(`Unknown command: ${command}`);
    console.log('Run with --help for usage');
  }
}

main().catch(console.error);
