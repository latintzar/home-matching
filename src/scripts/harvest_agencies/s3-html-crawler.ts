/**
 * S3 HTML Crawler
 * 
 * Fetches HTML from listing URLs and uploads to S3
 * Filters out non-listing pages (blogs, contact, etc.)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { parse } from 'csv-parse/sync';
import { S3Client, PutObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

// Recipient configuration is supplied by tools/runtime-env.py.
// S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || '';
const CONCURRENCY = 10; // Parallel fetches (reduced from 20 to avoid S3 throttling)
const RATE_LIMIT_DELAY = 200; // ms between batches (increased from 100)
const UPLOAD_DELAY = 50; // ms delay between S3 uploads to avoid throttling

// Patterns to EXCLUDE (not listings)
const EXCLUDE_PATTERNS = [
  /\/blog\//i, /\/noticias\//i, /\/news\//i,
  /\/contacto/i, /\/contact/i,
  /\/about/i, /\/sobre-nosotros/i, /\/quienes-somos/i,
  /\/servicios/i, /\/services/i,
  /\/legal/i, /\/privacy/i, /\/terms/i, /\/cookies/i,
  /\/aviso-legal/i, /\/politica/i,
  /\/faq/i, /\/team/i, /\/equipo/i,
  /\/agents?\.xml/i, /\/searches?\.xml/i,
  /sitemap/i, /robots\.txt/i,
  /\.pdf$/i, /\.jpg$/i, /\.png$/i, /\.gif$/i,
];

// Patterns that indicate LISTING pages
const LISTING_PATTERNS = [
  /\/inmueble\//i, /\/propiedad\//i, /\/property\//i,
  /\/anuncio\//i, /\/ficha\//i, /\/detalle\//i,
  /\/venta\//i, /\/alquiler\//i, /\/rent\//i, /\/sale\//i,
  /[-_]venta[-_]/i, /[-_]alquiler[-_]/i,
  /\/ref[-_]?\d+/i, /\/id[-_]?\d+/i,
  /\/\d{5,10}(?:\/|\.html?|$)/i,
  /piso|apartamento|casa|chalet|local|garaje|terreno|nave/i,
  /apartment|house|flat|villa|studio/i,
];

interface CrawlStats {
  totalUrls: number;
  fetched: number;
  uploaded: number;
  skipped: number;
  errors: number;
  totalBytes: number;
}

function isListingUrl(url: string): boolean {
  // First check exclusions
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(url)) return false;
  }
  
  // Then check if it looks like a listing
  for (const pattern of LISTING_PATTERNS) {
    if (pattern.test(url)) return true;
  }
  
  // If no clear indication, include it (better to have extra than miss listings)
  return true;
}

function getS3Key(url: string): string {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname.replace(/^\//, '').replace(/\//g, '_') || 'index';
    return `html/${domain}/${path}.html.gz`;
  } catch {
    return `html/unknown/${Date.now()}.html.gz`;
  }
}

// Resume capability: List already-crawled domains
async function getAlreadyCrawledDomains(): Promise<Set<string>> {
  const crawledDomains = new Set<string>();
  let continuationToken: string | undefined;
  
  console.log('📋 Checking already-crawled domains in S3...');
  
  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: 'html/',
      Delimiter: '/',
      ContinuationToken: continuationToken,
    }));
    
    for (const prefix of response.CommonPrefixes || []) {
      if (prefix.Prefix) {
        // Extract domain from prefix like "html/domain.com/"
        const domain = prefix.Prefix.replace('html/', '').replace('/', '');
        crawledDomains.add(domain);
      }
    }
    
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  console.log(`   Found ${crawledDomains.size} domains already crawled\n`);
  return crawledDomains;
}

// Check if specific URL already exists in S3
async function existsInS3(key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

async function fetchHtml(url: string): Promise<{ html: string; status: number } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es,en;q=0.9',
      },
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      return { html: '', status: response.status };
    }
    
    const html = await response.text();
    return { html, status: response.status };
  } catch (e) {
    return null;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadToS3WithRetry(key: string, html: string, maxRetries: number = 5): Promise<boolean> {
  const compressed = zlib.gzipSync(Buffer.from(html, 'utf-8'));
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
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
      
      return true;
    } catch (e: any) {
      const isThrottled = e.name === 'SlowDown' || e.Code === 'SlowDown' || 
                          (e.message && e.message.includes('SlowDown'));
      
      if (isThrottled && attempt < maxRetries - 1) {
        // Exponential backoff with jitter: 1s, 2s, 4s, 8s, 16s (+ random 0-1s)
        const baseDelay = Math.pow(2, attempt) * 1000;
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;
        
        console.log(`  ⏳ S3 throttled, retrying in ${(delay/1000).toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(delay);
      } else {
        console.error(`S3 upload error for ${key}:`, e.message || e);
        return false;
      }
    }
  }
  
  return false;
}

// Alias for backwards compatibility
async function uploadToS3(key: string, html: string): Promise<boolean> {
  return uploadToS3WithRetry(key, html);
}

async function fetchSitemapUrls(sitemapUrl: string, visited: Set<string> = new Set()): Promise<string[]> {
  if (visited.has(sitemapUrl)) return [];
  visited.add(sitemapUrl);
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(sitemapUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PuedoCasa/1.0)' },
    });
    
    clearTimeout(timeout);
    if (!response.ok) return [];
    
    let content = await response.text();
    
    // Handle gzipped sitemaps
    if (sitemapUrl.endsWith('.gz')) {
      try {
        const buffer = Buffer.from(content, 'binary');
        content = zlib.gunzipSync(buffer).toString('utf-8');
      } catch {}
    }
    
    const urls: string[] = [];
    const isSitemapIndex = content.includes('<sitemapindex');
    
    if (isSitemapIndex) {
      const sitemapMatches = content.matchAll(/<loc>([^<]+\.xml[^<]*)<\/loc>/gi);
      for (const match of sitemapMatches) {
        const childUrls = await fetchSitemapUrls(match[1].trim(), visited);
        urls.push(...childUrls);
      }
    } else {
      const locMatches = content.matchAll(/<loc>([^<]+)<\/loc>/gi);
      for (const match of locMatches) {
        const url = match[1].trim();
        if (!url.endsWith('.xml') && !url.endsWith('.xml.gz')) {
          urls.push(url);
        }
      }
    }
    
    return urls;
  } catch {
    return [];
  }
}

async function crawlDomain(
  domain: string, 
  sitemapUrl: string, 
  stats: CrawlStats,
  maxUrls: number = Infinity
): Promise<void> {
  console.log(`\n📡 Crawling ${domain}...`);
  
  // Get all URLs from sitemap
  const allUrls = await fetchSitemapUrls(sitemapUrl);
  
  // Filter to listing URLs only
  const listingUrls = allUrls.filter(isListingUrl).slice(0, maxUrls);
  const skippedCount = allUrls.length - listingUrls.length;
  
  console.log(`   Found ${allUrls.length} URLs, ${listingUrls.length} listings, ${skippedCount} skipped`);
  stats.totalUrls += listingUrls.length;
  stats.skipped += skippedCount;
  
  // Process in batches
  for (let i = 0; i < listingUrls.length; i += CONCURRENCY) {
    const batch = listingUrls.slice(i, i + CONCURRENCY);
    
    const results = await Promise.all(batch.map(async (url) => {
      const result = await fetchHtml(url);
      if (!result || !result.html) {
        stats.errors++;
        return null;
      }
      
      stats.fetched++;
      
      const s3Key = getS3Key(url);
      const uploaded = await uploadToS3(s3Key, result.html);
      
      if (uploaded) {
        stats.uploaded++;
        stats.totalBytes += result.html.length;
      } else {
        stats.errors++;
      }
      
      return { url, s3Key, size: result.html.length };
    }));
    
    // Progress
    const progress = Math.min(i + CONCURRENCY, listingUrls.length);
    process.stdout.write(`\r   Progress: ${progress}/${listingUrls.length} (${stats.uploaded} uploaded)`);
    
    // Rate limit
    await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));
  }
  
  console.log(); // New line after progress
}

async function main() {
  const args = process.argv.slice(2);
  const testMode = args.includes('--test');
  const resumeMode = args.includes('--resume') || !args.includes('--fresh');
  const maxPerDomain = testMode ? 10 : Infinity;
  const maxDomains = testMode ? 5 : Infinity;
  
  // Domain range filtering for parallel crawling
  // Usage: --range A-L or --range M-Z
  const rangeArg = args.find(a => a.startsWith('--range='));
  let domainRange: { start: string; end: string } | null = null;
  if (rangeArg) {
    const range = rangeArg.split('=')[1].toUpperCase();
    const [start, end] = range.split('-');
    domainRange = { start, end };
  }
  
  console.log('🚀 S3 HTML CRAWLER');
  console.log('='.repeat(60));
  console.log(`Mode: ${testMode ? 'TEST (5 domains, 10 URLs each)' : 'FULL CRAWL'}`);
  console.log(`Resume: ${resumeMode ? 'YES (skipping already-crawled domains)' : 'NO (fresh start)'}`);
  if (domainRange) {
    console.log(`Domain Range: ${domainRange.start}-${domainRange.end} (parallel mode)`);
  }
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log('');
  
  // Verify S3 connection
  console.log('Testing S3 connection...');
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: 'test-connection.txt',
      Body: 'Connection test',
    }));
    console.log('✅ S3 connection successful\n');
  } catch (e) {
    console.error('❌ S3 connection failed:', e);
    process.exit(1);
  }
  
  // Get already-crawled domains for resume
  const alreadyCrawled = resumeMode ? await getAlreadyCrawledDomains() : new Set<string>();
  
  // Load sitemap data
  const sitemapPath = path.join(process.cwd(), 'data', 'agencies_sitemaps.csv');
  const sitemapData = fs.readFileSync(sitemapPath, 'utf-8');
  const sitemapRecords = parse(sitemapData, { columns: true, skip_empty_lines: true });
  
  let allDomainsWithSitemaps = sitemapRecords
    .filter((r: any) => r.sitemap_found === 'YES' && r.sitemap_url);
  
  // Apply domain range filter for parallel crawling
  if (domainRange) {
    allDomainsWithSitemaps = allDomainsWithSitemaps.filter((r: any) => {
      const firstChar = r.domain.charAt(0).toUpperCase();
      return firstChar >= domainRange!.start && firstChar <= domainRange!.end;
    });
    console.log(`   Filtered to domains ${domainRange.start}-${domainRange.end}: ${allDomainsWithSitemaps.length} domains`);
  }
  
  // Filter out already-crawled domains if resuming
  const domainsWithSitemaps = allDomainsWithSitemaps
    .filter((r: any) => !alreadyCrawled.has(r.domain))
    .slice(0, maxDomains);
  
  const skippedDomains = allDomainsWithSitemaps.length - domainsWithSitemaps.length;
  
  console.log(`📋 Total domains with sitemaps: ${allDomainsWithSitemaps.length}`);
  if (resumeMode) {
    console.log(`   Already crawled (skipping): ${skippedDomains}`);
  }
  console.log(`   Remaining to crawl: ${domainsWithSitemaps.length}\n`);
  
  const stats: CrawlStats = {
    totalUrls: 0,
    fetched: 0,
    uploaded: 0,
    skipped: 0,
    errors: 0,
    totalBytes: 0,
  };
  
  const startTime = Date.now();
  
  for (const record of domainsWithSitemaps) {
    await crawlDomain(record.domain, record.sitemap_url, stats, maxPerDomain);
  }
  
  // Summary
  const elapsed = (Date.now() - startTime) / 1000;
  const avgSize = stats.uploaded > 0 ? Math.round(stats.totalBytes / stats.uploaded / 1024) : 0;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 CRAWL SUMMARY\n');
  console.log(`Domains processed: ${domainsWithSitemaps.length}`);
  console.log(`Total listing URLs: ${stats.totalUrls.toLocaleString()}`);
  console.log(`Non-listing URLs skipped: ${stats.skipped.toLocaleString()}`);
  console.log(`HTML pages fetched: ${stats.fetched.toLocaleString()}`);
  console.log(`Uploaded to S3: ${stats.uploaded.toLocaleString()}`);
  console.log(`Errors: ${stats.errors.toLocaleString()}`);
  console.log(`Total data: ${(stats.totalBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Average page size: ${avgSize} KB`);
  console.log(`Time: ${elapsed.toFixed(1)} seconds`);
  console.log(`Speed: ${(stats.uploaded / elapsed).toFixed(1)} pages/sec`);
  
  // Estimate for full crawl
  if (testMode) {
    const estimatedTotal = 400000;
    const estimatedTime = estimatedTotal / (stats.uploaded / elapsed);
    const estimatedSize = estimatedTotal * avgSize / 1024;
    
    console.log('\n📈 FULL CRAWL ESTIMATE:');
    console.log(`Estimated pages: ${estimatedTotal.toLocaleString()}`);
    console.log(`Estimated size: ${estimatedSize.toFixed(1)} GB`);
    console.log(`Estimated time: ${(estimatedTime / 3600).toFixed(1)} hours`);
  }
}

main().catch(console.error);

