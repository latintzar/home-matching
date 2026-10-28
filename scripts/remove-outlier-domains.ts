/**
 * Remove Outlier Domains from DynamoDB
 * 
 * Reads the outlier domain list and deletes ALL URLs from those domains
 * from the leo-urls table.
 * 
 * Usage:
 *   npx tsx scripts/remove-outlier-domains.ts --dry-run
 *   npx tsx scripts/remove-outlier-domains.ts
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import * as fs from 'fs';

const REGION = process.env.AWS_REGION || 'us-east-1';
const URLS_TABLE = 'leo-urls';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

async function getUrlsForDomain(domain: string): Promise<string[]> {
  const urls: string[] = [];
  let lastKey: Record<string, any> | undefined;
  
  do {
    const result = await ddb.send(new QueryCommand({
      TableName: URLS_TABLE,
      IndexName: 'domain-index',
      KeyConditionExpression: '#d = :domain',
      ExpressionAttributeNames: { '#d': 'domain' },
      ExpressionAttributeValues: { ':domain': domain },
      ProjectionExpression: '#url',
      ExpressionAttributeNames: { '#d': 'domain', '#url': 'url' },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      urls.push(item.url);
    }
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return urls;
}

async function deleteUrls(urls: string[]): Promise<number> {
  let deleted = 0;
  
  // Batch delete in groups of 25 (DynamoDB limit)
  for (let i = 0; i < urls.length; i += 25) {
    const batch = urls.slice(i, i + 25);
    
    await ddb.send(new BatchWriteCommand({
      RequestItems: {
        [URLS_TABLE]: batch.map(url => ({
          DeleteRequest: { Key: { url } },
        })),
      },
    }));
    
    deleted += batch.length;
  }
  
  return deleted;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  // Read outlier domains
  const outlierFile = 'data/all_outlier_domains_unique.txt';
  const outlierDomains = fs.readFileSync(outlierFile, 'utf-8')
    .split('\n')
    .map(d => d.trim())
    .filter(d => d.length > 0);
  
  console.log(`=== REMOVE OUTLIER DOMAINS FROM DYNAMODB ===`);
  console.log(`Outlier domains to process: ${outlierDomains.length}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE DELETE'}`);
  console.log('');
  
  let totalUrls = 0;
  let totalDeleted = 0;
  const stats: Array<{ domain: string; urls: number }> = [];
  
  for (const domain of outlierDomains) {
    const urls = await getUrlsForDomain(domain);
    
    if (urls.length > 0) {
      stats.push({ domain, urls: urls.length });
      totalUrls += urls.length;
      
      console.log(`${domain}: ${urls.length} URLs`);
      
      if (!dryRun) {
        const deleted = await deleteUrls(urls);
        totalDeleted += deleted;
        console.log(`  ✅ Deleted ${deleted} URLs`);
      }
    }
  }
  
  console.log('');
  console.log('========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log(`Domains with URLs: ${stats.length}`);
  console.log(`Total URLs found: ${totalUrls}`);
  
  if (dryRun) {
    console.log(`Would delete: ${totalUrls} URLs`);
    console.log('');
    console.log('Run without --dry-run to actually delete.');
  } else {
    console.log(`Deleted: ${totalDeleted} URLs`);
  }
  
  // Save stats
  fs.writeFileSync(
    'data/outlier_removal_stats.json',
    JSON.stringify({ stats, totalUrls, totalDeleted, dryRun }, null, 2)
  );
  console.log('');
  console.log('Stats saved to: data/outlier_removal_stats.json');
}

main().catch(console.error);

