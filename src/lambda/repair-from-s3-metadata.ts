/**
 * Repair S3 Keys from Metadata
 * 
 * Scans S3 bucket, reads source-url metadata, and updates DynamoDB.
 * This fixes the URL normalization mismatch from the spider.
 * 
 * Runs as orchestrator - 15 min max runtime.
 */

import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';

const REGION = 'us-east-1';
const S3_BUCKET = 'puedo-casa-html-archive';
const URLS_TABLE = 'leo-urls';
const MAX_RUNTIME_MS = 14 * 60 * 1000;
const BATCH_SIZE = 100; // Process 100 S3 files in parallel

const s3 = new S3Client({ region: REGION });
const dynamodb = new DynamoDBClient({ region: REGION });

// Normalize URL (same as spider)
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    let normalized = `${u.protocol}//${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '') || '/'}`;
    if (u.search) {
      const params = new URLSearchParams(u.search);
      params.sort();
      normalized += `?${params.toString()}`;
    }
    return normalized;
  } catch {
    return url;
  }
}

// Get source-url from S3 metadata
async function getS3Metadata(key: string): Promise<string | null> {
  try {
    const result = await s3.send(new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }));
    return result.Metadata?.['source-url'] || null;
  } catch {
    return null;
  }
}

// Check if URL exists in DynamoDB
async function urlExists(url: string): Promise<boolean> {
  try {
    const result = await dynamodb.send(new GetItemCommand({
      TableName: URLS_TABLE,
      Key: { url: { S: url } },
      ProjectionExpression: '#u',
      ExpressionAttributeNames: { '#u': 'url' },
    }));
    return !!result.Item;
  } catch {
    return false;
  }
}

// Update URL with s3_key
async function updateUrlS3Key(url: string, s3Key: string): Promise<boolean> {
  try {
    await dynamodb.send(new UpdateItemCommand({
      TableName: URLS_TABLE,
      Key: { url: { S: url } },
      UpdateExpression: 'SET s3_key = :key',
      ExpressionAttributeValues: {
        ':key': { S: s3Key },
      },
      ConditionExpression: 'attribute_exists(#u)',
      ExpressionAttributeNames: { '#u': 'url' },
    }));
    return true;
  } catch {
    return false;
  }
}

export async function handler(event?: { startAfter?: string }) {
  const startTime = Date.now();
  const startAfter = event?.startAfter;
  
  console.log('🔧 Repair from S3 Metadata Started');
  if (startAfter) console.log(`   Continuing from: ${startAfter}`);
  
  let scanned = 0;
  let repaired = 0;
  let notFound = 0;
  let noMetadata = 0;
  let continuationToken: string | undefined;
  let lastKey = '';
  
  do {
    // Check timeout
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.log('⏱️ Time limit reached');
      break;
    }
    
    // List S3 objects
    const listResult = await s3.send(new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: 'html/',
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
      StartAfter: startAfter || undefined,
    }));
    
    const keys = listResult.Contents?.map(obj => obj.Key!).filter(Boolean) || [];
    
    // Process in batches for parallelism
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);
      
      const results = await Promise.all(batch.map(async (key) => {
        // Get source-url from metadata
        const sourceUrl = await getS3Metadata(key);
        if (!sourceUrl) {
          return { status: 'no-metadata' };
        }
        
        // Normalize URL to match DynamoDB
        const normalizedUrl = normalizeUrl(sourceUrl);
        
        // Update DynamoDB
        const updated = await updateUrlS3Key(normalizedUrl, key);
        
        return { status: updated ? 'repaired' : 'not-found', key };
      }));
      
      for (const r of results) {
        scanned++;
        if (r.status === 'repaired') repaired++;
        else if (r.status === 'not-found') notFound++;
        else noMetadata++;
      }
      
      lastKey = batch[batch.length - 1];
      
      // Progress log
      if (scanned % 5000 === 0) {
        console.log(`   Scanned ${scanned.toLocaleString()}, repaired ${repaired.toLocaleString()}, not-found ${notFound.toLocaleString()}`);
      }
    }
    
    continuationToken = listResult.NextContinuationToken;
    
  } while (continuationToken);
  
  const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
  
  console.log(`\n✅ Repair complete:`);
  console.log(`   S3 files scanned: ${scanned.toLocaleString()}`);
  console.log(`   DynamoDB records updated: ${repaired.toLocaleString()}`);
  console.log(`   Not found in DynamoDB: ${notFound.toLocaleString()}`);
  console.log(`   No metadata: ${noMetadata.toLocaleString()}`);
  console.log(`   Time: ${elapsedMin} min`);
  console.log(`   Last key processed: ${lastKey}`);
  
  return {
    success: true,
    scanned,
    repaired,
    notFound,
    noMetadata,
    elapsedMin: parseFloat(elapsedMin),
    lastKey,
    hasMore: !!continuationToken,
  };
}

