/**
 * STEP 1: MAP ALL URLs
 * 
 * This script collects ALL URLs from ALL domains without downloading any HTML.
 * It classifies each URL as: listing, blog, contact, service, other
 * 
 * Output:
 *   - data/master_url_map.csv (all URLs with classification)
 *   - data/listings_to_download.csv (only listing URLs)
 *   - data/skipped_urls.csv (non-listing URLs with reasons)
 * 
 * Cost: $0 (just HTTP requests to sitemaps)
 * Time: ~1-2 hours for all 3,635 domains
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { parse } from 'csv-parse/sync';

const CONCURRENCY = 30;

// URL Classification Patterns
const CLASSIFICATION_RULES = {
  // These are LISTINGS
  listing: [
    /\/venta\//i, /\/alquiler\//i, /\/rent\//i, /\/sale\//i,
    /\/inmueble\//i, /\/propiedad\//i, /\/property\//i,
    /\/anuncio\//i, /\/ficha\//i, /\/detalle\//i,
    /[-_]venta[-_]/i, /[-_]alquiler[-_]/i,
    /\/ref[-_]?\d+/i, /\/id[-_]?\d+/i,
    /piso|apartamento|casa|chalet|local|garaje|terreno|nave/i,
    /apartment|house|flat|villa|studio|condo/i,
    /\/\d{5,10}(?:\/|\.html?|$)/,  // Numeric IDs
  ],
  
  // These are NOT listings - skip
  blog: [/\/blog\//i, /\/noticias\//i, /\/news\//i, /\/articulo\//i, /\/post\//i],
  contact: [/\/contacto/i, /\/contact/i, /\/ubicacion/i, /\/location(?!\/)/i],
  about: [/\/about/i, /\/sobre/i, /\/quienes/i, /\/nosotros/i, /\/empresa/i],
  services: [/\/servicios/i, /\/services/i, /\/tasacion/i, /\/hipoteca/i],
  legal: [/\/legal/i, /\/privacy/i, /\/cookies/i, /\/politica/i, /\/terms/i, /\/aviso/i],
  team: [/\/team/i, /\/equipo/i, /\/agents?(?:\/|$)/i, /\/asesores/i],
  careers: [/\/careers/i, /\/empleo/i, /\/trabajo/i, /\/jobs/i],
  other: [/\/faq/i, /\/help/i, /\/ayuda/i, /sitemap/i, /robots\.txt/i, /\.pdf$/i, /\.jpg$/i, /\.png$/i],
};

interface UrlRecord {
  domain: string;
  url: string;
  classification: string;
  listing_type: 'sale' | 'rent' | 'unknown';
  source: 'sitemap' | 'crawl';
}

function classifyUrl(url: string): { classification: string; listing_type: 'sale' | 'rent' | 'unknown' } {
  // Check non-listing patterns first (they take priority)
  for (const [type, patterns] of Object.entries(CLASSIFICATION_RULES)) {
    if (type === 'listing') continue;  // Check listing last
    for (const pattern of patterns) {
      if (pattern.test(url)) {
        return { classification: type, listing_type: 'unknown' };
      }
    }
  }
  
  // Check if it's a listing
  for (const pattern of CLASSIFICATION_RULES.listing) {
    if (pattern.test(url)) {
      // Determine sale vs rent
      let listing_type: 'sale' | 'rent' | 'unknown' = 'unknown';
      if (/venta|sale|compra|buy/i.test(url)) listing_type = 'sale';
      else if (/alquiler|rent|arrendar/i.test(url)) listing_type = 'rent';
      
      return { classification: 'listing', listing_type };
    }
  }
  
  // Default: unknown (might be listing, might not)
  return { classification: 'unknown', listing_type: 'unknown' };
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
    
    let content: string;
    
    // Handle gzipped sitemaps
    if (sitemapUrl.endsWith('.gz')) {
      const buffer = await response.arrayBuffer();
      try {
        content = zlib.gunzipSync(Buffer.from(buffer)).toString('utf-8');
      } catch {
        content = new TextDecoder().decode(buffer);
      }
    } else {
      content = await response.text();
    }
    
    const urls: string[] = [];
    const isSitemapIndex = content.includes('<sitemapindex');
    
    if (isSitemapIndex) {
      // It's a sitemap index - recursively fetch child sitemaps
      const sitemapMatches = content.matchAll(/<loc>([^<]+\.xml[^<]*)<\/loc>/gi);
      const childSitemaps: string[] = [];
      for (const match of sitemapMatches) {
        childSitemaps.push(match[1].trim());
      }
      
      // Fetch children in batches
      for (let i = 0; i < childSitemaps.length; i += 5) {
        const batch = childSitemaps.slice(i, i + 5);
        const results = await Promise.all(
          batch.map(url => fetchSitemapUrls(url, visited))
        );
        for (const childUrls of results) {
          urls.push(...childUrls);
        }
      }
    } else {
      // Regular sitemap - extract URLs
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

async function processDomain(
  domain: string,
  sitemapUrl: string | null,
  hasSitemap: boolean
): Promise<UrlRecord[]> {
  const records: UrlRecord[] = [];
  
  if (hasSitemap && sitemapUrl) {
    // Use sitemap
    const urls = await fetchSitemapUrls(sitemapUrl);
    for (const url of urls) {
      const { classification, listing_type } = classifyUrl(url);
      records.push({ domain, url, classification, listing_type, source: 'sitemap' });
    }
  }
  
  // TODO: For no-sitemap domains, we'll add crawling in a separate step
  
  return records;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  STEP 1: MAP ALL URLs');
  console.log('  Collecting ALL URLs from ALL domains (no HTML download yet)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const startTime = Date.now();
  
  // Load domain data
  const sitemapPath = path.join(process.cwd(), 'data', 'agencies_sitemaps.csv');
  const sitemapData = fs.readFileSync(sitemapPath, 'utf-8');
  const sitemapRecords = parse(sitemapData, { columns: true, skip_empty_lines: true });
  
  // Filter to domains with sitemaps (Phase 1)
  const domainsWithSitemaps = sitemapRecords.filter((r: any) => 
    r.sitemap_found === 'YES' && r.sitemap_url && r.sitemap_url.trim() !== ''
  );
  
  console.log(`📋 Processing ${domainsWithSitemaps.length} domains with sitemaps\n`);
  
  const allRecords: UrlRecord[] = [];
  let processed = 0;
  let totalUrls = 0;
  
  // Process in batches
  for (let i = 0; i < domainsWithSitemaps.length; i += CONCURRENCY) {
    const batch = domainsWithSitemaps.slice(i, i + CONCURRENCY);
    
    const batchResults = await Promise.all(
      batch.map((record: any) => processDomain(record.domain, record.sitemap_url, true))
    );
    
    for (const records of batchResults) {
      allRecords.push(...records);
      totalUrls += records.length;
    }
    
    processed += batch.length;
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processed / elapsed;
    const remaining = (domainsWithSitemaps.length - processed) / rate;
    
    process.stdout.write(`\r⏳ Domains: ${processed}/${domainsWithSitemaps.length} | URLs: ${totalUrls.toLocaleString()} | ${Math.round(remaining)}s remaining`);
  }
  
  console.log('\n');
  
  // Calculate statistics
  const byClassification: Record<string, number> = {};
  const byListingType: Record<string, number> = {};
  
  for (const record of allRecords) {
    byClassification[record.classification] = (byClassification[record.classification] || 0) + 1;
    if (record.classification === 'listing') {
      byListingType[record.listing_type] = (byListingType[record.listing_type] || 0) + 1;
    }
  }
  
  // Separate listings from non-listings
  const listings = allRecords.filter(r => r.classification === 'listing');
  const skipped = allRecords.filter(r => r.classification !== 'listing');
  
  // Save master URL map
  const masterPath = path.join(process.cwd(), 'data', 'master_url_map.csv');
  const masterCsv = [
    'domain,url,classification,listing_type,source',
    ...allRecords.map(r => `${r.domain},"${r.url}",${r.classification},${r.listing_type},${r.source}`)
  ].join('\n');
  fs.writeFileSync(masterPath, masterCsv);
  
  // Save listings to download
  const listingsPath = path.join(process.cwd(), 'data', 'listings_to_download.csv');
  const listingsCsv = [
    'domain,url,listing_type',
    ...listings.map(r => `${r.domain},"${r.url}",${r.listing_type}`)
  ].join('\n');
  fs.writeFileSync(listingsPath, listingsCsv);
  
  // Save skipped URLs
  const skippedPath = path.join(process.cwd(), 'data', 'skipped_urls.csv');
  const skippedCsv = [
    'domain,url,reason',
    ...skipped.map(r => `${r.domain},"${r.url}",${r.classification}`)
  ].join('\n');
  fs.writeFileSync(skippedPath, skippedCsv);
  
  // Print summary
  const elapsed = (Date.now() - startTime) / 1000;
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  RESULTS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('📊 URL Classification:');
  console.log('─────────────────────────────────────');
  for (const [type, count] of Object.entries(byClassification).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / totalUrls) * 100).toFixed(1);
    const icon = type === 'listing' ? '✅' : '❌';
    console.log(`  ${icon} ${type.padEnd(15)} ${count.toLocaleString().padStart(10)} (${pct}%)`);
  }
  
  console.log('\n📊 Listing Types (within listings):');
  console.log('─────────────────────────────────────');
  for (const [type, count] of Object.entries(byListingType).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / listings.length) * 100).toFixed(1);
    const icon = type === 'sale' ? '🏠' : type === 'rent' ? '🔑' : '❓';
    console.log(`  ${icon} ${type.padEnd(15)} ${count.toLocaleString().padStart(10)} (${pct}%)`);
  }
  
  console.log('\n📁 Output Files:');
  console.log('─────────────────────────────────────');
  console.log(`  📄 ${masterPath}`);
  console.log(`     All ${totalUrls.toLocaleString()} URLs with classification`);
  console.log(`  📄 ${listingsPath}`);
  console.log(`     ${listings.length.toLocaleString()} listing URLs to download`);
  console.log(`  📄 ${skippedPath}`);
  console.log(`     ${skipped.length.toLocaleString()} URLs skipped (blogs, contact, etc.)`);
  
  console.log('\n⏱️  Time: ' + elapsed.toFixed(1) + ' seconds');
  
  // Storage estimate
  const estimatedGB = (listings.length * 150) / 1024 / 1024 / 1024;  // 150KB per HTML
  const estimatedCost = estimatedGB * 0.023;
  
  console.log('\n💰 STORAGE ESTIMATE (for HTML download):');
  console.log('─────────────────────────────────────');
  console.log(`  Listings to download: ${listings.length.toLocaleString()}`);
  console.log(`  Est. size (150KB avg): ${estimatedGB.toFixed(1)} GB`);
  console.log(`  Est. S3 cost: $${estimatedCost.toFixed(2)}/month`);
  console.log(`  Budget ($30): ${estimatedCost <= 30 ? '✅ Within budget' : '⚠️ Over budget!'}`);
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  NEXT STEP: Run step2-download-listings.ts to download HTML');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);

