/**
 * serp-download-batch Lambda
 * 
 * Downloads SERP result pages and saves to S3.
 * Follows same pattern as daily-harvest-delta.
 * Auto-triggers serp-analyze-batch when complete.
 * 
 * Schedule: Manual or EventBridge
 * Timeout: 15 minutes
 * Memory: 512 MB
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHash } from 'crypto';

const REGION = process.env.AWS_REGION || 'us-east-1';
const S3_BUCKET = 'puedo-casa-html-archive';
const SERP_TABLE = 'leo-serp-extractions';
const TIMEOUT_MS = 14 * 60 * 1000; // 14 min (leave 1 min buffer)
const CONCURRENCY = 10;
const REQUEST_DELAY_MS = 200;

const s3 = new S3Client({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface Event {
  city?: string;
  batchSize?: number;
  skipAnalysis?: boolean;
}

interface SerpItem {
  page_id: string;
  neighborhood_id: string;
  url: string;
  query_category: string;
  credibility: number;
}

function getS3Key(url: string, neighborhoodId: string): string {
  const hash = createHash('md5').update(url).digest('hex').slice(0, 12);
  try {
    const domain = new URL(url).hostname.replace('www.', '').slice(0, 30);
    return `serp-html/${neighborhoodId}/${hash}_${domain}.html`;
  } catch {
    return `serp-html/${neighborhoodId}/${hash}_unknown.html`;
  }
}

async function existsInS3(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function getUrlsToDownload(cityFilter?: string, limit?: number): Promise<SerpItem[]> {
  const items: SerpItem[] = [];
  let lastKey: Record<string, any> | undefined;
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: SERP_TABLE,
      FilterExpression: cityFilter 
        ? 'begins_with(neighborhood_id, :city) AND attribute_not_exists(download_status)'
        : 'attribute_not_exists(download_status)',
      ExpressionAttributeValues: cityFilter ? { ':city': cityFilter } : undefined,
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      items.push(item as SerpItem);
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey && items.length < (limit || 10000));
  
  // Group by neighborhood + category, take top 5 by credibility
  const grouped = new Map<string, SerpItem[]>();
  for (const item of items) {
    const key = `${item.neighborhood_id}:${item.query_category}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }
  
  const selected: SerpItem[] = [];
  for (const [, groupItems] of grouped) {
    const top = groupItems.sort((a, b) => (b.credibility || 0) - (a.credibility || 0)).slice(0, 5);
    selected.push(...top);
  }
  
  return limit ? selected.slice(0, limit) : selected;
}

async function downloadAndStore(item: SerpItem): Promise<{ success: boolean; size?: number; skipped?: boolean }> {
  const s3Key = getS3Key(item.url, item.neighborhood_id);
  
  // Skip if already in S3
  if (await existsInS3(s3Key)) {
    await updateStatus(item, 'skipped', s3Key);
    return { success: true, skipped: true };
  }
  
  try {
    const response = await fetch(item.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });
    
    if (!response.ok) {
      await updateStatus(item, 'failed');
      return { success: false };
    }
    
    const html = await response.text();
    if (html.length < 500) {
      await updateStatus(item, 'failed');
      return { success: false };
    }
    
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: html,
      ContentType: 'text/html; charset=utf-8',
      Metadata: {
        'source-url': item.url.slice(0, 512),
        'neighborhood-id': item.neighborhood_id,
        'query-category': item.query_category,
      },
    }));
    
    await updateStatus(item, 'downloaded', s3Key);
    return { success: true, size: html.length };
    
  } catch (err: any) {
    await updateStatus(item, 'failed');
    return { success: false };
  }
}

async function updateStatus(item: SerpItem, status: string, s3Key?: string): Promise<void> {
  const values: Record<string, any> = {
    ':status': status,
    ':time': new Date().toISOString(),
  };
  
  let updateExpr = 'SET download_status = :status, downloaded_at = :time';
  if (s3Key) {
    updateExpr += ', s3_key = :key';
    values[':key'] = s3Key;
  }
  
  try {
    await docClient.send(new UpdateCommand({
      TableName: SERP_TABLE,
      Key: { page_id: item.page_id, neighborhood_id: item.neighborhood_id },
      UpdateExpression: updateExpr,
      ExpressionAttributeValues: values,
    }));
  } catch (err) {
    console.error(`Failed to update status for ${item.url}:`, err);
  }
}

// Import analyze function for auto-trigger
import { handler as analyzeHandler } from './serp-analyze-batch';

export async function handler(event: Event) {
  const startTime = Date.now();
  const { city, batchSize = 5000, skipAnalysis = false } = event;
  
  console.log(`🕷️ SERP Download Batch starting${city ? ` (city: ${city})` : ''}`);
  
  const urls = await getUrlsToDownload(city, batchSize);
  console.log(`📊 Found ${urls.length} URLs to download`);
  
  if (urls.length === 0) {
    console.log('No URLs to download, triggering analysis...');
    if (!skipAnalysis) {
      const analyzeResult = await analyzeHandler({ city });
      return { downloaded: 0, analyzeResult };
    }
    return { downloaded: 0 };
  }
  
  let downloaded = 0;
  let failed = 0;
  let skipped = 0;
  
  // Process in batches with concurrency
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    // Check timeout
    if (Date.now() - startTime > TIMEOUT_MS) {
      console.log(`⏱️ Timeout after ${downloaded + failed + skipped} URLs`);
      break;
    }
    
    const batch = urls.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(item => downloadAndStore(item)));
    
    for (const result of results) {
      if (result.success) {
        if (result.skipped) skipped++;
        else downloaded++;
      } else {
        failed++;
      }
    }
    
    if ((i + CONCURRENCY) % 100 === 0 || i + CONCURRENCY >= urls.length) {
      console.log(`Progress: ${Math.min(i + CONCURRENCY, urls.length)}/${urls.length} | ✅ ${downloaded} | ⏭️ ${skipped} | ❌ ${failed}`);
    }
    
    await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
  }
  
  const stats = {
    total: urls.length,
    downloaded,
    skipped,
    failed,
    timeMs: Date.now() - startTime,
  };
  
  console.log(`\n✅ Download complete: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`);
  
  // Auto-trigger analysis when downloads complete
  if (!skipAnalysis && downloaded + skipped > 0) {
    console.log('\n🔍 Auto-triggering neighborhood analysis...\n');
    const analyzeResult = await analyzeHandler({ city });
    return { ...stats, analyzeResult };
  }
  
  return stats;
}

// Run as script
if (require.main === module) {
  const args = process.argv.slice(2);
  const cityArg = args.find(a => a.startsWith('--city='));
  const city = cityArg?.split('=')[1];
  
  handler({ city }).then(result => {
    console.log('\n📊 Final Result:', JSON.stringify(result, null, 2));
  }).catch(console.error);
}

