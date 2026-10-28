/**
 * spider-single Lambda
 * 
 * Crawls 1 domain breadth-first, discovers URLs, downloads HTMLs.
 * One Lambda = One domain (fully crawled).
 * 
 * Input: { domain: "example.com" }
 * Output: { domain, urlsFound, htmlsDownloaded, pagesVisited }
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, BatchWriteItemCommand, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { createHash } from 'crypto';

const REGION = 'us-east-1';
const S3_BUCKET = 'puedo-casa-html-archive';
const URLS_TABLE = 'leo-urls';
const RULES_TABLE = 'leo-scraping-rules';

const s3 = new S3Client({ region: REGION });
const dynamodb = new DynamoDBClient({ region: REGION });

// Limits
const MAX_PAGES = 2000;          // Max pages to visit per domain (increased for initial crawl)
const TIMEOUT_MS = 4.5 * 60 * 1000; // Stop at 4.5 min (Lambda limit is 5 min, leave 30s buffer)
const REQUEST_DELAY_MS = 200;    // Polite delay between requests

// Blocklist patterns - FIXED: removed pagination, category, xml/json blocks
const BLOCKLIST = [
  /\/(blog|news|noticias|actualidad|prensa)\//i,
  /\/(contacto|contact|about|nosotros|quienes-somos)\//i,
  /\/(legal|privacidad|cookies|aviso-legal)\//i,
  /\/(login|register|admin|wp-admin)\//i,
  /\.(pdf|jpg|jpeg|png|gif|css|js)$/i,  // Removed xml, json - we want sitemaps/APIs
  /[?&](utm_|fbclid|gclid)/i,
  /\/tag\//i,
  // REMOVED: /\/category\//i - might contain listing categories
  // REMOVED: /\/page\/\d+$/i - we WANT pagination!
  /\/(casino|poker|apuestas|bet|slot)/i,
  /#/,  // Fragment URLs
];

function shouldSkip(url: string): boolean {
  return BLOCKLIST.some(pattern => pattern.test(url));
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove trailing slash, www, lowercase
    let normalized = `${u.protocol}//${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '') || '/'}`;
    // Keep query params but sort them
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

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function getS3Key(url: string, domain: string): string {
  const hash = createHash('md5').update(url).digest('hex').slice(0, 12);
  const urlPath = new URL(url).pathname.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50);
  return `html/${domain}/${hash}_${urlPath}.html`;
}

// Extract links from HTML
function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;
  
  while ((match = hrefRegex.exec(html)) !== null) {
    try {
      const href = match[1];
      // Skip javascript:, mailto:, tel:, #
      if (href.startsWith('javascript:') || href.startsWith('mailto:') || 
          href.startsWith('tel:') || href.startsWith('#')) {
        continue;
      }
      // Resolve relative URLs
      const absoluteUrl = new URL(href, baseUrl).toString();
      links.push(absoluteUrl);
    } catch {
      // Invalid URL, skip
    }
  }
  
  return links;
}

// Get start URL for domain
async function getStartUrl(domain: string): Promise<string | null> {
  const result = await dynamodb.send(new GetItemCommand({
    TableName: RULES_TABLE,
    Key: { domain: { S: domain } },
    ProjectionExpression: '#u',
    ExpressionAttributeNames: { '#u': 'url' },
  }));
  return result.Item?.url?.S || `https://${domain}`;
}

// Save URLs to DynamoDB in batches
async function saveUrls(urls: Array<{ url: string; domain: string; s3Key: string }>): Promise<number> {
  let saved = 0;
  
  for (let i = 0; i < urls.length; i += 25) {
    const batch = urls.slice(i, i + 25);
    
    try {
      await dynamodb.send(new BatchWriteItemCommand({
        RequestItems: {
          [URLS_TABLE]: batch.map(item => ({
            PutRequest: {
              Item: {
                url: { S: item.url },
                domain: { S: item.domain },
                source: { S: 'spider' },
                status: { S: 'downloaded' },
                s3_key: { S: item.s3Key },  // FIXED: Save S3 key!
                discovered_at: { S: new Date().toISOString() },
              }
            }
          }))
        }
      }));
      saved += batch.length;
    } catch (err) {
      console.error('Batch save error:', err);
    }
  }
  
  return saved;
}

// Update domain status in leo-scraping-rules
async function updateDomainStatus(domain: string, status: string, stats: any): Promise<void> {
  try {
    await dynamodb.send(new UpdateItemCommand({
      TableName: RULES_TABLE,
      Key: { domain: { S: domain } },
      UpdateExpression: 'SET spider_status = :status, spider_stats = :stats, spider_completed_at = :time',
      ExpressionAttributeValues: {
        ':status': { S: status },
        ':stats': { S: JSON.stringify(stats) },
        ':time': { S: new Date().toISOString() },
      },
    }));
  } catch (err) {
    console.error('Update domain status error:', err);
  }
}

interface Event {
  domain: string;
}

export async function handler(event: Event) {
  const { domain } = event;
  const startTime = Date.now();
  
  console.log(`🕷️ Starting spider for: ${domain}`);
  
  // Get start URL
  const startUrl = await getStartUrl(domain) || `https://${domain}`;
  console.log(`   Start URL: ${startUrl}`);
  
  // In-memory state
  const queue: string[] = [startUrl];
  const visited = new Set<string>();
  const discovered: Array<{ url: string; domain: string; s3Key: string }> = [];
  const errorDetails: Array<{ url: string; reason: string }> = [];
  let htmlsDownloaded = 0;
  let errors = 0;
  
  // Crawl loop
  while (queue.length > 0 && visited.size < MAX_PAGES) {
    // Check timeout
    if (Date.now() - startTime > TIMEOUT_MS) {
      console.log(`   ⏱️ Timeout reached after ${visited.size} pages`);
      break;
    }
    
    const url = queue.shift()!;
    const normalizedUrl = normalizeUrl(url);
    
    // Skip if already visited or in blocklist
    if (visited.has(normalizedUrl) || shouldSkip(url)) {
      continue;
    }
    
    // Skip if different domain
    const urlDomain = getDomain(url);
    if (urlDomain !== domain && urlDomain !== `www.${domain}`) {
      continue;
    }
    
    visited.add(normalizedUrl);
    
    try {
      // Fetch page
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PuedoCasa/1.0; +https://puedocasa.com)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
        redirect: 'follow',
      });
      
      if (!response.ok) {
        errorDetails.push({ url: url.slice(0, 100), reason: `HTTP ${response.status}` });
        errors++;
        continue;
      }
      
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        continue;  // Skip non-HTML (not an error)
      }
      
      const html = await response.text();
      
      // Skip tiny pages (likely errors)
      if (html.length < 1000) {
        errorDetails.push({ url: url.slice(0, 100), reason: 'Page too small (<1KB)' });
        errors++;
        continue;
      }
      
      // Save to S3
      const s3Key = getS3Key(url, domain);
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: html,
        ContentType: 'text/html; charset=utf-8',
        Metadata: {
          'source-url': url.slice(0, 512),
          'domain': domain,
        },
      }));
      
      htmlsDownloaded++;
      discovered.push({ url: normalizedUrl, domain, s3Key });
      
      // Extract and queue new links
      const links = extractLinks(html, url);
      let newLinks = 0;
      
      for (const link of links) {
        const normalizedLink = normalizeUrl(link);
        const linkDomain = getDomain(link);
        
        if ((linkDomain === domain || linkDomain === `www.${domain}`) &&
            !visited.has(normalizedLink) &&
            !shouldSkip(link)) {
          queue.push(link);
          newLinks++;
        }
      }
      
      // Log progress every 50 pages
      if (visited.size % 50 === 0) {
        console.log(`   📄 ${visited.size} pages, ${htmlsDownloaded} downloaded, ${queue.length} queued`);
      }
      
      // Polite delay
      await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
      
    } catch (err: any) {
      const reason = err.name === 'TimeoutError' ? 'Timeout (15s)' : 
                     err.name === 'AbortError' ? 'Aborted' :
                     err.code === 'ENOTFOUND' ? 'DNS not found' :
                     err.code === 'ECONNREFUSED' ? 'Connection refused' :
                     err.code === 'ECONNRESET' ? 'Connection reset' :
                     err.message?.slice(0, 50) || 'Unknown error';
      errorDetails.push({ url: url.slice(0, 100), reason });
      errors++;
    }
  }
  
  // Save all discovered URLs to DynamoDB
  const savedUrls = await saveUrls(discovered);
  
  // Update domain status
  const stats = {
    pagesVisited: visited.size,
    htmlsDownloaded,
    urlsSaved: savedUrls,
    errors,
    queueRemaining: queue.length,
    timeMs: Date.now() - startTime,
  };
  
  await updateDomainStatus(domain, 'complete', stats);
  
  console.log(`\n✅ Spider complete for ${domain}:`);
  console.log(`   Pages visited: ${visited.size}`);
  console.log(`   HTMLs downloaded: ${htmlsDownloaded}`);
  console.log(`   URLs saved: ${savedUrls}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  
  // Log error breakdown
  if (errorDetails.length > 0) {
    const errorCounts: Record<string, number> = {};
    for (const e of errorDetails) {
      errorCounts[e.reason] = (errorCounts[e.reason] || 0) + 1;
    }
    console.log(`\n📊 Error breakdown:`);
    for (const [reason, count] of Object.entries(errorCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${reason}: ${count}`);
    }
    
    // Log first 5 errors as examples
    console.log(`\n🔍 Sample errors (first 5):`);
    for (const e of errorDetails.slice(0, 5)) {
      console.log(`   ${e.reason}: ${e.url}`);
    }
  }
  
  return {
    success: true,
    domain,
    ...stats,
    errorBreakdown: errorDetails.reduce((acc, e) => {
      acc[e.reason] = (acc[e.reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
}

