/**
 * Spider Crawler (Phase 1B)
 * 
 * Crawls non-sitemap domains by following links.
 * Downloads pages, extracts links, saves to S3.
 * Single pass: crawl = download (no separate phases).
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as cheerio from 'cheerio';
import * as zlib from 'zlib';
import { 
  HARVEST_CONFIG, 
  UrlRecord, 
  CrawlStatusRecord, 
  shouldSkipUrl, 
  getDomainFromUrl 
} from './config';

const ddbClient = new DynamoDBClient({ region: HARVEST_CONFIG.aws.region });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({ region: HARVEST_CONFIG.aws.region });

export interface SpiderResult {
  domain: string;
  pagesVisited: number;
  pagesSaved: number;
  urlsDiscovered: number;
  hitPageLimit: boolean;
  status: 'complete' | 'truncated' | 'error';
  error?: string;
  durationMs: number;
}

interface CrawlState {
  domain: string;
  visited: Set<string>;
  queue: string[];
  savedUrls: Set<string>;
  pagesWithNoNewUrls: number;
}

/**
 * Spider crawl a single domain
 */
export async function spiderDomain(
  domain: string,
  options: { dryRun?: boolean; maxPages?: number } = {}
): Promise<SpiderResult> {
  const startTime = Date.now();
  const maxPages = options.maxPages || HARVEST_CONFIG.limits.maxPagesPerDomain;
  
  const result: SpiderResult = {
    domain,
    pagesVisited: 0,
    pagesSaved: 0,
    urlsDiscovered: 0,
    hitPageLimit: false,
    status: 'complete',
    durationMs: 0,
  };
  
  const state: CrawlState = {
    domain,
    visited: new Set(),
    queue: [`https://${domain}`, `https://www.${domain}`],
    savedUrls: new Set(),
    pagesWithNoNewUrls: 0,
  };
  
  console.log(`🕷️ Starting spider: ${domain}`);
  
  try {
    // Update status to in_progress
    await updateCrawlStatus({
      domain,
      type: 'spider',
      status: 'in_progress',
      pagesCrawled: 0,
      listingsFound: 0,
      hitPageLimit: false,
      startedAt: new Date().toISOString(),
    });
    
    // Crawl loop
    while (state.queue.length > 0 && state.visited.size < maxPages) {
      // Check stop conditions
      if (state.pagesWithNoNewUrls >= HARVEST_CONFIG.limits.pagesWithNoNewUrlsLimit) {
        console.log(`  ⏹️ Stopping: ${HARVEST_CONFIG.limits.pagesWithNoNewUrlsLimit} pages with no new URLs`);
        break;
      }
      
      // Process batch
      const batchSize = Math.min(
        HARVEST_CONFIG.limits.concurrentRequests,
        state.queue.length,
        maxPages - state.visited.size
      );
      const batch = state.queue.splice(0, batchSize);
      
      const batchResults = await Promise.all(
        batch.map(url => processUrl(url, state, options.dryRun))
      );
      
      // Update counters
      const newUrlsFound = batchResults.reduce((sum, r) => sum + r.newUrls, 0);
      const pagesSaved = batchResults.reduce((sum, r) => sum + (r.saved ? 1 : 0), 0);
      
      result.pagesVisited += batchResults.length;
      result.pagesSaved += pagesSaved;
      
      if (newUrlsFound === 0) {
        state.pagesWithNoNewUrls++;
      } else {
        state.pagesWithNoNewUrls = 0;
      }
      
      // Progress log every 50 pages
      if (result.pagesVisited % 50 === 0) {
        console.log(`  📊 ${domain}: ${result.pagesVisited} visited, ${result.pagesSaved} saved, ${state.queue.length} queued`);
      }
      
      // Rate limiting
      await new Promise(r => setTimeout(r, HARVEST_CONFIG.limits.delayBetweenBatchesMs));
    }
    
    // Determine final status
    if (state.visited.size >= maxPages) {
      result.hitPageLimit = true;
      result.status = 'truncated';
      console.log(`  ⚠️ Hit page limit (${maxPages})`);
    }
    
    result.urlsDiscovered = state.savedUrls.size;
    result.durationMs = Date.now() - startTime;
    
    console.log(`  ✅ Complete: ${result.pagesVisited} pages, ${result.pagesSaved} saved`);
    
    // Update final status (map 'error' to 'failed' for CrawlStatus)
    await updateCrawlStatus({
      domain,
      type: 'spider',
      status: result.status === 'error' ? 'failed' : result.status,
      pagesCrawled: result.pagesVisited,
      listingsFound: result.pagesSaved,
      hitPageLimit: result.hitPageLimit,
      completedAt: new Date().toISOString(),
    });
    
  } catch (error: any) {
    result.status = 'error';
    result.error = error.message;
    result.durationMs = Date.now() - startTime;
    
    console.error(`  ❌ Error: ${error.message}`);
    
    await updateCrawlStatus({
      domain,
      type: 'spider',
      status: 'failed',
      pagesCrawled: result.pagesVisited,
      listingsFound: result.pagesSaved,
      hitPageLimit: false,
      error: error.message,
    });
  }
  
  return result;
}

