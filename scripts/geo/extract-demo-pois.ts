#!/usr/bin/env npx tsx
/**
 * Extract sample POIs for the demo map
 * 
 * Queries DynamoDB for:
 * - Bakeries in Barcelona (shop=bakery)
 * - Tennis courts in Barcelona (sport=tennis)
 * 
 * Outputs JSON arrays to paste into test-map-comparison page
 */

import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

// Barcelona metro area (wider for more coverage)
const BARCELONA_BBOX = {
  minLng: 2.05,
  maxLng: 2.25,
  minLat: 41.33,
  maxLat: 41.45,
};

const isInBarcelona = (lat: number, lng: number): boolean => {
  return lat >= BARCELONA_BBOX.minLat && lat <= BARCELONA_BBOX.maxLat &&
         lng >= BARCELONA_BBOX.minLng && lng <= BARCELONA_BBOX.maxLng;
};

const dynamo = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

interface POI {
  lng: number;
  lat: number;
  name: string;
}

async function fetchPOIs(filterAttr: string, filterValue: string, maxResults: number = 30): Promise<POI[]> {
  const items: POI[] = [];
  let lastKey: any = undefined;
  let scanned = 0;
  
  do {
    const response = await dynamo.send(new ScanCommand({
      TableName: 'leo-osm-pois',
      FilterExpression: `#attr = :val`,
      ExpressionAttributeNames: { '#attr': filterAttr },
      ExpressionAttributeValues: { ':val': { S: filterValue } },
      ExclusiveStartKey: lastKey,
      Limit: 5000,
    }));
    
    for (const item of response.Items || []) {
      const data = unmarshall(item);
      const lat = parseFloat(data.lat);
      const lng = parseFloat(data.lng);
      
      if (isInBarcelona(lat, lng) && data.name) {
        items.push({
          lng: Math.round(lng * 100000) / 100000,
          lat: Math.round(lat * 100000) / 100000,
          name: data.name,
        });
        
        if (items.length >= maxResults) break;
      }
    }
    
    scanned += response.Items?.length || 0;
    lastKey = response.LastEvaluatedKey;
    
    process.stdout.write(`\r   Scanned ${scanned.toLocaleString()} items, found ${items.length}...`);
    
    if (items.length >= maxResults) break;
    
    // Rate limiting
    if (lastKey) {
      await new Promise(r => setTimeout(r, 50));
    }
  } while (lastKey);
  
  console.log();
  return items;
}

async function main() {
  console.log('🥐 Fetching bakeries (shop=bakery)...');
  const bakeries = await fetchPOIs('shop', 'bakery', 25);
  
  console.log('\n🎾 Fetching tennis courts (sport=tennis)...');
  const tennis = await fetchPOIs('sport', 'tennis', 25);
  
  console.log('\n\n=== BAKERIES (copy/paste into page.tsx) ===\n');
  console.log(JSON.stringify(bakeries, null, 2));
  
  console.log('\n\n=== TENNIS COURTS (copy/paste into page.tsx) ===\n');
  console.log(JSON.stringify(tennis, null, 2));
  
  console.log('\n✅ Done! Found', bakeries.length, 'bakeries and', tennis.length, 'tennis courts');
}

main().catch(console.error);
