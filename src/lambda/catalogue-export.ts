/**
 * Catalogue Export Lambda
 * 
 * Exports all listings from DynamoDB to S3 as a compressed JSON file.
 * This file is used by the /test-catalogue page for fast loading.
 * 
 * Schedule: Daily at 7:00 AM UTC (8:00 AM Spain), after all harvesters complete
 * 
 * The export:
 * 1. Queries all listings from all 7 domains in DynamoDB
 * 2. Compresses the data as gzipped JSON
 * 3. Uploads to S3 at catalogue/listings.json.gz
 * 4. Updates stats in DynamoDB for monitoring
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(zlib.gzip);

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
);

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const TABLE_NAME = 'leo-listings';
const STATS_TABLE = 'leo-harvest-stats';
const BUCKET_NAME = 'puedo-casa-html-archive';
const EXPORT_KEY = 'catalogue/listings.json.gz';

// All 7 harvester domains
const DOMAINS = [
  'lucasfox.com',
  'donpiso.com', 
  'tecnocasa.es',
  'century21.es',
  'engelvoelkers.com',
  'remax.es',
  'aproperties.es'
];

// Query all listings from a single domain (handles pagination)
async function queryAllFromDomain(domain: string): Promise<any[]> {
  const items: any[] = [];
  let lastKey: Record<string, any> | undefined;
  
  console.log(`  Querying ${domain}...`);

  do {
    const result = await dynamoClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: '#d = :domain',
      ExpressionAttributeNames: { '#d': 'domain' },
      ExpressionAttributeValues: { ':domain': domain },
      ExclusiveStartKey: lastKey,
    }));

    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  console.log(`  ${domain}: ${items.length} listings`);
  return items;
}

export const handler = async (event: any): Promise<any> => {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('Catalogue Export Lambda');
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  const startTime = Date.now();

  try {
    console.log('\n--- PHASE 1: Query All Domains ---');
    
    // Query all domains in parallel
    const results = await Promise.all(
      DOMAINS.map(domain => queryAllFromDomain(domain))
    );

    const allListings = results.flat();

    // Compute stats per domain
    const domains: Record<string, number> = {};
    for (const item of allListings) {
      const d = item.domain as string;
      domains[d] = (domains[d] || 0) + 1;
    }

    console.log('\n--- PHASE 2: Compress and Upload ---');

    // Create export data structure
    const exportData = {
      listings: allListings,
      domains,
      total: allListings.length,
      exportedAt: new Date().toISOString(),
    };

    // Gzip compress
    const jsonStr = JSON.stringify(exportData);
    const gzipped = await gzipAsync(Buffer.from(jsonStr));
    const sizeKB = Math.round(gzipped.length / 1024);

    console.log(`  Compressed: ${sizeKB} KB`);

    // Upload to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: EXPORT_KEY,
      Body: gzipped,
      ContentType: 'application/json',
      ContentEncoding: 'gzip',
    }));

    console.log(`  Uploaded to s3://${BUCKET_NAME}/${EXPORT_KEY}`);

    console.log('\n--- PHASE 3: Update Stats ---');

    // Update stats table for monitoring
    try {
    await dynamoClient.send(new PutCommand({
      TableName: STATS_TABLE,
      Item: {
          stat_id: 'catalogue_summary',
          domains,
          total: allListings.length,
          sizeKB,
        updated_at: new Date().toISOString(),
      },
    }));
      console.log('  Stats updated');
    } catch (statsError) {
      // Stats table might not exist, that's OK
      console.log('  Stats table not available (non-critical)');
    }

    const elapsed = Date.now() - startTime;
    
    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log('✅ EXPORT COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(`  Total listings: ${allListings.length}`);
    console.log(`  Domains: ${Object.keys(domains).length}`);
    console.log(`  Size: ${sizeKB} KB`);
    console.log(`  Duration: ${elapsed}ms`);
    console.log('');
    console.log('  Breakdown:');
    Object.entries(domains)
      .sort((a, b) => b[1] - a[1])
      .forEach(([domain, count]) => {
        console.log(`    ${domain}: ${count}`);
      });

    return {
      statusCode: 200,
      body: JSON.stringify({
      success: true,
        total: allListings.length,
        domains,
      sizeKB,
        elapsed,
        exportedAt: exportData.exportedAt,
      }),
    };

  } catch (error) {
    console.error('Export failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(error) }),
    };
  }
};

// For local testing
if (require.main === module) {
  handler({}).then(result => {
    console.log('Result:', result);
  }).catch(console.error);
}
