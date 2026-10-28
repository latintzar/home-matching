/**
 * Daily Harvest Delta Lambda
 * 
 * Runs daily to check for new listings on agency sitemaps.
 * Only fetches HTMLs that don't already exist in S3.
 * 
 * Schedule: Daily at 3 AM UTC (cron(0 3 * * ? *))
 * Timeout: 15 minutes
 * Memory: 512 MB
 */

import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import * as zlib from 'zlib';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }));

const S3_BUCKET = process.env.S3_BUCKET || '';
const CRAWL_TRACKING_TABLE = 'leo-crawl-tracking';
const MAX_NEW_PER_DOMAIN = 100;  // Limit new URLs per domain per run
const CONCURRENCY = 10;

interface CrawlRecord {
  domain: string;
  sitemap_url: string;
  last_crawled: string;
  total_urls: number;
  new_urls_found: number;
}

/**
 * Check if URL already exists in S3
 */
async function existsInS3(key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch sitemap and extract URLs
 */
async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  try {
    const response = await fetch(sitemapUrl, {
      headers: { 'User-Agent': 'PuedoCasa/1.0 (+https://leo.casa)' },
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) return [];
    
    const content = await response.text();
    const urls: string[] = [];
    
    // Extract URLs from sitemap XML
    const locMatches = content.matchAll(/<loc>([^<]+)<\/loc>/gi);
    for (const match of locMatches) {
      const url = match[1].trim();
      if (!url.endsWith('.xml') && !url.endsWith('.xml.gz')) {
        urls.push(url);
      }
    }
    
    return urls;
  } catch {
    return [];
  }
}

/**
 * Fetch and store HTML
 */
async function fetchAndStoreHtml(url: string, domain: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PuedoCasa/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!response.ok) return false;
    
    const html = await response.text();
    if (html.length < 1000) return false;  // Too small, probably error page
    
    // Generate S3 key
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\//, '').replace(/\//g, '_') || 'index';
    const key = `html/${domain}/${path}.html.gz`;
    
    // Compress and upload
    const compressed = zlib.gzipSync(Buffer.from(html, 'utf-8'));
    
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: compressed,
      ContentType: 'text/html',
      ContentEncoding: 'gzip',
      Metadata: {
        'source-url': url,
        'crawled-at': new Date().toISOString(),
      },
    }));
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Get S3 key for URL
 */
function urlToS3Key(url: string): string {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname.replace(/^\//, '').replace(/\//g, '_') || 'index';
    return `html/${domain}/${path}.html.gz`;
  } catch {
    return '';
  }
}

/**
 * Process a single domain
 */
async function processDomain(record: CrawlRecord): Promise<{ newUrls: number; errors: number }> {
  const domain = record.domain;
  let newUrls = 0;
  let errors = 0;
  
  console.log(`Processing ${domain}...`);
  
  // Fetch sitemap URLs
  const urls = await fetchSitemapUrls(record.sitemap_url);
  if (urls.length === 0) {
    console.log(`  No URLs found in sitemap`);
    return { newUrls: 0, errors: 0 };
  }
  
  // Check which URLs are new
  const newUrlsToFetch: string[] = [];
  for (const url of urls) {
    if (newUrlsToFetch.length >= MAX_NEW_PER_DOMAIN) break;
    
    const key = urlToS3Key(url);
    if (key && !(await existsInS3(key))) {
      newUrlsToFetch.push(url);
    }
  }
  
  console.log(`  Found ${newUrlsToFetch.length} new URLs (of ${urls.length} total)`);
  
  // Fetch new URLs
  for (let i = 0; i < newUrlsToFetch.length; i += CONCURRENCY) {
    const batch = newUrlsToFetch.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(url => fetchAndStoreHtml(url, domain))
    );
    
    newUrls += results.filter(Boolean).length;
    errors += results.filter(r => !r).length;
  }
  
  // Update crawl tracking
  await dynamoClient.send(new UpdateCommand({
    TableName: CRAWL_TRACKING_TABLE,
    Key: { domain },
    UpdateExpression: 'SET last_crawled = :now, total_urls = :total, new_urls_found = :new',
    ExpressionAttributeValues: {
      ':now': new Date().toISOString(),
      ':total': urls.length,
      ':new': newUrls,
    },
  }));
  
  console.log(`  Fetched ${newUrls} new HTMLs, ${errors} errors`);
  return { newUrls, errors };
}

/**
 * Main Lambda handler
 */
export async function handler(event: any): Promise<any> {
  console.log('🔄 Daily Harvest Delta - Starting');
  const startTime = Date.now();
  
  // Get all domains to crawl
  const { Items: domains } = await dynamoClient.send(new ScanCommand({
    TableName: CRAWL_TRACKING_TABLE,
  }));
  
  if (!domains || domains.length === 0) {
    console.log('No domains to crawl');
    return { statusCode: 200, body: 'No domains' };
  }
  
  console.log(`Processing ${domains.length} domains`);
  
  let totalNew = 0;
  let totalErrors = 0;
  
  // Process domains sequentially to avoid overwhelming
  for (const domain of domains as CrawlRecord[]) {
    try {
      const result = await processDomain(domain);
      totalNew += result.newUrls;
      totalErrors += result.errors;
    } catch (error) {
      console.error(`Error processing ${domain.domain}:`, error);
      totalErrors++;
    }
    
    // Check if we're running out of time (Lambda timeout)
    if (Date.now() - startTime > 14 * 60 * 1000) {
      console.log('Approaching timeout, stopping');
      break;
    }
  }
  
  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`\n✅ Completed in ${elapsed.toFixed(1)}s`);
  console.log(`   New HTMLs: ${totalNew}`);
  console.log(`   Errors: ${totalErrors}`);
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      newHtmls: totalNew,
      errors: totalErrors,
      duration: elapsed,
    }),
  };
}

