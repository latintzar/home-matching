#!/usr/bin/env npx tsx
/**
 * Export POIs from DynamoDB for the map demo
 * 
 * Exports tennis courts, schools, and other stable POIs to GeoJSON
 * for the test-map-comparison page.
 * 
 * Usage:
 *   cd /Users/peterneyra/puedo_casa && source .env.local && \
 *   export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION && \
 *   npx tsx src/scripts/exportPOIsForDemo.ts
 */

import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import * as fs from 'fs';
import * as path from 'path';

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Barcelona bounding box
const BARCELONA_BBOX = {
  minLng: 2.05,
  maxLng: 2.23,
  minLat: 41.32,
  maxLat: 41.47,
};

function isInBarcelona(lat: number, lng: number): boolean {
  return (
    lng >= BARCELONA_BBOX.minLng &&
    lng <= BARCELONA_BBOX.maxLng &&
    lat >= BARCELONA_BBOX.minLat &&
    lat <= BARCELONA_BBOX.maxLat
  );
}

interface POI {
  name: string;
  lat: number;
  lng: number;
  type: string;
}

async function fetchPOIsByType(poiType: string): Promise<POI[]> {
  const pois: POI[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const command = new ScanCommand({
      TableName: 'leo-osm-pois',
      FilterExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': { S: poiType } },
      ExclusiveStartKey: lastKey as never,
    });

    const result = await dynamodb.send(command);

    if (result.Items) {
      for (const item of result.Items) {
        const data = unmarshall(item);
        if (data.lat && data.lng && isInBarcelona(data.lat, data.lng)) {
          pois.push({
            name: data.name || poiType,
            lat: data.lat,
            lng: data.lng,
            type: poiType,
          });
        }
      }
    }

    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return pois;
}

function toGeoJSON(pois: POI[], type: string): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pois.map((poi) => ({
      type: 'Feature' as const,
      properties: {
        name: poi.name,
        type: poi.type,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [poi.lng, poi.lat],
      },
    })),
  };
}

async function main() {
  console.log('🏟️  POI Exporter for Map Demo');
  console.log('═'.repeat(50));

  const outputDir = path.join(process.cwd(), 'public', 'heatmap-demo', 'layers');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Define POI types to export
  const poiTypes = [
    { key: 'leisure=sports_centre', name: 'sports-centres', emoji: '🏋️' },
    { key: 'leisure=pitch', name: 'sports-pitches', emoji: '⚽' },
    { key: 'amenity=school', name: 'schools', emoji: '🏫' },
    { key: '', name: 'hospitals', emoji: '🏥' },
    { key: 'amenity=pharmacy', name: 'pharmacies', emoji: '💊' },
    { key: 'shop=bakery', name: 'bakeries', emoji: '🥐' },
    { key: 'shop=supermarket', name: 'supermarkets', emoji: '🛒' },
    { key: 'amenity=cafe', name: 'cafes', emoji: '☕' },
    { key: 'amenity=restaurant', name: 'restaurants', emoji: '🍽️' },
  ];

  const summary: { type: string; count: number }[] = [];

  for (const poiType of poiTypes) {
    console.log(`\n📍 Fetching ${poiType.emoji} ${poiType.name}...`);
    
    const pois = await fetchPOIsByType(poiType.key);
    console.log(`   Found ${pois.length} in Barcelona`);

    if (pois.length > 0) {
      const geojson = toGeoJSON(pois, poiType.key);
      const outputPath = path.join(outputDir, `barcelona-${poiType.name}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
      console.log(`   ✓ Saved to ${poiType.name}.json`);
      summary.push({ type: poiType.name, count: pois.length });
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('📊 Summary:');
  for (const s of summary) {
    console.log(`   ${s.type}: ${s.count}`);
  }
  console.log(`\n✅ Exported to: ${outputDir}`);
}

main().catch(console.error);