/**
 * Process a single URL: fetch, save if needed, extract links
 */
async function processUrl(
  url: string,
  state: CrawlState,
  dryRun?: boolean
): Promise<{ saved: boolean; newUrls: number }> {
  // Skip if already visited
  if (state.visited.has(url)) {
    return { saved: false, newUrls: 0 };
  }
  state.visited.add(url);
  
  // Skip if URL matches blocklist
  if (shouldSkipUrl(url)) {
    return { saved: false, newUrls: 0 };
  }
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': HARVEST_CONFIG.userAgent,
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(HARVEST_CONFIG.limits.requestTimeoutMs),
      redirect: 'follow',
    });
    
    if (!response.ok) {
      return { saved: false, newUrls: 0 };
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return { saved: false, newUrls: 0 };
    }
    
    const html = await response.text();
    
    // Extract links
    const links = extractLinks(html, url, state.domain);
    let newUrls = 0;
    for (const link of links) {
      if (!state.visited.has(link) && !state.queue.includes(link)) {
        state.queue.push(link);
        newUrls++;
      }
    }
    
    // Save to S3 (we save everything that's not blocklisted)
    if (!dryRun) {
      const s3Key = urlToS3Key(url);
      await saveToS3(s3Key, html);
      
      // Record URL in DynamoDB
      await recordUrl({
        url,
        domain: state.domain,
        source: 'spider',
        status: 'downloaded',
        discoveredAt: new Date().toISOString(),
        downloadedAt: new Date().toISOString(),
        s3Key,
      });
      
      state.savedUrls.add(url);
    }
    
    return { saved: true, newUrls };
    
  } catch (error: any) {
    // Log but don't fail the whole crawl
    return { saved: false, newUrls: 0 };
  }
}

/**
 * Extract links from HTML
 */
function extractLinks(html: string, baseUrl: string, targetDomain: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];
  
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    
    try {
      const absoluteUrl = new URL(href, baseUrl).toString();
      const urlDomain = getDomainFromUrl(absoluteUrl);
      
      // Only follow links on same domain
      if (urlDomain === targetDomain || urlDomain === `www.${targetDomain}`) {
        // Skip anchors, mailto, tel, javascript
        if (!absoluteUrl.includes('#') && 
            !absoluteUrl.startsWith('mailto:') && 
            !absoluteUrl.startsWith('tel:') &&
            !absoluteUrl.startsWith('javascript:')) {
          links.push(absoluteUrl.split('#')[0]); // Remove fragments
        }
      }
    } catch {
      // Invalid URL, skip
    }
  });
  
  return [...new Set(links)]; // Dedupe
}

/**
 * Convert URL to S3 key
 */
function urlToS3Key(url: string): string {
  const urlObj = new URL(url);
  const domain = urlObj.hostname.replace(/^www\./, '');
  const path = urlObj.pathname.replace(/\//g, '_').replace(/^_/, '');
  const timestamp = Date.now();
  return `html/${domain}/${path || 'index'}_${timestamp}.html.gz`;
}

/**
 * Save HTML to S3 (gzip compressed)
 */
async function saveToS3(key: string, html: string): Promise<void> {
  const compressed = zlib.gzipSync(Buffer.from(html, 'utf-8'));
  
  await s3Client.send(new PutObjectCommand({
    Bucket: HARVEST_CONFIG.aws.s3Bucket,
    Key: key,
    Body: compressed,
    ContentType: 'text/html',
    ContentEncoding: 'gzip',
    Metadata: {
      'original-size': html.length.toString(),
      'compressed-size': compressed.length.toString(),
      'crawled-at': new Date().toISOString(),
    },
  }));
}

/**
 * Record URL in DynamoDB
 */
async function recordUrl(record: UrlRecord): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: HARVEST_CONFIG.aws.dynamodb.urlsTable,
    Item: record,
  }));
}

/**
 * Update crawl status
 */
async function updateCrawlStatus(status: Partial<CrawlStatusRecord> & { domain: string }): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: HARVEST_CONFIG.aws.dynamodb.crawlStatusTable,
    Item: status,
  }));
}

/**
 * Spider multiple domains (batch processing)
 */
export async function spiderDomainsBatch(
  domains: string[],
  options: { dryRun?: boolean; concurrency?: number; maxPagesPerDomain?: number } = {}
): Promise<SpiderResult[]> {
  const concurrency = options.concurrency || 3; // Lower for spider (more intensive)
  const results: SpiderResult[] = [];
  
  for (let i = 0; i < domains.length; i += concurrency) {
    const batch = domains.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(d => spiderDomain(d, { 
        dryRun: options.dryRun, 
        maxPages: options.maxPagesPerDomain 
      }))
    );
    results.push(...batchResults);
    
    // Progress update
    const complete = results.filter(r => r.status === 'complete').length;
    const truncated = results.filter(r => r.status === 'truncated').length;
    const errors = results.filter(r => r.status === 'error').length;
    console.log(`\n📊 Progress: ${results.length}/${domains.length} domains (✅${complete} ⚠️${truncated} ❌${errors})`);
  }
  
  return results;
}

