/**
 * Repair Single S3 Key Lambda
 * 
 * Fixes ONE S3 file by reading its metadata and updating DynamoDB.
 * Designed for 400 concurrent execution.
 * 
 * Input: { s3Key: "html/domain/hash_path.html" }
 */

import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const REGION = 'us-east-1';
const S3_BUCKET = 'puedo-casa-html-archive';
const URLS_TABLE = 'leo-urls';

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

interface Event {
  s3Key: string;
}

export async function handler(event: Event) {
  const { s3Key } = event;
  
  try {
    // Get source-url from S3 metadata
    const result = await s3.send(new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
    }));
    
    const sourceUrl = result.Metadata?.['source-url'];
    if (!sourceUrl) {
      return { success: false, s3Key, reason: 'no-metadata' };
    }
    
    // Normalize URL to match DynamoDB
    const normalizedUrl = normalizeUrl(sourceUrl);
    
    // Update DynamoDB with s3_key
    await dynamodb.send(new UpdateItemCommand({
      TableName: URLS_TABLE,
      Key: { url: { S: normalizedUrl } },
      UpdateExpression: 'SET s3_key = :key',
      ExpressionAttributeValues: {
        ':key': { S: s3Key },
      },
    }));
    
    return { success: true, s3Key, url: normalizedUrl };
    
  } catch (err: any) {
    return { success: false, s3Key, error: err.message };
  }
}

