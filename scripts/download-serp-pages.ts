/**
 * Download SERP Pages for Neighborhood Analysis
 * 
 * Downloads full HTML from URLs in leo-serp-extractions table.
 * Stores in S3 under serp-html/ prefix for later Gemini analysis.
 * 
 * Uses ScrapingDog for better success rate on blogs/forums.
 * 
 * Usage:
 *   npx tsx scripts/download-serp-pages.ts [--city=<city>] [--limit=<n>] [--dry-run]
 * 
 * Cost estimate: ~$0.001 per page × 1720 pages = ~$1.72
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHash } from 'crypto';

const REGION = 'us-east-1';
const S3_BUCKET = 'puedo-casa-html-archive';
const SERP_TABLE = 'leo-serp-extractions';
const SCRAPINGDOG_KEY = process.env.SCRAPINGDOG_API_KEY;

const s3 = new S3Client({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface SerpItem {
  page_id: string;
  neighborhood_id: string;
  url: string;
  title: string;
  snippet: string;
  query_category: string;
  credibility: number;
  position: number;
  s3_key?: string;
  download_status?: string;
}

interface DownloadStats {
  total: number;
  downloaded: number;
  failed: number;
  skipped: number;
}

// Generate S3 key from URL
function getS3Key(url: string, neighborhoodId: string): string {
  const hash = createHash('md5').update(url).digest('hex').slice(0, 12);
  const domain = new URL(url).hostname.replace('www.', '');
  return `serp-html/${neighborhoodId}/${hash}_${domain}.html`;
}

// Download using ScrapingDog
async function downloadWithScrapingDog(url: string): Promise<string | null> {
  if (!SCRAPINGDOG_KEY) {
    throw new Error('SCRAPINGDOG_API_KEY not set');
  }
  
  const apiUrl = `https://api.scrapingdog.com/scrape?api_key=${SCRAPINGDOG_KEY}&url=${encodeURIComponent(url)}&dynamic=false`;
  
  try {
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      console.log(`    ⚠️ ScrapingDog error: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Check if it's actually HTML (ScrapingDog sometimes returns JSON errors)
    if (html.startsWith('{') && html.includes('"error"')) {
      console.log(`    ⚠️ ScrapingDog returned error: ${html.slice(0, 100)}`);
      return null;
    }
    
    // Skip if too small
    if (html.length < 500) {
      console.log(`    ⚠️ Page too small: ${html.length} bytes`);
      return null;
    }
    
    return html;
    
  } catch (err: any) {
    console.log(`    ⚠️ Download error: ${err.message}`);
    return null;
  }
}

// Simple fetch fallback (for sites that don't need ScrapingDog)
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
    
    if (!response.ok) {
      return null;
    }
    
    const html = await response.text();
    return html.length > 500 ? html : null;
    
  } catch {
    return null;
  }
}

// Update SERP item with download status
async function updateSerpItem(pageId: string, neighborhoodId: string, s3Key: string | null, status: string): Promise<void> {
  const updateExpr = s3Key 
    ? 'SET s3_key = :key, download_status = :status, downloaded_at = :time'
    : 'SET download_status = :status, downloaded_at = :time';
  
  const values: any = {
    ':status': status,
    ':time': new Date().toISOString(),
  };
  
  if (s3Key) {
    values[':key'] = s3Key;
  }
  
  await docClient.send(new UpdateCommand({
    TableName: SERP_TABLE,
    Key: { page_id: pageId, neighborhood_id: neighborhoodId },
    UpdateExpression: updateExpr,
    ExpressionAttributeValues: values,
  }));
}

// Get URLs to download (prioritize by credibility, limit per category)
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
  } while (lastKey);
  
  // Group by neighborhood + category, take top 5 by credibility
  const grouped = new Map<string, SerpItem[]>();
  for (const item of items) {
    const key = `${item.neighborhood_id}:${item.query_category}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(item);
  }
  
  const selected: SerpItem[] = [];
  for (const [, groupItems] of grouped) {
    // Sort by credibility desc, take top 5
    const top = groupItems
      .sort((a, b) => (b.credibility || 0) - (a.credibility || 0))
      .slice(0, 5);
    selected.push(...top);
  }
  
  // Apply limit
  const result = limit ? selected.slice(0, limit) : selected;
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const cityArg = args.find(a => a.startsWith('--city='));
  const limitArg = args.find(a => a.startsWith('--limit='));
  const dryRun = args.includes('--dry-run');
  const useScrapingDog = args.includes('--scrapingdog');
  
  const cityFilter = cityArg?.split('=')[1];
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;
  
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     DOWNLOAD SERP PAGES FOR ANALYSIS                         ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Downloads full HTML from SERP result URLs                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - no downloads or writes\n');
  }
  
  if (useScrapingDog) {
    if (!SCRAPINGDOG_KEY) {
      console.error('❌ SCRAPINGDOG_API_KEY not set');
      process.exit(1);
    }
    console.log('🐕 Using ScrapingDog for downloads\n');
  } else {
    console.log('📡 Using direct fetch (faster, but may miss some sites)\n');
  }
  
  // Get URLs to download
  const urls = await getUrlsToDownload(cityFilter, limit);
  console.log(`📊 Found ${urls.length} URLs to download${cityFilter ? ` (city: ${cityFilter})` : ''}\n`);
  
  if (dryRun) {
    // Just show sample
    console.log('Sample URLs:');
    for (const item of urls.slice(0, 10)) {
      console.log(`  - ${item.neighborhood_id} [${item.query_category}]: ${item.url.slice(0, 60)}...`);
    }
    return;
  }
  
  const stats: DownloadStats = { total: urls.length, downloaded: 0, failed: 0, skipped: 0 };
  
  for (let i = 0; i < urls.length; i++) {
    const item = urls[i];
    const progress = `[${i + 1}/${urls.length}]`;
    
    console.log(`${progress} ${item.neighborhood_id} [${item.query_category}]`);
    console.log(`    URL: ${item.url.slice(0, 70)}...`);
    
    // Download
    const html = useScrapingDog 
      ? await downloadWithScrapingDog(item.url)
      : await downloadDirect(item.url);
    
    if (!html) {
      await updateSerpItem(item.page_id, item.neighborhood_id, null, 'failed');
      stats.failed++;
      continue;
    }
    
    // Save to S3
    const s3Key = getS3Key(item.url, item.neighborhood_id);
    
    try {
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: html,
        ContentType: 'text/html; charset=utf-8',
        Metadata: {
          'source-url': item.url,
          'neighborhood-id': item.neighborhood_id,
          'query-category': item.query_category,
          'downloaded-at': new Date().toISOString(),
        },
      }));
      
      await updateSerpItem(item.page_id, item.neighborhood_id, s3Key, 'downloaded');
      stats.downloaded++;
      console.log(`    ✅ Saved (${(html.length / 1024).toFixed(1)} KB)`);
      
    } catch (err: any) {
      console.log(`    ❌ S3 error: ${err.message}`);
      await updateSerpItem(item.page_id, item.neighborhood_id, null, 'failed');
      stats.failed++;
    }
    
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, useScrapingDog ? 500 : 200));
  }
  
  // Summary
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('📊 DOWNLOAD SUMMARY');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Total: ${stats.total}`);
  console.log(`Downloaded: ${stats.downloaded}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Success rate: ${((stats.downloaded / stats.total) * 100).toFixed(1)}%`);
  
  if (useScrapingDog) {
    const cost = stats.downloaded * 0.001;
    console.log(`Estimated cost: $${cost.toFixed(2)}`);
  }
}

main().catch(console.error);

