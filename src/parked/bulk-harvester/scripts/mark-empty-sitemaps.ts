/**
 * Mark domains with empty/broken sitemaps
 * 
 * Updates leo-scraping-rules:
 * - sitemap_status: 'empty' | 'working'
 * - needs_spider: true (for empty sitemaps)
 */

import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const db = new DynamoDBClient({ region: 'us-east-1' });

async function main() {
  console.log('🔍 Checking sitemap results...\n');
  
  // Get all sitemapped domains
  const sitemapped = new Set<string>();
  let lastKey: any = undefined;
  do {
    const r = await db.send(new ScanCommand({ 
      TableName: 'leo-scraping-rules', 
      FilterExpression: 'has_sitemap = :t',
      ExpressionAttributeValues: { ':t': { BOOL: true } },
      ProjectionExpression: '#d',
      ExpressionAttributeNames: { '#d': 'domain' },
      ExclusiveStartKey: lastKey 
    }));
    for (const item of r.Items || []) {
      if (item.domain?.S) sitemapped.add(item.domain.S);
    }
    lastKey = r.LastEvaluatedKey;
  } while (lastKey);
  
  console.log(`Sitemapped domains: ${sitemapped.size}`);
  
  // Get domains with URLs
  const withUrls = new Set<string>();
  lastKey = undefined;
  do {
    const r = await db.send(new ScanCommand({ 
      TableName: 'leo-urls', 
      ProjectionExpression: '#d',
      ExpressionAttributeNames: { '#d': 'domain' },
      ExclusiveStartKey: lastKey 
    }));
    for (const item of r.Items || []) {
      if (item.domain?.S) withUrls.add(item.domain.S);
    }
    lastKey = r.LastEvaluatedKey;
  } while (lastKey);
  
  console.log(`Domains with URLs: ${withUrls.size}`);
  
  // Find empty sitemaps
  const emptyDomains = [...sitemapped].filter(d => !withUrls.has(d));
  const workingDomains = [...sitemapped].filter(d => withUrls.has(d));
  
  console.log(`Empty sitemaps: ${emptyDomains.length}`);
  console.log(`Working sitemaps: ${workingDomains.length}\n`);
  
  // Update empty sitemap domains
  console.log('📝 Marking empty sitemap domains (needs_spider = true)...');
  let updated = 0;
  for (const domain of emptyDomains) {
    await db.send(new UpdateItemCommand({
      TableName: 'leo-scraping-rules',
      Key: { domain: { S: domain } },
      UpdateExpression: 'SET sitemap_status = :status, needs_spider = :spider',
      ExpressionAttributeValues: {
        ':status': { S: 'empty' },
        ':spider': { BOOL: true },
      },
    }));
    updated++;
    if (updated % 50 === 0) {
      process.stdout.write(`\r   Updated ${updated}/${emptyDomains.length}`);
    }
  }
  console.log(`\r   Updated ${updated}/${emptyDomains.length}`);
  
  // Update working sitemap domains
  console.log('\n📝 Marking working sitemap domains...');
  updated = 0;
  for (const domain of workingDomains) {
    await db.send(new UpdateItemCommand({
      TableName: 'leo-scraping-rules',
      Key: { domain: { S: domain } },
      UpdateExpression: 'SET sitemap_status = :status, needs_spider = :spider',
      ExpressionAttributeValues: {
        ':status': { S: 'working' },
        ':spider': { BOOL: false },
      },
    }));
    updated++;
    if (updated % 100 === 0) {
      process.stdout.write(`\r   Updated ${updated}/${workingDomains.length}`);
    }
  }
  console.log(`\r   Updated ${updated}/${workingDomains.length}`);
  
  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Sitemapped domains: ${sitemapped.size}`);
  console.log(`   Working sitemaps: ${workingDomains.length}`);
  console.log(`   Empty/broken sitemaps: ${emptyDomains.length} (marked needs_spider=true)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);

