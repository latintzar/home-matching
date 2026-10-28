/**
 * Sitemap Mapper (Phase 1A)
 * 
 * Parses sitemap XML files and extracts URLs.
 * Filters by lastmod date (6 months).
 * Saves URLs to DynamoDB for later download.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import * as cheerio from 'cheerio';
import { HARVEST_CONFIG, UrlRecord, CrawlStatusRecord, getDomainFromUrl, shouldSkipUrl } from './config';

const ddbClient = new DynamoDBClient({ region: HARVEST_CONFIG.aws.region });
const docClient = DynamoDBDocumentClient.from(ddbClient);

interface SitemapUrl {
  loc: string;
  lastmod?: string;
}

export interface SitemapMapperResult {
  domain: string;
  sitemapUrl: string;
  totalUrls: number;
  filteredUrls: number;
  savedUrls: number;
  status: 'success' | 'error';
  error?: string;
}

/**
 * Parse a sitemap and save URLs to DynamoDB
 */
export async function mapSitemap(
  domain: string,
  sitemapUrl: string,
  options: { dryRun?: boolean } = {}
): Promise<SitemapMapperResult> {
  const result: SitemapMapperResult = {
    domain,
    sitemapUrl,
    totalUrls: 0,
    filteredUrls: 0,
    savedUrls: 0,
    status: 'success',
  };

  try {
    console.log(`📍 Mapping sitemap: ${domain}`);
    
    // Fetch and parse sitemap
    const urls = await fetchSitemapUrls(sitemapUrl);
    result.totalUrls = urls.length;
    
    // Filter by date (last 6 months) AND blocklist
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - HARVEST_CONFIG.sitemap.maxAgeMonths);
    
    const filteredUrls = urls.filter(u => {
      // Skip if URL matches blocklist (blogs, news, wp-content, etc.)
      if (shouldSkipUrl(u.loc)) return false;
      
      // Filter by date if lastmod exists
      if (!u.lastmod) return true; // Keep URLs without lastmod
      const urlDate = new Date(u.lastmod);
      return urlDate >= cutoffDate;
    });
    result.filteredUrls = filteredUrls.length;
    
    const skippedByBlocklist = urls.length - filteredUrls.length;
    console.log(`  Total URLs: ${urls.length}, After filter: ${filteredUrls.length} (${skippedByBlocklist} blocked)`);
    
    if (!options.dryRun) {
      // Save to DynamoDB in batches
      const urlRecords: UrlRecord[] = filteredUrls.map(u => ({
        url: u.loc,
        domain,
        source: 'sitemap' as const,
        status: 'pending' as const,
        lastModified: u.lastmod,
        discoveredAt: new Date().toISOString(),
      }));
      
      await batchWriteUrls(urlRecords);
      result.savedUrls = urlRecords.length;
      
      // Update crawl status
      await updateCrawlStatus({
        domain,
        type: 'sitemap',
        status: 'complete',
        pagesCrawled: 1, // Just the sitemap
        listingsFound: filteredUrls.length,
        hitPageLimit: false,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });
    }
    
    console.log(`  ✅ Saved ${result.savedUrls} URLs`);
    
  } catch (error: any) {
    result.status = 'error';
    result.error = error.message;
    console.error(`  ❌ Error: ${error.message}`);
    
    // Update crawl status with error
    await updateCrawlStatus({
      domain,
      type: 'sitemap',
      status: 'failed',
      pagesCrawled: 0,
      listingsFound: 0,
      hitPageLimit: false,
      error: error.message,
    });
  }
  
  return result;
}

/**
 * Fetch URLs from a sitemap (handles sitemap indexes)
 */
async function fetchSitemapUrls(sitemapUrl: string, depth = 0): Promise<SitemapUrl[]> {
  if (depth > 2) return []; // Safety limit for recursion
  
  const response = await fetch(sitemapUrl, {
    headers: {
      'User-Agent': HARVEST_CONFIG.userAgent,
      'Accept': 'application/xml,text/xml,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(HARVEST_CONFIG.limits.requestTimeoutMs),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const xml = await response.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  
  const urls: SitemapUrl[] = [];
  
  // Check for sitemap index
  const sitemaps = $('sitemap');
  if (sitemaps.length > 0) {
    // It's an index - fetch child sitemaps
    const childUrls: string[] = [];
    sitemaps.each((_, el) => {
      const loc = $(el).find('loc').text().trim();
      if (loc) childUrls.push(loc);
    });
    
    // Fetch child sitemaps (limit to prevent explosion)
    const toFetch = childUrls.slice(0, 10);
    for (const childUrl of toFetch) {
      if (urls.length >= HARVEST_CONFIG.sitemap.maxUrlsPerSitemap) break;
      try {
        const childResult = await fetchSitemapUrls(childUrl, depth + 1);
        urls.push(...childResult);
      } catch (e) {
        // Skip failed child sitemaps
        console.warn(`  ⚠️ Failed to fetch child sitemap: ${childUrl}`);
      }
    }
    return urls;
  }
  
  // Parse urlset
  $('url').each((_, el) => {
    if (urls.length >= HARVEST_CONFIG.sitemap.maxUrlsPerSitemap) return false;
    
    const loc = $(el).find('loc').text().trim();
    const lastmod = $(el).find('lastmod').text().trim() || undefined;
    
    if (loc) {
      urls.push({ loc, lastmod });
    }
  });
  
  return urls;
}

/**
 * Batch write URLs to DynamoDB
 */
async function batchWriteUrls(urls: UrlRecord[]): Promise<void> {
  const BATCH_SIZE = 25; // DynamoDB limit
  
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    
    const writeRequests = batch.map(url => ({
      PutRequest: {
        Item: url,
      },
    }));
    
    try {
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [HARVEST_CONFIG.aws.dynamodb.urlsTable]: writeRequests,
        },
      }));
    } catch (error: any) {
      // If batch fails, try individual writes
      console.warn(`  Batch write failed, falling back to individual writes`);
      for (const url of batch) {
        try {
          await docClient.send(new PutCommand({
            TableName: HARVEST_CONFIG.aws.dynamodb.urlsTable,
            Item: url,
          }));
        } catch (e) {
          console.error(`  Failed to write URL: ${url.url}`);
        }
      }
    }
    
    // Small delay between batches
    if (i + BATCH_SIZE < urls.length) {
      await new Promise(r => setTimeout(r, 50));
    }
  }
}

/**
 * Update crawl status in DynamoDB
 */
async function updateCrawlStatus(status: CrawlStatusRecord): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: HARVEST_CONFIG.aws.dynamodb.crawlStatusTable,
    Item: status,
  }));
}

/**
 * Map multiple sitemaps (for batch processing)
 */
export async function mapSitemapsBatch(
  domains: Array<{ domain: string; sitemapUrl: string }>,
  options: { dryRun?: boolean; concurrency?: number } = {}
): Promise<SitemapMapperResult[]> {
  const concurrency = options.concurrency || 5;
  const results: SitemapMapperResult[] = [];
  
  for (let i = 0; i < domains.length; i += concurrency) {
    const batch = domains.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(d => mapSitemap(d.domain, d.sitemapUrl, options))
    );
    results.push(...batchResults);
    
    // Progress update
    console.log(`\n📊 Progress: ${results.length}/${domains.length} domains`);
  }
  
  return results;
}

