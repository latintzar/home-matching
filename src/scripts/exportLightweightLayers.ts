/**
 * exportLightweightLayers.ts
 * 
 * Exports lightweight geo layers for progressive map visualization during Leo chat.
 * These are small files that can be loaded incrementally as user mentions preferences.
 * 
 * Outputs:
 * - barcelona-neighborhoods.json (~500KB) - Neighborhood outlines
 * - barcelona-metro-stations.json (~50KB) - Metro/train stations
 * - barcelona-parks.json (~100KB) - Major parks
 * - barcelona-coast.json (~20KB) - Coastline/beaches
 */

import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = 'public/heatmap-demo/layers';

// Barcelona bounding box for filtering
const BARCELONA_BBOX = {
  minLng: 2.05,
  maxLng: 2.23,
  minLat: 41.32,
  maxLat: 41.47,
};

const isInBarcelona = (lat: number, lng: number): boolean => {
  return lat >= BARCELONA_BBOX.minLat && lat <= BARCELONA_BBOX.maxLat &&
         lng >= BARCELONA_BBOX.minLng && lng <= BARCELONA_BBOX.maxLng;
};

const dynamo = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// ============================================================
// NEIGHBORHOODS - Outlines for "I like Gràcia's vibe"
// ============================================================
const exportNeighborhoods = async (): Promise<void> => {
  console.log('\n🏘️ Exporting neighborhoods...');
  
  const items: any[] = [];
  let lastKey: any = undefined;
  
  do {
    const response = await dynamo.send(new ScanCommand({
      TableName: 'leo-neighborhood-boundaries',
      FilterExpression: 'city = :c',
      ExpressionAttributeValues: { ':c': { S: 'barcelona' } },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of response.Items || []) {
      items.push(unmarshall(item));
    }
    lastKey = response.LastEvaluatedKey;
    console.log(`  Fetched ${items.length} neighborhoods...`);
  } while (lastKey);
  
  // Convert to GeoJSON FeatureCollection
  const features = items
    .filter(item => item.geometry)
    .map(item => {
      // Parse geometry if it's a string
      let geometry = item.geometry;
      if (typeof geometry === 'string') {
        geometry = JSON.parse(geometry);
      }
      
      return {
        type: 'Feature' as const,
        properties: {
          name: item.name || item.nameCa || item.nameEs,
          nameCa: item.nameCa,
          nameEs: item.nameEs,
        },
        geometry,
      };
    });
  
  const geojson = {
    type: 'FeatureCollection',
    metadata: {
      layer: 'neighborhoods',
      count: features.length,
      generated: new Date().toISOString(),
      description: 'Barcelona neighborhood boundaries for progressive map visualization',
    },
    features,
  };
  
  const outputFile = path.join(OUTPUT_DIR, 'barcelona-neighborhoods.json');
  fs.writeFileSync(outputFile, JSON.stringify(geojson));
  
  const size = fs.statSync(outputFile).size;
  console.log(`  ✅ Saved ${features.length} neighborhoods (${(size / 1024).toFixed(1)}KB)`);
};

// ============================================================
// METRO STATIONS - Points for "I need good metro access"
// ============================================================
const exportMetroStations = async (): Promise<void> => {
  console.log('\n🚇 Exporting metro stations...');
  
  const items: any[] = [];
  let lastKey: any = undefined;
  
  do {
    const response = await dynamo.send(new ScanCommand({
      TableName: 'leo-osm-pois',
      FilterExpression: 'railway = :r',
      ExpressionAttributeValues: { ':r': { S: 'station' } },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of response.Items || []) {
      const data = unmarshall(item);
      const lat = parseFloat(data.lat);
      const lng = parseFloat(data.lng);
      
      // Filter to Barcelona area
      if (isInBarcelona(lat, lng)) {
        items.push(data);
      }
    }
    lastKey = response.LastEvaluatedKey;
    
    // Rate limiting hint
    if (lastKey) {
      await new Promise(r => setTimeout(r, 100));
    }
  } while (lastKey);
  
  // Convert to GeoJSON points
  const features = items.map(item => ({
    type: 'Feature' as const,
    properties: {
      name: item.name,
      type: 'metro',
    },
    geometry: {
      type: 'Point' as const,
      coordinates: [parseFloat(item.lng), parseFloat(item.lat)],
    },
  }));
  
  const geojson = {
    type: 'FeatureCollection',
    metadata: {
      layer: 'metro-stations',
      count: features.length,
      generated: new Date().toISOString(),
      description: 'Metro and train stations in Barcelona',
    },
    features,
  };
  
  const outputFile = path.join(OUTPUT_DIR, 'barcelona-metro-stations.json');
  fs.writeFileSync(outputFile, JSON.stringify(geojson));
  
  const size = fs.statSync(outputFile).size;
  console.log(`  ✅ Saved ${features.length} metro stations (${(size / 1024).toFixed(1)}KB)`);
};

// ============================================================
// PARKS - Polygons for "Parks are important, I have a dog"
// ============================================================
const exportParks = async (): Promise<void> => {
  console.log('\n🌳 Exporting parks...');
  
  const items: any[] = [];
  let lastKey: any = undefined;
  let scanned = 0;
  
  do {
    const response = await dynamo.send(new ScanCommand({
      TableName: 'leo-osm-pois',
      FilterExpression: 'leisure = :l',
      ExpressionAttributeValues: { ':l': { S: 'park' } },
      ExclusiveStartKey: lastKey,
      Limit: 5000, // Batch size
    }));
    
    for (const item of response.Items || []) {
      const data = unmarshall(item);
      const lat = parseFloat(data.lat);
      const lng = parseFloat(data.lng);
      
      // Filter to Barcelona area
      if (isInBarcelona(lat, lng)) {
        items.push(data);
      }
    }
    
    scanned += response.Items?.length || 0;
    lastKey = response.LastEvaluatedKey;
    
    if (scanned % 10000 === 0) {
      console.log(`  Scanned ${scanned.toLocaleString()} items, found ${items.length} parks in Barcelona...`);
    }
    
    // Rate limiting
    if (lastKey) {
      await new Promise(r => setTimeout(r, 50));
    }
  } while (lastKey);
  
  // Convert to GeoJSON points (parks are stored as points in our data)
  const features = items
    .filter(item => item.name) // Only named parks
    .map(item => ({
      type: 'Feature' as const,
      properties: {
        name: item.name,
        type: 'park',
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [parseFloat(item.lng), parseFloat(item.lat)],
      },
    }));
  
  const geojson = {
    type: 'FeatureCollection',
    metadata: {
      layer: 'parks',
      count: features.length,
      generated: new Date().toISOString(),
      description: 'Parks and green spaces in Barcelona',
    },
    features,
  };
  
  const outputFile = path.join(OUTPUT_DIR, 'barcelona-parks.json');
  fs.writeFileSync(outputFile, JSON.stringify(geojson));
  
  const size = fs.statSync(outputFile).size;
  console.log(`  ✅ Saved ${features.length} parks (${(size / 1024).toFixed(1)}KB)`);
};

// ============================================================
// COAST/BEACHES - For "I like being near the beach"
// ============================================================
const exportCoast = async (): Promise<void> => {
  console.log('\n🏖️ Exporting coast/beaches...');
  
  const items: any[] = [];
  let lastKey: any = undefined;
  
  // Search for beaches
  do {
    const response = await dynamo.send(new ScanCommand({
      TableName: 'leo-osm-pois',
      FilterExpression: '#n = :b',
      ExpressionAttributeNames: { '#n': 'natural' },
      ExpressionAttributeValues: { ':b': { S: 'beach' } },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of response.Items || []) {
      const data = unmarshall(item);
      const lat = parseFloat(data.lat);
      const lng = parseFloat(data.lng);
      
      if (isInBarcelona(lat, lng)) {
        items.push({ ...data, type: 'beach' });
      }
    }
    lastKey = response.LastEvaluatedKey;
  } while (lastKey);
  
  // Also search for coastline
  lastKey = undefined;
  do {
    const response = await dynamo.send(new ScanCommand({
      TableName: 'leo-osm-pois',
      FilterExpression: '#n = :c',
      ExpressionAttributeNames: { '#n': 'natural' },
      ExpressionAttributeValues: { ':c': { S: 'coastline' } },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of response.Items || []) {
      const data = unmarshall(item);
      const lat = parseFloat(data.lat);
      const lng = parseFloat(data.lng);
      
      if (isInBarcelona(lat, lng)) {
        items.push({ ...data, type: 'coastline' });
      }
    }
    lastKey = response.LastEvaluatedKey;
  } while (lastKey);
  
  // If no beaches found, create a simple coastline approximation
  if (items.length === 0) {
    console.log('  No beach data found, creating coastline approximation...');
    
    // Barcelona coastline approximation (south to north)
    const coastlinePoints = [
      [2.0687, 41.3130], // Port area
      [2.1106, 41.3161], // Montjuïc
      [2.1547, 41.3606], // Barceloneta start
      [2.1889, 41.3775], // Barceloneta
      [2.1985, 41.3879], // Port Olímpic
      [2.2086, 41.3967], // Nova Icària
      [2.2185, 41.4023], // Bogatell
      [2.2237, 41.4099], // Mar Bella
      [2.2291, 41.4186], // Nova Mar Bella
      [2.2344, 41.4237], // Llevant
    ];
    
    const coastFeature = {
      type: 'Feature' as const,
      properties: {
        name: 'Barcelona Coastline',
        type: 'coastline',
      },
      geometry: {
        type: 'LineString' as const,
        coordinates: coastlinePoints,
      },
    };
    
    const geojson = {
      type: 'FeatureCollection',
      metadata: {
        layer: 'coast',
        count: 1,
        generated: new Date().toISOString(),
        description: 'Barcelona coastline for map visualization',
        note: 'Approximation - no detailed beach data available',
      },
      features: [coastFeature],
    };
    
    const outputFile = path.join(OUTPUT_DIR, 'barcelona-coast.json');
    fs.writeFileSync(outputFile, JSON.stringify(geojson));
    
    const size = fs.statSync(outputFile).size;
    console.log(`  ✅ Saved coastline approximation (${(size / 1024).toFixed(1)}KB)`);
    return;
  }
  
  // Convert found items to GeoJSON
  const features = items.map(item => ({
    type: 'Feature' as const,
    properties: {
      name: item.name || 'Beach',
      type: item.type,
    },
    geometry: {
      type: 'Point' as const,
      coordinates: [parseFloat(item.lng), parseFloat(item.lat)],
    },
  }));
  
  const geojson = {
    type: 'FeatureCollection',
    metadata: {
      layer: 'coast',
      count: features.length,
      generated: new Date().toISOString(),
      description: 'Beaches and coastline in Barcelona',
    },
    features,
  };
  
  const outputFile = path.join(OUTPUT_DIR, 'barcelona-coast.json');
  fs.writeFileSync(outputFile, JSON.stringify(geojson));
  
  const size = fs.statSync(outputFile).size;
  console.log(`  ✅ Saved ${features.length} coast features (${(size / 1024).toFixed(1)}KB)`);
};

// ============================================================
// MAIN
// ============================================================
const main = async () => {
  console.log('🗺️ Exporting lightweight layers for progressive map visualization');
  console.log('================================================================');
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created directory: ${OUTPUT_DIR}`);
  }
  
  // Export all layers
  await exportNeighborhoods();
  await exportMetroStations();
  await exportParks();
  await exportCoast();
  
  // Summary
  console.log('\n📊 Export Summary');
  console.log('================');
  
  const files = fs.readdirSync(OUTPUT_DIR);
  let totalSize = 0;
  
  for (const file of files) {
    const size = fs.statSync(path.join(OUTPUT_DIR, file)).size;
    totalSize += size;
    console.log(`  ${file}: ${(size / 1024).toFixed(1)}KB`);
  }
  
  console.log(`  ────────────────────`);
  console.log(`  Total: ${(totalSize / 1024).toFixed(1)}KB`);
  
  console.log('\n✨ Done! Lightweight layers ready for progressive map visualization.');
};

main().catch(console.error);
