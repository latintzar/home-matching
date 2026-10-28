/**
 * sitemap-single Lambda
 * 
 * Simple: Takes 1 domain, fetches its sitemap, saves URLs to leo-urls.
 * One Lambda = One domain.
 */

import { DynamoDBClient, BatchWriteItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';

const REGION = 'us-east-1';
const URLS_TABLE = 'leo-urls';
const RULES_TABLE = 'leo-scraping-rules';

const dynamodb = new DynamoDBClient({ region: REGION });

// Blocklist patterns - skip URLs matching these
const BLOCKLIST = [
  /\/(blog|news|noticias|actualidad|prensa)\//i,
  /\/(contacto|contact|about|nosotros|quienes-somos)\//i,
  /\/(legal|privacidad|cookies|aviso-legal)\//i,
  /\/(login|register|admin|wp-admin)\//i,
  /\.(pdf|jpg|jpeg|png|gif|css|js)$/i,
  /[?&](utm_|fbclid|gclid)/i,
  /\/tag\//i,
  /\/category\//i,
  /\/page\/\d+/i,
  /\/(casino|poker|apuestas|bet|slot|ruleta|blackjack)/i,
  /\/(prestamo|credito|hipoteca-100)/i,
];

function shouldSkip(url: string): boolean {
  return BLOCKLIST.some(pattern => pattern.test(url));
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Fetch sitemap and extract URLs
async function fetchSitemapUrls(sitemapUrl: string, domain: string): Promise<string[]> {
  const urls: string[] = [];
  
  try {
    const response = await fetch(sitemapUrl, {
      headers: { 'User-Agent': 'PuedoCasa/1.0 (+https://puedocasa.com)' },
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      console.log(`  ❌ Failed to fetch sitemap: ${response.status}`);
      return urls;
    }
    
    let xml: string;
    
    // Handle gzipped sitemaps
    if (sitemapUrl.endsWith('.gz') || response.headers.get('content-type')?.includes('gzip')) {
      const buffer = await response.arrayBuffer();
      const { gunzipSync } = await import('zlib');
      xml = gunzipSync(Buffer.from(buffer)).toString('utf-8');
    } else {
      xml = await response.text();
    }
    
    // Check if sitemap index
    if (xml.includes('<sitemapindex')) {
      const childMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
      const childUrls: string[] = [];
      for (const m of childMatches) {
        if (m[1].includes('.xml') || m[1].includes('sitemap')) {
          childUrls.push(m[1].trim());
        }
      }
      
      console.log(`  📑 Sitemap index with ${childUrls.length} children`);
      
      // Fetch children (limit to 5 to avoid timeout)
      for (const childUrl of childUrls.slice(0, 5)) {
        try {
          const childResp = await fetch(childUrl, {
            headers: { 'User-Agent': 'PuedoCasa/1.0' },
            signal: AbortSignal.timeout(15000),
          });
          
          if (childResp.ok) {
            let childXml: string;
            if (childUrl.endsWith('.gz')) {
              const buf = await childResp.arrayBuffer();
              const { gunzipSync } = await import('zlib');
              childXml = gunzipSync(Buffer.from(buf)).toString('utf-8');
            } else {
              childXml = await childResp.text();
            }
            
            for (const m of childXml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
              urls.push(m[1].trim());
            }
          }
        } catch (e) {
          console.log(`  ⚠️ Child sitemap error: ${childUrl}`);
        }
      }
    } else {
      // Regular sitemap
      for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        urls.push(m[1].trim());
      }
    }
    
  } catch (err) {
    console.log(`  ❌ Sitemap fetch error: ${err}`);
  }
  
  // Filter: same domain + not in blocklist
  const filtered = urls.filter(url => {
    const urlDomain = getDomain(url);
    return (urlDomain === domain || urlDomain === `www.${domain}`) && !shouldSkip(url);
  });
  
  return filtered;
}

// Save URLs to DynamoDB
async function saveUrls(urls: string[], domain: string): Promise<number> {
  let saved = 0;
  
  for (let i = 0; i < urls.length; i += 25) {
    const batch = urls.slice(i, i + 25);
    
    try {
      await dynamodb.send(new BatchWriteItemCommand({
        RequestItems: {
          [URLS_TABLE]: batch.map(url => ({
            PutRequest: {
              Item: {
                url: { S: url },
                domain: { S: domain },
                source: { S: 'sitemap' },
                status: { S: 'pending' },
                discovered_at: { S: new Date().toISOString() },
              }
            }
          }))
        }
      }));
      saved += batch.length;
    } catch (e) {
      console.log(`  ⚠️ Batch save error`);
    }
  }
  
  return saved;
}

// Get sitemap URL for domain
async function getSitemapUrl(domain: string): Promise<string | null> {
  const result = await dynamodb.send(new GetItemCommand({
    TableName: RULES_TABLE,
    Key: { domain: { S: domain } },
    ProjectionExpression: 'sitemap_url',
  }));
  
  return result.Item?.sitemap_url?.S || null;
}

interface Event {
  domain: string;
}

export async function handler(event: Event) {
  const { domain } = event;
  
  console.log(`🔍 Processing: ${domain}`);
  
  // Get sitemap URL
  const sitemapUrl = await getSitemapUrl(domain);
  if (!sitemapUrl) {
    console.log(`  ❌ No sitemap URL found`);
    return { success: false, domain, error: 'No sitemap URL', urls: 0 };
  }
  
  console.log(`  📄 Sitemap: ${sitemapUrl}`);
  
  // Fetch and filter URLs
  const urls = await fetchSitemapUrls(sitemapUrl, domain);
  console.log(`  📊 Found ${urls.length} valid URLs`);
  
  // Save to DynamoDB
  const saved = await saveUrls(urls, domain);
  console.log(`  ✅ Saved ${saved} URLs`);
  
  return { success: true, domain, urls: saved };
}

