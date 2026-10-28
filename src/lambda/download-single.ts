/**
 * download-single Lambda
 * 
 * Simple: Takes 1 URL, downloads HTML, saves to S3.
 * One Lambda = One URL.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { createHash } from 'crypto';

const REGION = 'us-east-1';
const S3_BUCKET = 'puedo-casa-html-archive';
const URLS_TABLE = 'leo-urls';

const s3 = new S3Client({ region: REGION });
const dynamodb = new DynamoDBClient({ region: REGION });

interface Event {
  url: string;
  domain: string;
}

// Generate S3 key from URL
function getS3Key(url: string, domain: string): string {
  const hash = createHash('md5').update(url).digest('hex').slice(0, 12);
  const urlPath = new URL(url).pathname.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50);
  return `html/${domain}/${hash}_${urlPath}.html`;
}

// Update URL status in DynamoDB
async function updateStatus(url: string, status: 'downloaded' | 'failed', s3Key?: string, errorMsg?: string): Promise<void> {
  const updates: string[] = ['#st = :status', 'downloaded_at = :time'];
  const names: Record<string, string> = { '#st': 'status' };
  const values: any = {
    ':status': { S: status },
    ':time': { S: new Date().toISOString() },
  };
  
  if (s3Key) {
    updates.push('s3_key = :key');
    values[':key'] = { S: s3Key };
  }
  if (errorMsg) {
    updates.push('#err = :err');
    names['#err'] = 'error';
    values[':err'] = { S: errorMsg.slice(0, 500) };
  }
  
  await dynamodb.send(new UpdateItemCommand({
    TableName: URLS_TABLE,
    Key: { url: { S: url } },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

export async function handler(event: Event) {
  const { url, domain } = event;
  
  try {
    // Download HTML
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; PuedoCasa/1.0; +https://puedocasa.com)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(30000),
      redirect: 'follow',
    });
    
    if (!response.ok) {
      await updateStatus(url, 'failed', undefined, `HTTP ${response.status}`);
      return { success: false, url, error: `HTTP ${response.status}` };
    }
    
    const html = await response.text();
    
    // Skip if too small (likely error page)
    if (html.length < 1000) {
      await updateStatus(url, 'failed', undefined, 'Page too small');
      return { success: false, url, error: 'Page too small' };
    }
    
    // Save to S3
    const s3Key = getS3Key(url, domain);
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: html,
      ContentType: 'text/html; charset=utf-8',
      Metadata: {
        'source-url': url,
        'domain': domain,
        'downloaded-at': new Date().toISOString(),
      },
    }));
    
    // Update status
    await updateStatus(url, 'downloaded', s3Key);
    
    return { success: true, url, s3Key, size: html.length };
    
  } catch (err: any) {
    const errorMsg = err.message || 'Unknown error';
    await updateStatus(url, 'failed', undefined, errorMsg);
    return { success: false, url, error: errorMsg };
  }
}

