/**
 * 🔭 HarvestEngine Observation Mode - Phase 1: Sitemap URL Pattern Analysis
 * 
 * This script analyzes sitemap URLs from 1,000+ real estate agency domains
 * to identify Sale vs Rent URL patterns for each domain.
 * 
 * Usage:
 *   npx tsx src/scripts/harvest_agencies/observe-url-patterns.ts
 * 
 * Input:  data/MASTER_AGENCY_LIST.csv
 * Output: data/domain_url_patterns.csv
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as cheerio from 'cheerio';

// --- Configuration ---
const INPUT_CSV = 'data/MASTER_AGENCY_LIST.csv';
const OUTPUT_CSV = 'data/domain_url_patterns.csv';
const CONCURRENCY = 15;
const TIMEOUT_MS = 20000;
const MAX_URLS_PER_SITEMAP = 500; // Sample size for pattern analysis
const USER_AGENT = 'Mozilla/5.0 (compatible; LeoBot/1.0; +https://leo.casa)';

// --- Pattern Recognition ---
const SALE_KEYWORDS = [
  '/venta/', '-en-venta', '/comprar/', '/compra/', '/buy/', '-for-sale', '/for-sale/',
  '/en-venta/', '/sale/', '/sales/', '/verkauf/', '/a-vendre/', '-sale', '/kaufen/',
  '/compraventa/', '-venta', '/propiedades-en-venta', '/viviendas-en-venta'
];

const RENT_KEYWORDS = [
  '/alquiler/', '-en-alquiler', '/arrendar/', '/rent/', '/for-rent/', '-for-rent',
  '/alquilar/', '/renting/', '/en-alquiler/', '/miete/', '/location/', '-rent',
  '/alquileres/', '-alquiler', '/propiedades-en-alquiler', '/viviendas-en-alquiler'
];

const LISTING_ID_PATTERNS = [
  { pattern: /\/ref[-_]?(\d+)/i, name: 'ref-id' },
  { pattern: /\/id[-_]?(\d+)/i, name: 'id-param' },
  { pattern: /\/inmueble\/(\d+)/i, name: 'inmueble' },
  { pattern: /\/propiedad\/(\d+)/i, name: 'propiedad' },
  { pattern: /\/property\/(\d+)/i, name: 'property' },
  { pattern: /\/vivienda\/(\d+)/i, name: 'vivienda' },
  { pattern: /\/piso\/(\d+)/i, name: 'piso' },
  { pattern: /\/casa\/(\d+)/i, name: 'casa' },
  { pattern: /[-_](\d{5,10})(?:\/|$|\.html)/i, name: 'trailing-id' },
  { pattern: /\/(\d{6,10})(?:\/|$|\.html)/i, name: 'path-id' },
];

// Non-property URL keywords to exclude
const NON_PROPERTY_KEYWORDS = [
  '/contact', '/contacto', '/about', '/nosotros', '/equipo',
  '/blog', '/noticias', '/news', '/legal', '/privacidad',
  '/privacy', '/cookies', '/aviso-legal', '/login', '/admin',
  '/wp-content/', '/wp-includes/', '/tags/', '/category/',
  '/search', '/buscar', '/sitemap', '/rss', '/feed'
];

// --- Interfaces ---
interface AgencyRecord {
  domain: string;
  url: string;
  sitemap_found: string;
  sitemap_url: string;
  is_likely_agency: string;
}

interface PatternMatch {
  pattern: string;
  count: number;
}

interface DomainPattern {
  domain: string;
  sitemap_url: string;
  total_sampled: number;
  sale_count: number;
  rent_count: number;
  unknown_count: number;
  sale_patterns: string;      // JSON array of detected patterns
  rent_patterns: string;      // JSON array of detected patterns
  listing_id_pattern: string; // Detected ID pattern name
  listing_types: string;      // 'sale', 'rent', 'both', 'unknown'
  confidence: 'high' | 'medium' | 'low';
  status: 'success' | 'error' | 'timeout';
  error_details: string;
}

// --- Main Script ---
async function main() {
  const startTime = Date.now();
  
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🔭 HarvestEngine Observation Mode - Phase 1: Sitemaps       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('📊 Analyzing sitemap URLs for Sale vs Rent classification...');
  console.log(`📁 Input:  ${INPUT_CSV}`);
  console.log(`📁 Output: ${OUTPUT_CSV}`);
  console.log(`⚙️  Concurrency: ${CONCURRENCY} | Timeout: ${TIMEOUT_MS}ms | Sample: ${MAX_URLS_PER_SITEMAP} URLs`);
  console.log('');

  if (!fs.existsSync(INPUT_CSV)) {
    console.error(`❌ Input file not found: ${INPUT_CSV}`);
    process.exit(1);
  }

  // 1. Read Input
  const records: AgencyRecord[] = parse(fs.readFileSync(INPUT_CSV, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true
  });

  // 2. Filter for domains WITH sitemaps AND likely agencies
  const targets = records.filter(r => 
    r.sitemap_found === 'YES' && 
    r.sitemap_url && 
    r.is_likely_agency === 'YES'
  );
  
  console.log(`📋 Total records: ${records.length}`);
  console.log(`🎯 Domains with sitemaps (likely agencies): ${targets.length}`);
  console.log('');

  // 3. Prepare Output
  const csvHeaders = [
    'domain', 'sitemap_url', 'total_sampled', 'sale_count', 'rent_count',
    'unknown_count', 'sale_patterns', 'rent_patterns', 'listing_id_pattern',
    'listing_types', 'confidence', 'status', 'error_details'
  ];
  
  // Check if we're resuming
  const processedDomains = new Set<string>();
  if (fs.existsSync(OUTPUT_CSV)) {
    const existing = fs.readFileSync(OUTPUT_CSV, 'utf-8');
    try {
      const existingRecords = parse(existing, { columns: true, skip_empty_lines: true });
      existingRecords.forEach((r: any) => processedDomains.add(r.domain));
      console.log(`⏩ Resuming... Skipping ${processedDomains.size} already processed domains.`);
    } catch (e) {
      // File might be empty or corrupt, start fresh
      fs.writeFileSync(OUTPUT_CSV, csvHeaders.join(',') + '\n');
    }
  } else {
    fs.writeFileSync(OUTPUT_CSV, csvHeaders.join(',') + '\n');
  }

  const toProcess = targets.filter(r => !processedDomains.has(r.domain));
  console.log(`🎯 Domains to process: ${toProcess.length}`);
  console.log('');
  console.log('─'.repeat(70));

  // 4. Process in Batches
  let completed = 0;
  let successCount = 0;
  let errorCount = 0;
  let saleOnlyCount = 0;
  let rentOnlyCount = 0;
  let bothCount = 0;
  let unknownCount = 0;
  
  const total = toProcess.length;

  async function processBatch(batch: AgencyRecord[]) {
    const promises = batch.map(async (record) => {
      const result = await analyzeUrlPatterns(record);

      const csvLine = stringify([[
        result.domain,
        result.sitemap_url,
        result.total_sampled,
        result.sale_count,
        result.rent_count,
        result.unknown_count,
        result.sale_patterns,
        result.rent_patterns,
        result.listing_id_pattern,
        result.listing_types,
        result.confidence,
        result.status,
        result.error_details
      ]]);

      fs.appendFileSync(OUTPUT_CSV, csvLine);
      completed++;

      // Update stats
      if (result.status === 'success') {
        successCount++;
        if (result.listing_types === 'sale') saleOnlyCount++;
        else if (result.listing_types === 'rent') rentOnlyCount++;
        else if (result.listing_types === 'both') bothCount++;
        else unknownCount++;
      } else {
        errorCount++;
      }

      // Log progress with emoji indicators
      const statusEmoji = result.status === 'success' ? '✅' : '❌';
      const typeEmoji = result.listing_types === 'sale' ? '🏠' :
                        result.listing_types === 'rent' ? '🔑' :
                        result.listing_types === 'both' ? '🏠🔑' : '❓';
      const confEmoji = result.confidence === 'high' ? '🟢' :
                        result.confidence === 'medium' ? '🟡' : '🔴';

      // Log every domain for visibility
      const progress = `[${completed}/${total}]`;
      const stats = `S:${result.sale_count} R:${result.rent_count}`;
      console.log(`${statusEmoji} ${typeEmoji} ${confEmoji} ${progress} ${result.domain.padEnd(35)} ${stats}`);
    });
    await Promise.all(promises);
  }

  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY);
    await processBatch(batch);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('');
  console.log('─'.repeat(70));
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  📊 OBSERVATION COMPLETE                                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`⏱️  Time: ${elapsed}s`);
  console.log(`✅ Success: ${successCount} | ❌ Errors: ${errorCount}`);
  console.log('');
  console.log('📈 Listing Type Breakdown:');
  console.log(`   🏠 Sale Only:  ${saleOnlyCount}`);
  console.log(`   🔑 Rent Only:  ${rentOnlyCount}`);
  console.log(`   🏠🔑 Both:     ${bothCount}`);
  console.log(`   ❓ Unknown:    ${unknownCount}`);
  console.log('');
  console.log(`📁 Results saved to: ${OUTPUT_CSV}`);
  console.log('');
}

async function analyzeUrlPatterns(record: AgencyRecord): Promise<DomainPattern> {
  const result: DomainPattern = {
    domain: record.domain,
    sitemap_url: record.sitemap_url,
    total_sampled: 0,
    sale_count: 0,
    rent_count: 0,
    unknown_count: 0,
    sale_patterns: '[]',
    rent_patterns: '[]',
    listing_id_pattern: '',
    listing_types: 'unknown',
    confidence: 'low',
    status: 'success',
    error_details: ''
  };

  try {
    const urls = await fetchSitemapUrls(record.sitemap_url, MAX_URLS_PER_SITEMAP);
    
    if (urls.length === 0) {
      result.status = 'error';
      result.error_details = 'No URLs found in sitemap';
      return result;
    }
    
    result.total_sampled = urls.length;

    const salePatternCounts = new Map<string, number>();
    const rentPatternCounts = new Map<string, number>();
    const idPatternCounts = new Map<string, number>();

    for (const url of urls) {
      const lowerUrl = url.toLowerCase();
      
      // Skip non-property URLs
      const isExcluded = NON_PROPERTY_KEYWORDS.some(k => lowerUrl.includes(k));
      if (isExcluded) {
        result.unknown_count++;
        continue;
      }

      // Classify as Sale or Rent
      const saleMatches = SALE_KEYWORDS.filter(k => lowerUrl.includes(k));
      const rentMatches = RENT_KEYWORDS.filter(k => lowerUrl.includes(k));
      
      const isSale = saleMatches.length > 0;
      const isRent = rentMatches.length > 0;

      if (isSale && !isRent) {
        result.sale_count++;
        // Track which patterns matched
        for (const k of saleMatches) {
          salePatternCounts.set(k, (salePatternCounts.get(k) || 0) + 1);
        }
      } else if (isRent && !isSale) {
        result.rent_count++;
        for (const k of rentMatches) {
          rentPatternCounts.set(k, (rentPatternCounts.get(k) || 0) + 1);
        }
      } else if (isSale && isRent) {
        // URL has both keywords - count for both
        result.sale_count++;
        result.rent_count++;
        for (const k of saleMatches) {
          salePatternCounts.set(k, (salePatternCounts.get(k) || 0) + 1);
        }
        for (const k of rentMatches) {
          rentPatternCounts.set(k, (rentPatternCounts.get(k) || 0) + 1);
        }
      } else {
        result.unknown_count++;
      }

      // Detect listing ID patterns
      for (const { pattern, name } of LISTING_ID_PATTERNS) {
        if (pattern.test(url)) {
          idPatternCounts.set(name, (idPatternCounts.get(name) || 0) + 1);
        }
      }
    }

    // Extract top patterns
    result.sale_patterns = JSON.stringify(
      Array.from(salePatternCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([pattern, count]) => ({ pattern, count }))
    );

    result.rent_patterns = JSON.stringify(
      Array.from(rentPatternCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([pattern, count]) => ({ pattern, count }))
    );

    // Get most common ID pattern
    if (idPatternCounts.size > 0) {
      const topIdPattern = Array.from(idPatternCounts.entries())
        .sort((a, b) => b[1] - a[1])[0];
      result.listing_id_pattern = topIdPattern[0];
    }

    // Determine listing types
    const hasSale = result.sale_count > 0;
    const hasRent = result.rent_count > 0;
    
    if (hasSale && hasRent) {
      result.listing_types = 'both';
    } else if (hasSale) {
      result.listing_types = 'sale';
    } else if (hasRent) {
      result.listing_types = 'rent';
    } else {
      result.listing_types = 'unknown';
    }

    // Calculate confidence
    const classifiedCount = result.sale_count + result.rent_count;
    const propertyUrls = result.total_sampled - result.unknown_count;
    const classifiedRatio = propertyUrls > 0 ? classifiedCount / propertyUrls : 0;
    
    if (classifiedRatio >= 0.5 && classifiedCount >= 10) {
      result.confidence = 'high';
    } else if (classifiedRatio >= 0.2 || classifiedCount >= 5) {
      result.confidence = 'medium';
    } else {
      result.confidence = 'low';
    }

  } catch (error: any) {
    result.status = 'error';
    result.error_details = error.message?.substring(0, 100) || 'Unknown error';
  }

  return result;
}

async function fetchSitemapUrls(sitemapUrl: string, maxUrls: number, depth: number = 0): Promise<string[]> {
  if (depth > 2) return []; // Safety limit for recursion
  
  const response = await fetchWithTimeout(sitemapUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const xml = await response.text();
  const $ = cheerio.load(xml, { xmlMode: true });

  const urls: string[] = [];

  // Check for sitemap index
  const sitemaps = $('sitemap');
  if (sitemaps.length > 0) {
    // It's an index - fetch child sitemaps
    const childUrls: string[] = [];
    sitemaps.each((_, el) => {
      const loc = $(el).find('loc').text().trim();
      if (loc) childUrls.push(loc);
    });
    
    // Fetch up to 3 child sitemaps to get variety
    const toFetch = childUrls.slice(0, 3);
    for (const childUrl of toFetch) {
      if (urls.length >= maxUrls) break;
      try {
        const childUrls = await fetchSitemapUrls(childUrl, maxUrls - urls.length, depth + 1);
        urls.push(...childUrls);
      } catch (e) {
        // Skip failed child sitemaps
      }
    }
    return urls;
  }

  // Parse urlset
  $('url').each((i, el) => {
    if (urls.length >= maxUrls) return false; // Stop early
    const loc = $(el).find('loc').text().trim();
    if (loc) urls.push(loc);
  });

  return urls;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 
        'User-Agent': USER_AGENT,
        'Accept': 'application/xml,text/xml,*/*;q=0.8'
      },
      signal: controller.signal
    });
    clearTimeout(id);
    return res;
  } catch (e: any) {
    clearTimeout(id);
    if (e.name === 'AbortError') {
      throw new Error('Timeout');
    }
    throw e;
  }
}

main().catch((e) => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});

