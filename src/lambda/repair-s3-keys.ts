/**
 * Repair S3 Keys Lambda
 * 
 * Fixes URLs that have status='downloaded' but no s3_key.
 * Reconstructs the s3_key using the same hash function and verifies file exists.
 * 
 * Runs as orchestrator - scans DynamoDB and updates in batches.
 */

import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { createHash } from 'crypto';

const REGION = 'us-east-1';
const S3_BUCKET = 'puedo-casa-html-archive';
const URLS_TABLE = 'leo-urls';
const MAX_RUNTIME_MS = 14 * 60 * 1000; // 14 min

const s3 = new S3Client({ region: REGION });
const dynamodb = new DynamoDBClient({ region: REGION });

// Same function used by spider-single
function getS3Key(url: string, domain: string): string {
  const hash = createHash('md5').update(url).digest('hex').slice(0, 12);
  try {
    const urlPath = new URL(url).pathname.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50);
    return `html/${domain}/${hash}_${urlPath}.html`;
  } catch {
    return `html/${domain}/${hash}.html`;
  }
}

// Check if S3 file exists
async function s3FileExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

// Update URL with s3_key
async function updateUrlS3Key(url: string, s3Key: string): Promise<void> {
  await dynamodb.send(new UpdateItemCommand({
    TableName: URLS_TABLE,
    Key: { url: { S: url } },
    UpdateExpression: 'SET s3_key = :key',
    ExpressionAttributeValues: {
      ':key': { S: s3Key },
    },
  }));
}

// Mark URL as needing re-download (S3 file missing)
async function markNeedsRedownload(url: string): Promise<void> {
  await dynamodb.send(new UpdateItemCommand({
    TableName: URLS_TABLE,
    Key: { url: { S: url } },
    UpdateExpression: 'SET #st = :status, needs_redownload = :true',
    ExpressionAttributeNames: { '#st': 'status' },
    ExpressionAttributeValues: {
      ':status': { S: 'pending' },
      ':true': { BOOL: true },
    },
  }));
}

export async function handler() {
  const startTime = Date.now();
  console.log('🔧 Repair S3 Keys Started');
  
  let scanned = 0;
  let repaired = 0;
  let missing = 0;
  let lastKey: any = undefined;
  
  do {
    // Check timeout
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.log('⏱️ Time limit reached');
      break;
    }
    
    // Scan for URLs without s3_key
    const result = await dynamodb.send(new ScanCommand({
      TableName: URLS_TABLE,
      FilterExpression: '#st = :downloaded AND attribute_not_exists(s3_key)',
      ExpressionAttributeNames: { '#st': 'status', '#u': 'url', '#d': 'domain' },
      ExpressionAttributeValues: { ':downloaded': { S: 'downloaded' } },
      ProjectionExpression: '#u, #d',
      ExclusiveStartKey: lastKey,
    }));
    
    // Process batch
    for (const item of result.Items || []) {
      scanned++;
      const url = item.url?.S;
      const domain = item.domain?.S;
      
      if (!url || !domain) continue;
      
      // Reconstruct S3 key
      const s3Key = getS3Key(url, domain);
      
      // Check if file exists
      const exists = await s3FileExists(s3Key);
      
      if (exists) {
        // File found - update DynamoDB
        await updateUrlS3Key(url, s3Key);
        repaired++;
      } else {
        // File missing - mark for re-download
        await markNeedsRedownload(url);
        missing++;
      }
      
      // Progress log
      if (scanned % 1000 === 0) {
        console.log(`   Scanned ${scanned}, repaired ${repaired}, missing ${missing}`);
      }
    }
    
    lastKey = result.LastEvaluatedKey;
    
  } while (lastKey);
  
  const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
  
  console.log(`\n✅ Repair complete:`);
  console.log(`   Scanned: ${scanned.toLocaleString()}`);
  console.log(`   Repaired: ${repaired.toLocaleString()}`);
  console.log(`   Missing (need re-download): ${missing.toLocaleString()}`);
  console.log(`   Time: ${elapsedMin} min`);
  
  return {
    success: true,
    scanned,
    repaired,
    missing,
    elapsedMin: parseFloat(elapsedMin),
  };
}

