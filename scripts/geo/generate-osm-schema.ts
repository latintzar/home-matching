#!/usr/bin/env npx tsx
/**
 * Generate OSM Schema Discovery File
 * 
 * Queries DynamoDB to discover all available attributes per POI type.
 * Outputs a JSON file that Leo Brain can reference to know what's queryable.
 * 
 * PERFORMANCE: Uses QueryCommand on PK (which IS the POI type) instead of
 * ScanCommand with FilterExpression. This is O(k) per type instead of O(n).
 * Runtime: ~2 minutes instead of ~2 hours.
 * 
 * Usage: npx tsx scripts/geo/generate-osm-schema.ts
 * Output: src/data/osm-schema.json
 */

import { DynamoDBClient, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import * as fs from 'fs';
import * as path from 'path';

const TABLE_NAME = 'leo-osm-pois';
const OUTPUT_PATH = path.join(process.cwd(), 'src/data/osm-schema.json');
const SAMPLE_SIZE = 500; // Sample per type for schema discovery

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

interface SchemaInfo {
  attributes: Set<string>;
  multiValueAttributes: Set<string>; // Attributes with semicolon-separated values
  sportValues: Set<string>;
  cuisineValues: Set<string>;
  dietValues: Set<string>;
  brandValues: Set<string>;
  count: number;
}

const POI_TYPES = [
  'parks', 'metro', 'beaches', 'schools', 'healthcare', 
  'playgrounds', 'dog_parks', 'sports_pitches',
  'supermarkets', 'cafes', 'bakeries', 'restaurants', 'bars', 'gyms', 'pharmacies'
];

async function discoverSchema(poiType: string): Promise<SchemaInfo> {
  const info: SchemaInfo = {
    attributes: new Set(),
    multiValueAttributes: new Set(), // Track attributes with ";" delimited values
    sportValues: new Set(),
    cuisineValues: new Set(),
    dietValues: new Set(),
    brandValues: new Set(),
    count: 0,
  };
  
  let lastKey: Record<string, unknown> | undefined;
  let sampled = 0;
  let totalCount = 0;
  
  // FAST: Query by PK (which IS the POI type) instead of scanning entire table
  do {
    const result = await client.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': { S: poiType } },
      ExclusiveStartKey: lastKey as never,
      Limit: 500, // Larger batches since Query is efficient
    }));
    
    for (const item of result.Items || []) {
      totalCount++;
      
      // Only process for schema discovery up to SAMPLE_SIZE
      if (sampled < SAMPLE_SIZE) {
        const d = unmarshall(item);
        info.count++;
        
        // Collect all attribute keys and detect multi-value attributes
        for (const [key, value] of Object.entries(d)) {
          info.attributes.add(key);
          
          // Detect multi-value attributes (semicolon-separated)
          if (typeof value === 'string' && value.includes(';')) {
            info.multiValueAttributes.add(key);
          }
        }
        
        // Collect specific values
        if (d.sport) info.sportValues.add(String(d.sport));
        if (d.cuisine) info.cuisineValues.add(String(d.cuisine));
        if (d.brand) info.brandValues.add(String(d.brand));
        
        // Collect diet:* values
        for (const [key, value] of Object.entries(d)) {
          if (key.startsWith('diet:') && value === 'yes') {
            info.dietValues.add(key.replace('diet:', ''));
          }
        }
        
        sampled++;
      }
    }
    
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    
    // Small delay to avoid throttling
    await new Promise(r => setTimeout(r, 10));
    
  } while (lastKey);
  
  // Store actual total count (not just sampled)
  info.count = totalCount;
  
  return info;
}

async function main() {
  console.log('🔍 OSM Schema Discovery');
  console.log('=======================\n');
  
  const schema: Record<string, unknown> = {
    generated: new Date().toISOString(),
    description: 'Auto-discovered schema from leo-osm-pois DynamoDB table',
    usage: 'Leo Brain uses this to know what attributes are queryable in OSM data',
    totalItems: 0, // Will be updated after discovery
    poiTypes: {},
  };
  
  // Get total count by summing per-type counts (faster than full table scan)
  console.log(`Querying ${POI_TYPES.length} POI types...\n`);
  
  let grandTotal = 0;
  const startTime = Date.now();
  
  for (const poiType of POI_TYPES) {
    process.stdout.write(`📊 Discovering ${poiType}...`);
    
    const info = await discoverSchema(poiType);
    grandTotal += info.count;
    
    (schema.poiTypes as Record<string, unknown>)[poiType] = {
      sampleSize: Math.min(info.count, SAMPLE_SIZE),
      totalCount: info.count,
      attributes: Array.from(info.attributes).sort(),
      // Multi-value attributes use ";" delimiter - API should use contains() for filtering
      ...(info.multiValueAttributes.size > 0 && { multiValueAttributes: Array.from(info.multiValueAttributes).sort() }),
      ...(info.sportValues.size > 0 && { sportValues: Array.from(info.sportValues).sort() }),
      ...(info.cuisineValues.size > 0 && { cuisineValues: Array.from(info.cuisineValues).sort() }),
      ...(info.dietValues.size > 0 && { dietOptions: Array.from(info.dietValues).sort() }),
      ...(info.brandValues.size > 0 && { brandValues: Array.from(info.brandValues).sort().slice(0, 50) }), // Top 50 brands
    };
    
    console.log(` ${info.count.toLocaleString()} items, ${info.attributes.size} attributes`);
  }
  
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n📈 Total items across all types: ${grandTotal.toLocaleString()}`);
  console.log(`⏱️  Discovery completed in ${elapsedSec}s`);

  // Update total in schema
  schema.totalItems = grandTotal;

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Write schema file
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(schema, null, 2));
  
  const fileSizeKB = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1);
  
  console.log(`\n✅ Schema written to: ${OUTPUT_PATH}`);
  console.log(`   Size: ${fileSizeKB} KB`);
  
  // Print summary of queryable attributes
  console.log('\n📋 Key Queryable Attributes:');
  
  const allAttributes = new Set<string>();
  const allMultiValueAttrs = new Set<string>();
  
  for (const poiType of POI_TYPES) {
    const typeSchema = (schema.poiTypes as Record<string, { attributes: string[]; multiValueAttributes?: string[] }>)[poiType];
    if (typeSchema?.attributes) {
      typeSchema.attributes.forEach(a => allAttributes.add(a));
    }
    if (typeSchema?.multiValueAttributes) {
      typeSchema.multiValueAttributes.forEach(a => allMultiValueAttrs.add(a));
    }
  }
  
  const importantAttrs = [
    'sport', 'cuisine', 'opening_hours', 'outdoor_seating', 'indoor_seating',
    'takeaway', 'delivery', 'wheelchair', 'dog', 'internet_access',
    'brand', 'phone', 'website', 'addr:street', 'addr:city'
  ];
  
  for (const attr of importantAttrs) {
    const found = allAttributes.has(attr);
    console.log(`   ${found ? '✅' : '❌'} ${attr}`);
  }
  
  // Print multi-value attributes (important for API filtering)
  console.log('\n🔀 Multi-Value Attributes (use contains() for filtering):');
  for (const attr of Array.from(allMultiValueAttrs).sort()) {
    console.log(`   • ${attr}`);
  }
}

main().catch(console.error);
