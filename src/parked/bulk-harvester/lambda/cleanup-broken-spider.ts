/**
 * Cleanup Broken Spider Data
 * 
 * 1. Deletes all spider URLs without s3_key from DynamoDB
 * 2. Resets all spider domains for re-crawl
 * 3. Deletes orphan S3 files (HTML files with no DynamoDB match)
 * 
 * Runs in AWS - no laptop needed.
 */

import { DynamoDBClient, ScanCommand, DeleteItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const REGION = 'us-east-1';
const URLS_TABLE = 'leo-urls';
const RULES_TABLE = 'leo-scraping-rules';
const S3_BUCKET = 'puedo-casa-html-archive';
const MAX_RUNTIME_MS = 14 * 60 * 1000;

const dynamodb = new DynamoDBClient({ region: REGION });
const s3 = new S3Client({ region: REGION });

export async function handler() {
  const startTime = Date.now();
  console.log('🧹 Cleanup Broken Spider Data');
  
  let urlsDeleted = 0;
  let domainsReset = 0;
  
  // Phase 1: Delete broken spider URLs
  console.log('\n📍 Phase 1: Deleting broken spider URLs...');
  let lastKey: any = undefined;
  
  do {
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.log('⏱️ Time limit reached during URL deletion');
      break;
    }
    
    const result = await dynamodb.send(new ScanCommand({
      TableName: URLS_TABLE,
      FilterExpression: '#st = :downloaded AND attribute_not_exists(s3_key) AND #src = :spider',
      ExpressionAttributeNames: { '#st': 'status', '#src': 'source', '#u': 'url' },
      ExpressionAttributeValues: { 
        ':downloaded': { S: 'downloaded' },
        ':spider': { S: 'spider' }
      },
      ProjectionExpression: '#u',
      ExclusiveStartKey: lastKey,
      Limit: 1000,
    }));
    
    // Delete in parallel
    const deletes = (result.Items || []).map(async item => {
      try {
        await dynamodb.send(new DeleteItemCommand({
          TableName: URLS_TABLE,
          Key: { url: { S: item.url!.S! } },
        }));
        return true;
      } catch {
        return false;
      }
    });
    
    const results = await Promise.all(deletes);
    urlsDeleted += results.filter(Boolean).length;
    
    if (urlsDeleted % 10000 < 1000) {
      console.log(`   Deleted ${urlsDeleted.toLocaleString()} URLs...`);
    }
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  console.log(`   ✅ Deleted ${urlsDeleted.toLocaleString()} broken URLs`);
  
  // Phase 2: Reset spider domains
  console.log('\n📍 Phase 2: Resetting spider domains...');
  lastKey = undefined;
  
  do {
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.log('⏱️ Time limit reached during domain reset');
      break;
    }
    
    const result = await dynamodb.send(new ScanCommand({
      TableName: RULES_TABLE,
      FilterExpression: 'attribute_exists(spider_status)',
      ProjectionExpression: '#d',
      ExpressionAttributeNames: { '#d': 'domain' },
      ExclusiveStartKey: lastKey,
      Limit: 100,
    }));
    
    // Reset domains in parallel
    const updates = (result.Items || []).map(async item => {
      try {
        await dynamodb.send(new UpdateItemCommand({
          TableName: RULES_TABLE,
          Key: { domain: { S: item.domain!.S! } },
          UpdateExpression: 'SET needs_spider = :true REMOVE spider_status, spider_stats, spider_completed_at',
          ExpressionAttributeValues: { ':true': { BOOL: true } },
        }));
        return true;
      } catch {
        return false;
      }
    });
    
    const results = await Promise.all(updates);
    domainsReset += results.filter(Boolean).length;
    
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  console.log(`   ✅ Reset ${domainsReset.toLocaleString()} domains`);
  
  // Phase 3: Collect spider domains for S3 cleanup
  console.log('\n📍 Phase 3: Collecting spider domains...');
  const spiderDomains = new Set<string>();
  lastKey = undefined;
  
  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: RULES_TABLE,
      FilterExpression: 'needs_spider = :true',
      ExpressionAttributeValues: { ':true': { BOOL: true } },
      ProjectionExpression: '#d',
      ExpressionAttributeNames: { '#d': 'domain' },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      if (item.domain?.S) spiderDomains.add(item.domain.S);
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  console.log(`   Found ${spiderDomains.size} spider domains`);
  
  // Phase 4: Delete S3 files for spider domains only
  console.log('\n📍 Phase 4: Deleting S3 files for spider domains...');
  let s3Deleted = 0;
  
  for (const domain of spiderDomains) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.log('⏱️ Time limit reached during S3 cleanup');
      break;
    }
    
    let continuationToken: string | undefined;
    
    do {
      const listResult = await s3.send(new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: `html/${domain}/`,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      }));
      
      const keys = listResult.Contents?.map(obj => obj.Key!).filter(Boolean) || [];
      
      if (keys.length > 0) {
        await s3.send(new DeleteObjectsCommand({
          Bucket: S3_BUCKET,
          Delete: {
            Objects: keys.map(Key => ({ Key })),
            Quiet: true,
          },
        }));
        s3Deleted += keys.length;
      }
      
      continuationToken = listResult.NextContinuationToken;
    } while (continuationToken);
    
    if (s3Deleted % 10000 < 1000) {
      console.log(`   Deleted ${s3Deleted.toLocaleString()} S3 files...`);
    }
  }
  
  console.log(`   ✅ Deleted ${s3Deleted.toLocaleString()} S3 files from spider domains`);
  
  const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
  
  console.log(`\n✅ Cleanup complete in ${elapsedMin} min:`);
  console.log(`   URLs deleted: ${urlsDeleted.toLocaleString()}`);
  console.log(`   Domains reset: ${domainsReset.toLocaleString()}`);
  console.log(`   S3 files deleted: ${s3Deleted.toLocaleString()}`);
  
  return {
    success: true,
    urlsDeleted,
    domainsReset,
    s3Deleted,
    elapsedMin: parseFloat(elapsedMin),
  };
}

