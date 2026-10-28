/**
 * 🔭 HarvestEngine Observation Mode - Phase 1B: Enhanced Pattern Analysis
 * 
 * This enhanced version includes additional patterns discovered from analyzing
 * "unknown" domains. It re-processes only domains that were classified as "unknown"
 * in the first pass.
 * 
 * New patterns added:
 * - Compound patterns: piso-venta-, casa-venta-, venta-casas, venta-pisos
 * - Property type indicators: /anuncio/, /inmueble/, /propiedad/
 * - More international patterns
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as cheerio from 'cheerio';

// --- Configuration ---
const INPUT_CSV = 'data/domain_url_patterns.csv';
const OUTPUT_CSV = 'data/domain_url_patterns_enhanced.csv';
const CONCURRENCY = 15;
const TIMEOUT_MS = 25000;
const MAX_URLS_PER_SITEMAP = 800; // Increased sample size
const MAX_SITEMAP_DEPTH = 4; // Deeper recursion for nested sitemaps
const USER_AGENT = 'Mozilla/5.0 (compatible; LeoBot/1.0; +https://leo.casa)';

// --- ENHANCED Pattern Recognition ---
const SALE_KEYWORDS = [
  // Standard patterns
  '/venta/', '-en-venta', '/comprar/', '/compra/', '/buy/', '-for-sale', '/for-sale/',
  '/en-venta/', '/sale/', '/sales/', '/verkauf/', '/a-vendre/', '-sale', '/kaufen/',
  '/compraventa/', '-venta', '/propiedades-en-venta', '/viviendas-en-venta',
  // NEW: Compound patterns (e.g., donpiso.com, iadespana.es)
  'venta-casas', 'venta-pisos', 'venta-locales', 'venta-solares', 'venta-chalets',
  'piso-venta-', 'casa-venta-', 'chalet-venta-', 'local-venta-', 'apartamento-venta-',
  'terreno-venta-', 'solar-venta-', 'villa-venta-', 'nave-venta-', 'finca-venta-',
  '-venta-', // Generic compound: anything-venta-anything
  // NEW: English compound patterns
  'apartment-for-sale', 'house-for-sale', 'flat-for-sale', 'villa-for-sale',
  'property-for-sale', 'home-for-sale',
  // NEW: Keyword anywhere patterns (less strict)
  '/ventas/', '/vender/', '/compraventa/'
];

const RENT_KEYWORDS = [
  // Standard patterns
  '/alquiler/', '-en-alquiler', '/arrendar/', '/rent/', '/for-rent/', '-for-rent',
  '/alquilar/', '/renting/', '/en-alquiler/', '/miete/', '/location/', '-rent',
  '/alquileres/', '-alquiler', '/propiedades-en-alquiler', '/viviendas-en-alquiler',
  // NEW: Compound patterns
  'alquiler-casas', 'alquiler-pisos', 'alquiler-locales', 'alquiler-chalets',
  'piso-alquiler-', 'casa-alquiler-', 'chalet-alquiler-', 'local-alquiler-',
  'apartamento-alquiler-', 'terreno-alquiler-', 'villa-alquiler-', 'nave-alquiler-',
  '-alquiler-', // Generic compound
  // NEW: English compound patterns  
  'apartment-for-rent', 'house-for-rent', 'flat-for-rent', 'villa-for-rent',
  'property-for-rent', 'home-for-rent', 'to-rent', 'to-let',
  // NEW: French/German patterns
  '/a-louer/', '/vermietung/', '/mieten/'
];

// NEW: Property listing URL indicators (suggest it's a listing even without sale/rent keyword)
const LISTING_INDICATORS = [
  '/anuncio/',     // iadespana.es style
  '/inmueble/',    // Common Spanish
  '/propiedad/',   // Property detail
  '/property/',    // English
  '/ficha/',       // Detail/sheet
  '/detalle/',     // Detail page
  '/listing/',     // English listing
  '/ref/',         // Reference number
  '/id/',          // ID-based
  'habitaciones',  // iadespana.es: piso-venta-3-habitaciones
];

const LISTING_ID_PATTERNS = [
  { pattern: /\/ref[-_]?(\d+)/i, name: 'ref-id' },
  { pattern: /\/id[-_]?(\d+)/i, name: 'id-param' },
  { pattern: /\/r(\d+)$/i, name: 'r-id' }, // iadespana.es style: /r63411
  { pattern: /\/inmueble\/(\d+)/i, name: 'inmueble' },
  { pattern: /\/propiedad\/(\d+)/i, name: 'propiedad' },
  { pattern: /\/property\/(\d+)/i, name: 'property' },
  { pattern: /\/vivienda\/(\d+)/i, name: 'vivienda' },
  { pattern: /\/piso\/(\d+)/i, name: 'piso' },
  { pattern: /\/casa\/(\d+)/i, name: 'casa' },
  { pattern: /\/anuncio\/[^\/]+\/r?(\d+)/i, name: 'anuncio-id' },
  { pattern: /[-_](\d{5,10})(?:\/|$|\.html)/i, name: 'trailing-id' },
  { pattern: /\/(\d{6,10})(?:\/|$|\.html)/i, name: 'path-id' },
];

const NON_PROPERTY_KEYWORDS = [
  '/contact', '/contacto', '/about', '/nosotros', '/equipo', '/team',
  '/blog', '/noticias', '/news', '/legal', '/privacidad', '/aviso-legal',
  '/privacy', '/cookies', '/login', '/admin', '/wp-content/', '/wp-includes/',
  '/tags/', '/category/', '/search', '/buscar', '/sitemap', '/rss', '/feed',
  '/politica', '/terminos', '/condiciones', '/faqs', '/faq', '/ayuda', '/help',
  '/trabaja', '/empleo', '/careers', '/jobs', '/oficinas', '/offices',
  '/servicios', '/services', '/franquicia', '/franchise', '/valoracion',
  // Also exclude list/search pages (we want individual listings)
  '/listado', '/resultados', '/buscador'
];

// --- Interfaces ---
interface InputRecord {
  domain: string;
  sitemap_url: string;
  listing_types: string;
  confidence: string;
  status: string;
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
  listing_indicator_count: number;
  sale_patterns: string;
  rent_patterns: string;
  listing_id_pattern: string;
  listing_types: string;
  confidence: 'high' | 'medium' | 'low';
  status: 'success' | 'error' | 'timeout';
  error_details: string;
}

// --- Main Script ---
async function main() {
  const startTime = Date.now();
  
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🔭 HarvestEngine Phase 1B: Enhanced Pattern Analysis        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('📊 Re-analyzing "unknown" domains with enhanced patterns...');
  console.log(`📁 Input:  ${INPUT_CSV}`);
  console.log(`📁 Output: ${OUTPUT_CSV}`);
  console.log(`⚙️  Depth: ${MAX_SITEMAP_DEPTH} | Sample: ${MAX_URLS_PER_SITEMAP} URLs`);
  console.log('');
  console.log('🆕 New patterns added:');
  console.log('   - Compound: piso-venta-, venta-casas, alquiler-pisos');
  console.log('   - Listing indicators: /anuncio/, habitaciones');
  console.log('   - Deeper sitemap recursion (4 levels)');
  console.log('');

  if (!fs.existsSync(INPUT_CSV)) {
    console.error(`❌ Input file not found: ${INPUT_CSV}`);
    process.exit(1);
  }

  // 1. Read previous results
  const previousResults: InputRecord[] = parse(fs.readFileSync(INPUT_CSV, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true
  });

  // 2. Filter for "unknown" domains that had success status
  const unknownDomains = previousResults.filter(r => 
    r.listing_types === 'unknown' && 
    r.status === 'success' &&
    r.sitemap_url
  );
  
  console.log(`📋 Total previous results: ${previousResults.length}`);
  console.log(`🎯 Unknown domains to re-analyze: ${unknownDomains.length}`);
  console.log('');

  // 3. Keep non-unknown results as-is
  const keepResults = previousResults.filter(r => 
    r.listing_types !== 'unknown' || r.status !== 'success'
  );
  
  console.log(`✅ Keeping ${keepResults.length} already-classified domains`);
  console.log('');
  console.log('─'.repeat(70));

  // 4. Prepare output with headers
  const csvHeaders = [
    'domain', 'sitemap_url', 'total_sampled', 'sale_count', 'rent_count',
    'unknown_count', 'listing_indicator_count', 'sale_patterns', 'rent_patterns', 
    'listing_id_pattern', 'listing_types', 'confidence', 'status', 'error_details'
  ];
  
  // Write headers and kept results first
  let csvContent = csvHeaders.join(',') + '\n';
  for (const r of keepResults) {
    csvContent += stringify([[
      r.domain, r.sitemap_url, 
      (r as any).total_sampled || 0, (r as any).sale_count || 0, 
      (r as any).rent_count || 0, (r as any).unknown_count || 0,
      (r as any).listing_indicator_count || 0,
      (r as any).sale_patterns || '[]', (r as any).rent_patterns || '[]',
      (r as any).listing_id_pattern || '', r.listing_types, r.confidence, r.status,
      (r as any).error_details || ''
    ]]);
  }
  fs.writeFileSync(OUTPUT_CSV, csvContent);

  // 5. Process unknown domains
  let completed = 0;
  let newlySale = 0;
  let newlyRent = 0;
  let newlyBoth = 0;
  let stillUnknown = 0;
  const total = unknownDomains.length;

  async function processBatch(batch: InputRecord[]) {
    const promises = batch.map(async (record) => {
      const result = await analyzeUrlPatternsEnhanced(record);

      const csvLine = stringify([[
        result.domain,
        result.sitemap_url,
        result.total_sampled,
        result.sale_count,
        result.rent_count,
        result.unknown_count,
        result.listing_indicator_count,
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

      // Track improvements
      if (result.listing_types === 'sale') newlySale++;
      else if (result.listing_types === 'rent') newlyRent++;
      else if (result.listing_types === 'both') newlyBoth++;
      else stillUnknown++;

      // Log progress
      const statusEmoji = result.status === 'success' ? '✅' : '❌';
      const typeEmoji = result.listing_types === 'sale' ? '🏠' :
                        result.listing_types === 'rent' ? '🔑' :
                        result.listing_types === 'both' ? '🏠🔑' : '❓';
      const confEmoji = result.confidence === 'high' ? '🟢' :
                        result.confidence === 'medium' ? '🟡' : '🔴';
      const improved = result.listing_types !== 'unknown' ? '⬆️' : '';

      const progress = `[${completed}/${total}]`;
      const stats = `S:${result.sale_count} R:${result.rent_count} L:${result.listing_indicator_count}`;
      console.log(`${statusEmoji} ${typeEmoji} ${confEmoji} ${improved} ${progress} ${result.domain.padEnd(35)} ${stats}`);
    });
    await Promise.all(promises);
  }

  for (let i = 0; i < unknownDomains.length; i += CONCURRENCY) {
    const batch = unknownDomains.slice(i, i + CONCURRENCY);
    await processBatch(batch);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const improvedCount = newlySale + newlyRent + newlyBoth;
  const improvementRate = ((improvedCount / total) * 100).toFixed(1);

  console.log('');
  console.log('─'.repeat(70));
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  📊 ENHANCED ANALYSIS COMPLETE                               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`⏱️  Time: ${elapsed}s`);
  console.log('');
  console.log('📈 Improvement from Enhanced Patterns:');
  console.log(`   Previously Unknown: ${total}`);
  console.log(`   Now Classified: ${improvedCount} (${improvementRate}%)`);
  console.log('');
  console.log('   🏠 Newly Sale:     ${newlySale}');
  console.log(`   🔑 Newly Rent:     ${newlyRent}`);
  console.log(`   🏠🔑 Newly Both:   ${newlyBoth}`);
  console.log(`   ❓ Still Unknown:  ${stillUnknown}`);
  console.log('');
  console.log(`📁 Results saved to: ${OUTPUT_CSV}`);
  console.log('');
}

async function analyzeUrlPatternsEnhanced(record: InputRecord): Promise<DomainPattern> {
  const result: DomainPattern = {
    domain: record.domain,
    sitemap_url: record.sitemap_url,
    total_sampled: 0,
    sale_count: 0,
    rent_count: 0,
    unknown_count: 0,
    listing_indicator_count: 0,
    sale_patterns: '[]',
    rent_patterns: '[]',
    listing_id_pattern: '',
    listing_types: 'unknown',
    confidence: 'low',
    status: 'success',
    error_details: ''
  };

  try {
    // Fetch with deeper recursion
    const urls = await fetchSitemapUrlsDeep(record.sitemap_url, MAX_URLS_PER_SITEMAP, 0);
    
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

      // Check for listing indicators (even without sale/rent keyword)
      const hasListingIndicator = LISTING_INDICATORS.some(k => lowerUrl.includes(k));
      if (hasListingIndicator) {
        result.listing_indicator_count++;
      }

      // Classify as Sale or Rent with ENHANCED patterns
      const saleMatches = SALE_KEYWORDS.filter(k => lowerUrl.includes(k));
      const rentMatches = RENT_KEYWORDS.filter(k => lowerUrl.includes(k));
      
      const isSale = saleMatches.length > 0;
      const isRent = rentMatches.length > 0;

      if (isSale && !isRent) {
        result.sale_count++;
        for (const k of saleMatches) {
          salePatternCounts.set(k, (salePatternCounts.get(k) || 0) + 1);
        }
      } else if (isRent && !isSale) {
        result.rent_count++;
        for (const k of rentMatches) {
          rentPatternCounts.set(k, (rentPatternCounts.get(k) || 0) + 1);
        }
      } else if (isSale && isRent) {
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
        .slice(0, 5)
        .map(([pattern, count]) => ({ pattern, count }))
    );

    result.rent_patterns = JSON.stringify(
      Array.from(rentPatternCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
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

    // Calculate confidence - factor in listing indicators for unknown
    const classifiedCount = result.sale_count + result.rent_count;
    const propertyUrls = result.total_sampled - result.unknown_count;
    const classifiedRatio = propertyUrls > 0 ? classifiedCount / propertyUrls : 0;
    
    if (classifiedRatio >= 0.3 && classifiedCount >= 10) {
      result.confidence = 'high';
    } else if (classifiedRatio >= 0.1 || classifiedCount >= 3) {
      result.confidence = 'medium';
    } else if (result.listing_indicator_count > 10) {
      // Has listing indicators but no sale/rent - could be a listings site
      result.confidence = 'low';
    } else {
      result.confidence = 'low';
    }

  } catch (error: any) {
    result.status = 'error';
    result.error_details = error.message?.substring(0, 100) || 'Unknown error';
  }

  return result;
}

async function fetchSitemapUrlsDeep(sitemapUrl: string, maxUrls: number, depth: number): Promise<string[]> {
  if (depth > MAX_SITEMAP_DEPTH) return [];
  
  const response = await fetchWithTimeout(sitemapUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const xml = await response.text();
  const $ = cheerio.load(xml, { xmlMode: true });

  const urls: string[] = [];

  // Check for sitemap index
  const sitemaps = $('sitemap');
  if (sitemaps.length > 0) {
    // It's an index - fetch ALL child sitemaps (not just 3)
    const childUrls: string[] = [];
    sitemaps.each((_, el) => {
      const loc = $(el).find('loc').text().trim();
      if (loc) childUrls.push(loc);
    });
    
    // Prioritize sitemaps that might contain properties
    const prioritySitemaps = childUrls.filter(u => 
      u.includes('advertisement') || u.includes('property') || 
      u.includes('inmueble') || u.includes('listing') ||
      u.includes('anuncio') || u.includes('propiedad')
    );
    const otherSitemaps = childUrls.filter(u => !prioritySitemaps.includes(u));
    
    // Fetch priority sitemaps first, then others
    const toFetch = [...prioritySitemaps, ...otherSitemaps].slice(0, 10);
    
    for (const childUrl of toFetch) {
      if (urls.length >= maxUrls) break;
      try {
        const childUrls = await fetchSitemapUrlsDeep(childUrl, maxUrls - urls.length, depth + 1);
        urls.push(...childUrls);
      } catch (e) {
        // Skip failed child sitemaps silently
      }
    }
    return urls;
  }

  // Parse urlset
  $('url').each((i, el) => {
    if (urls.length >= maxUrls) return false;
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

