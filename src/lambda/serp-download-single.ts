/**
 * serp-download-single Lambda
 * 
 * Downloads a single SERP result page and saves to S3.
 * Triggered by orchestrator for each URL.
 * 
 * Input: { url, neighborhoodId, category, pageId }
 * Output: { success, s3Key, size }
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHash } from 'crypto';

const REGION = process.env.AWS_REGION || 'us-east-1';
const S3_BUCKET = 'puedo-casa-html-archive';
const SERP_TABLE = 'leo-serp-extractions';
const SCRAPINGDOG_KEY = process.env.SCRAPINGDOG_API_KEY;

const s3 = new S3Client({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface Event {
  url: string;
  neighborhoodId: string;
  category: string;
  pageId: string;
  useScrapingDog?: boolean;
}

function getS3Key(url: string, neighborhoodId: string): string {
  const hash = createHash('md5').update(url).digest('hex').slice(0, 12);
  const domain = new URL(url).hostname.replace('www.', '').slice(0, 30);
  return `serp-html/${neighborhoodId}/${hash}_${domain}.html`;
}

async function downloadWithScrapingDog(url: string): Promise<string | null> {
  if (!SCRAPINGDOG_KEY) return null;
  
  const apiUrl = `https://api.scrapingdog.com/scrape?api_key=${SCRAPINGDOG_KEY}&url=${encodeURIComponent(url)}&dynamic=false`;
  
  try {
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) return null;
    
    const html = await response.text();
    if (html.startsWith('{') && html.includes('"error"')) return null;
    if (html.length < 500) return null;
    
    return html;
  } catch {
    return null;
  }
}

async function downloadDirect(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });
    
    if (!response.ok) return null;
    const html = await response.text();
    return html.length > 500 ? html : null;
  } catch {
    return null;
  }
}

async function updateStatus(pageId: string, neighborhoodId: string, s3Key: string | null, status: string): Promise<void> {
  const updateExpr = s3Key 
    ? 'SET s3_key = :key, download_status = :status, downloaded_at = :time'
    : 'SET download_status = :status, downloaded_at = :time';
  
  const values: Record<string, any> = {
    ':status': status,
    ':time': new Date().toISOString(),
  };
  
  if (s3Key) values[':key'] = s3Key;
  
  await docClient.send(new UpdateCommand({
    TableName: SERP_TABLE,
    Key: { page_id: pageId, neighborhood_id: neighborhoodId },
    UpdateExpression: updateExpr,
    ExpressionAttributeValues: values,
  }));
}

export async function handler(event: Event) {
  const { url, neighborhoodId, category, pageId, useScrapingDog } = event;
  
  console.log(`📥 Downloading: ${url.slice(0, 60)}...`);
  
  try {
    // Try direct first, then ScrapingDog if needed
    let html = await downloadDirect(url);
    
    if (!html && useScrapingDog) {
      console.log('  ↪ Trying ScrapingDog...');
      html = await downloadWithScrapingDog(url);
    }
    
    if (!html) {
      await updateStatus(pageId, neighborhoodId, null, 'failed');
      return { success: false, url, error: 'Download failed' };
    }
    
    // Save to S3
    const s3Key = getS3Key(url, neighborhoodId);
    
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: html,
      ContentType: 'text/html; charset=utf-8',
      Metadata: {
        'source-url': url,
        'neighborhood-id': neighborhoodId,
        'query-category': category,
        'downloaded-at': new Date().toISOString(),
      },
    }));
    
    await updateStatus(pageId, neighborhoodId, s3Key, 'downloaded');
    
    console.log(`  ✅ Saved: ${s3Key} (${(html.length / 1024).toFixed(1)} KB)`);
    
    return { success: true, url, s3Key, size: html.length };
    
  } catch (err: any) {
    console.error(`  ❌ Error: ${err.message}`);
    await updateStatus(pageId, neighborhoodId, null, 'failed');
    return { success: false, url, error: err.message };
  }
}

