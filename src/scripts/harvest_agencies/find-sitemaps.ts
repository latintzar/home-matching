
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

// --- Configuration ---
const INPUT_CSV = 'data/agencies_analyzed.csv';
const OUTPUT_CSV = 'data/agencies_sitemaps.csv';
const CONCURRENCY = 20;
const TIMEOUT_MS = 10000;
const USER_AGENT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'; // Use a bot UA to encourage sitemap serving? Or standard? Let's use standard.
const USER_AGENT_STD = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// --- Interfaces ---
interface AnalyzedRecord {
  domain: string;
  url: string;
  isLikelyAgency: string; // 'YES' | 'NO'
  // ... other fields ignored for now
}

interface SitemapResult {
  domain: string;
  url: string;
  sitemap_found: boolean;
  sitemap_url: string;
  method: string; // 'robots.txt' | 'common_path'
  status_code: number;
}

// --- Common Paths to Check ---
const COMMON_SITEMAP_PATHS = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/wp-sitemap.xml',
  '/sitemap/sitemap.xml',
  '/sitemap1.xml'
];

// --- Main Script ---
async function main() {
  console.log('🗺️  Starting Sitemap Discovery...');

  if (!fs.existsSync(INPUT_CSV)) {
    console.error(`❌ Input file not found: ${INPUT_CSV}`);
    process.exit(1);
  }

  // 1. Read Input
  const inputContent = fs.readFileSync(INPUT_CSV, 'utf-8');
  const records: AnalyzedRecord[] = parse(inputContent, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true
  });

  // Filter for YES agencies only? Or all? 
  // User said "each page", but checking non-agencies is wasteful.
  // Let's check ALL for now, as the user might want to re-verify "NO"s if they have a sitemap.
  // Actually, let's stick to the user's prompt "each page".
  const queue = records;
  console.log(`📋 Processing ${queue.length} domains.`);

  // 2. Prepare Output
  const csvHeaders = ['domain', 'url', 'sitemap_found', 'sitemap_url', 'method', 'status_code'];
  
  // Check if we are resuming
  const processedDomains = new Set<string>();
  if (fs.existsSync(OUTPUT_CSV)) {
    const existing = fs.readFileSync(OUTPUT_CSV, 'utf-8');
    try {
      const existingRecords = parse(existing, { columns: true, skip_empty_lines: true });
      existingRecords.forEach((r: any) => processedDomains.add(r.domain));
      console.log(`⏩ Resuming... Skipping ${processedDomains.size} already processed.`);
    } catch (e) {
      // File might be empty or corrupt, overwrite header
      fs.writeFileSync(OUTPUT_CSV, csvHeaders.join(',') + '\n');
    }
  } else {
    fs.writeFileSync(OUTPUT_CSV, csvHeaders.join(',') + '\n');
  }

  const toProcess = queue.filter(r => !processedDomains.has(r.domain));
  console.log(`🎯 ${toProcess.length} domains remaining.`);

  // 3. Process in Batches
  let completed = 0;
  const total = toProcess.length;

  async function processBatch(batch: AnalyzedRecord[]) {
    const promises = batch.map(async (record) => {
      const result = await findSitemap(record);
      
      const csvLine = stringify([[
        result.domain,
        result.url,
        result.sitemap_found ? 'YES' : 'NO',
        result.sitemap_url,
        result.method,
        result.status_code
      ]]);
      
      fs.appendFileSync(OUTPUT_CSV, csvLine);
      completed++;
      
      if (completed % 50 === 0) {
        console.log(`⏳ Progress: ${completed}/${total} (${Math.round(completed/total*100)}%)`);
      }
    });
    await Promise.all(promises);
  }

  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY);
    await processBatch(batch);
  }

  console.log('✅ Sitemap discovery complete!');
}

async function findSitemap(record: AnalyzedRecord): Promise<SitemapResult> {
  const baseUrl = record.url.replace(/\/$/, ''); // Remove trailing slash
  const result: SitemapResult = {
    domain: record.domain,
    url: record.url,
    sitemap_found: false,
    sitemap_url: '',
    method: '',
    status_code: 0
  };

  try {
    // Step 1: Check robots.txt
    const robotsUrl = `${baseUrl}/robots.txt`;
    const robotsRes = await fetchWithTimeout(robotsUrl);
    
    if (robotsRes.ok) {
      const robotsTxt = await robotsRes.text();
      const sitemapMatch = robotsTxt.match(/Sitemap:\s*(https?:\/\/[^\s]+)/i);
      if (sitemapMatch && sitemapMatch[1]) {
        // Verify the sitemap link exists
        const sitemapUrl = sitemapMatch[1];
        const check = await fetchWithTimeout(sitemapUrl, 'HEAD');
        if (check.ok) {
          result.sitemap_found = true;
          result.sitemap_url = sitemapUrl;
          result.method = 'robots.txt';
          result.status_code = check.status;
          return result;
        }
      }
    }

    // Step 2: Check Common Paths
    for (const path of COMMON_SITEMAP_PATHS) {
      const testUrl = `${baseUrl}${path}`;
      const check = await fetchWithTimeout(testUrl, 'HEAD');
      
      if (check.ok && (check.headers.get('content-type')?.includes('xml') || check.headers.get('content-type')?.includes('text'))) {
        // Double check it's not a soft 404 HTML page by peeking content if needed, 
        // but HEAD ok + XML type is usually good enough. 
        // Some servers return 200 OK for missing pages (SPA), so content-type check is crucial.
        
        // If content type is ambiguous (e.g. text/plain), we might want to GET.
        // Let's try a GET if HEAD was OK.
        const getRes = await fetchWithTimeout(testUrl, 'GET');
        if (getRes.ok) {
          const text = await getRes.text();
          // Check for basic XML sitemap signatures
          if (text.includes('<urlset') || text.includes('<sitemapindex') || text.includes('<?xml')) {
            result.sitemap_found = true;
            result.sitemap_url = testUrl;
            result.method = 'common_path';
            result.status_code = getRes.status;
            return result;
          }
        }
      }
    }

  } catch (error) {
    // Silently fail, result defaults to false
  }

  return result;
}

async function fetchWithTimeout(url: string, method: string = 'GET') {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  
  try {
    const response = await fetch(url, {
      method,
      headers: { 
        'User-Agent': USER_AGENT_STD,
        'Accept': 'application/xml,text/xml,text/plain;q=0.9,*/*;q=0.8' 
      },
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

main().catch(console.error);

