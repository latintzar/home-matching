
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as cheerio from 'cheerio';

// --- Configuration ---
const INPUT_CSV = 'data/MASTER_AGENCY_LIST.csv';
const OUTPUT_CSV = 'data/agency_sitemap_volumetrics.csv';
const CONCURRENCY = 20;
const TIMEOUT_MS = 15000;
const USER_AGENT = 'Mozilla/5.0 (compatible; PropertyBot/1.0; +http://your-domain.com)';

// --- Interfaces ---
interface AgencyRecord {
  domain: string;
  sitemap_found: string;
  sitemap_url: string;
  // ... other fields
}

interface VolumetricResult {
  domain: string;
  sitemap_url: string;
  total_urls: number;
  likely_property_urls: number;
  lastmod_7_days: number;
  lastmod_30_days: number;
  last_updated_date: string; // The most recent date found
  status: 'success' | 'error' | 'timeout';
  error_details?: string;
}

// --- Heuristics ---
// Keywords that suggest a URL is NOT a property listing
const NON_PROPERTY_KEYWORDS = [
  '/contact', '/contacto', '/about', '/nosotros', '/equipo', 
  '/blog', '/noticias', '/news', '/legal', '/privacidad', 
  '/privacy', '/cookies', '/aviso-legal', '/login', '/admin',
  '/wp-content/', '/wp-includes/', '/tags/', '/category/',
  '/search', '/buscar', '/mapa', '/sitemap'
];

// Keywords that strongly suggest a property (optional, for scoring)
const PROPERTY_KEYWORDS = [
  '/propiedad/', '/property/', '/inmueble/', '/ref/', '/id/', 
  '/piso/', '/casa/', '/villa/', '/apartment/', '/venta/', '/alquiler/',
  '-en-venta', '-for-sale'
];

// --- Main Script ---
async function main() {
  console.log('📊 Starting Sitemap Volumetrics Analysis...');

  if (!fs.existsSync(INPUT_CSV)) {
    console.error(`❌ Input file not found: ${INPUT_CSV}`);
    process.exit(1);
  }

  // 1. Read Input
  const records: AgencyRecord[] = parse(fs.readFileSync(INPUT_CSV, 'utf-8'), { 
    columns: true, skip_empty_lines: true, relax_quotes: true 
  });

  // 2. Filter for Sitemaps
  const targets = records.filter(r => r.sitemap_found === 'YES' && r.sitemap_url);
  console.log(`🎯 Analyzing ${targets.length} sitemaps...`);

  // 3. Prepare Output
  const csvHeaders = ['domain', 'sitemap_url', 'total_urls', 'likely_property_urls', 'lastmod_7_days', 'lastmod_30_days', 'last_updated_date', 'status', 'error_details'];
  fs.writeFileSync(OUTPUT_CSV, csvHeaders.join(',') + '\n');

  // 4. Process
  let completed = 0;
  const total = targets.length;

  async function processBatch(batch: AgencyRecord[]) {
    const promises = batch.map(async (record) => {
      const result = await analyzeSitemap(record);
      
      const csvLine = stringify([[
        result.domain,
        result.sitemap_url,
        result.total_urls,
        result.likely_property_urls,
        result.lastmod_7_days,
        result.lastmod_30_days,
        result.last_updated_date,
        result.status,
        result.error_details || ''
      ]]);
      
      fs.appendFileSync(OUTPUT_CSV, csvLine);
      completed++;
      if (completed % 20 === 0) {
        console.log(`⏳ Progress: ${completed}/${total} (${Math.round(completed/total*100)}%)`);
      }
    });
    await Promise.all(promises);
  }

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    await processBatch(batch);
  }

  console.log('✅ Volumetrics analysis complete!');
}

// --- Sitemap Fetcher & Parser ---

async function analyzeSitemap(record: AgencyRecord): Promise<VolumetricResult> {
  const result: VolumetricResult = {
    domain: record.domain,
    sitemap_url: record.sitemap_url,
    total_urls: 0,
    likely_property_urls: 0,
    lastmod_7_days: 0,
    lastmod_30_days: 0,
    last_updated_date: '',
    status: 'success'
  };

  try {
    const urls = await fetchAllUrls(record.sitemap_url);
    result.total_urls = urls.length;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let maxDate = new Date(0);

    for (const item of urls) {
      // 1. Property Heuristic
      const lowerLoc = item.loc.toLowerCase();
      const isExcluded = NON_PROPERTY_KEYWORDS.some(k => lowerLoc.includes(k));
      // If not explicitly excluded, we assume it *could* be a property (or we can use strict inclusion)
      // Strict inclusion is safer for "count" but might miss things. 
      // Exclusion is better for volume estimation.
      
      // Let's use a hybrid: Not Excluded AND (Has Property Keyword OR Path Depth > 1)
      // Path depth check: 'domain.com/propiedad-123' (depth 1). 'domain.com/page' (depth 1).
      // It's hard to be perfect without ML. Let's stick to "Not Excluded".
      
      if (!isExcluded) {
        result.likely_property_urls++;

        // 2. Date Stats
        if (item.lastmod) {
          const date = new Date(item.lastmod);
          if (!isNaN(date.getTime())) {
            if (date > maxDate) maxDate = date;
            if (date >= sevenDaysAgo) result.lastmod_7_days++;
            if (date >= thirtyDaysAgo) result.lastmod_30_days++;
          }
        }
      }
    }

    if (maxDate.getTime() > 0) {
      result.last_updated_date = maxDate.toISOString().split('T')[0];
    }

  } catch (error: any) {
    result.status = 'error';
    result.error_details = error.message;
  }

  return result;
}

interface SitemapUrl {
  loc: string;
  lastmod?: string;
}

// Recursively fetch sitemaps (handles sitemapindex)
async function fetchAllUrls(url: string, depth: number = 0): Promise<SitemapUrl[]> {
  if (depth > 2) return []; // Safety limit for recursion
  
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const xml = await response.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  
  const collectedUrls: SitemapUrl[] = [];

  // Check for <sitemapindex>
  const sitemaps = $('sitemap');
  if (sitemaps.length > 0) {
    // It's an index
    const promises: Promise<SitemapUrl[]>[] = [];
    sitemaps.each((_, el) => {
      const childLoc = $(el).find('loc').text().trim();
      if (childLoc) {
        promises.push(fetchAllUrls(childLoc, depth + 1));
      }
    });
    
    // Flatten results
    const results = await Promise.all(promises);
    results.forEach(r => collectedUrls.push(...r));
  } else {
    // It's a urlset
    $('url').each((_, el) => {
      const loc = $(el).find('loc').text().trim();
      const lastmod = $(el).find('lastmod').text().trim();
      if (loc) {
        collectedUrls.push({ loc, lastmod });
      }
    });
  }

  return collectedUrls;
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal
    });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

main().catch(console.error);

