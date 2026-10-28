/**
 * 📊 Full Listing Census - Sale vs Rent
 * 
 * Fetches ALL 945 classified domains and counts:
 * 1. Total LIVE listings (sale vs rent)
 * 2. Daily updates for past 30 days (sale vs rent)
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import * as cheerio from 'cheerio';

const CLASSIFIED_CSV = 'data/domain_url_patterns.csv';
const OUTPUT_JSON = 'data/full_listing_census.json';
const CONCURRENCY = 80;  // Massively parallel
const TIMEOUT_MS = 10000;

// URL patterns to classify individual URLs
const SALE_PATTERNS = [
  '/venta/', '-en-venta', '-venta', '/comprar/', '/compra/', '/buy/', 
  '-for-sale', '/for-sale/', '/sale/', 'venta-', 'piso-venta-', 
  'casa-venta-', '-sale'
];

const RENT_PATTERNS = [
  '/alquiler/', '-en-alquiler', '-alquiler', '/arrendar/', '/rent/', 
  '-for-rent', '/for-rent/', '/renting/', 'alquiler-', 'piso-alquiler-',
  '-rent', '/location/'
];

interface DomainData {
  domain: string;
  sitemap_url: string;
  listing_types: string;
  sale_patterns: string;
  rent_patterns: string;
}

interface UrlData {
  url: string;
  lastmod?: string;
  type: 'sale' | 'rent' | 'unknown';
}

interface DomainResult {
  domain: string;
  classification: string;
  totalUrls: number;
  saleUrls: number;
  rentUrls: number;
  unknownUrls: number;
  dateBreakdown: { [date: string]: { sale: number; rent: number; unknown: number } };
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeoBot/1.0)', 'Accept': 'application/xml,text/xml,*/*' },
      signal: controller.signal
    });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

function classifyUrl(url: string, domainType: string, domainSalePattern?: string, domainRentPattern?: string): 'sale' | 'rent' | 'unknown' {
  const lowerUrl = url.toLowerCase();
  
  // Check domain-specific patterns first
  if (domainSalePattern) {
    try {
      const patterns = JSON.parse(domainSalePattern);
      for (const p of patterns) {
        if (lowerUrl.includes(p.pattern.toLowerCase())) return 'sale';
      }
    } catch {}
  }
  
  if (domainRentPattern) {
    try {
      const patterns = JSON.parse(domainRentPattern);
      for (const p of patterns) {
        if (lowerUrl.includes(p.pattern.toLowerCase())) return 'rent';
      }
    } catch {}
  }
  
  // Check generic patterns
  const isSale = SALE_PATTERNS.some(p => lowerUrl.includes(p));
  const isRent = RENT_PATTERNS.some(p => lowerUrl.includes(p));
  
  if (isSale && !isRent) return 'sale';
  if (isRent && !isSale) return 'rent';
  
  // For domains classified as sale-only or rent-only, assume all URLs match
  if (domainType === 'sale') return 'sale';
  if (domainType === 'rent') return 'rent';
  
  return 'unknown';
}

async function fetchSitemapData(sitemapUrl: string, domainType: string, salePattern?: string, rentPattern?: string, depth = 0): Promise<UrlData[]> {
  if (depth > 1) return [];  // Faster: only 1 level deep
  
  try {
    const res = await fetchWithTimeout(sitemapUrl);
    if (!res.ok) return [];
    
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const urls: UrlData[] = [];

    // Handle sitemap index
    const sitemaps = $('sitemap');
    if (sitemaps.length > 0) {
      const childUrls: string[] = [];
      sitemaps.each((_, el) => {
        const loc = $(el).find('loc').text().trim();
        if (loc) childUrls.push(loc);
      });
      
      for (const childUrl of childUrls.slice(0, 2)) {  // Faster: only 2 child sitemaps
        const childData = await fetchSitemapData(childUrl, domainType, salePattern, rentPattern, depth + 1);
        urls.push(...childData);
      }
      return urls;
    }

    // Extract URLs with lastmod
    $('url').each((_, el) => {
      const loc = $(el).find('loc').text().trim();
      const lastmod = $(el).find('lastmod').text().trim();
      
      if (loc) {
        const dateOnly = lastmod ? lastmod.substring(0, 10) : undefined;
        const type = classifyUrl(loc, domainType, salePattern, rentPattern);
        urls.push({ url: loc, lastmod: dateOnly, type });
      }
    });

    return urls;
  } catch (e) {
    return [];
  }
}

async function main() {
  const startTime = Date.now();
  
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  📊 Full Listing Census - Sale vs Rent                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Load classified domains
  const allDomains: DomainData[] = parse(fs.readFileSync(CLASSIFIED_CSV, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true
  });

  // Filter to classified domains only (exclude unknown and not_listings)
  const classified = allDomains.filter(d => 
    d.sitemap_url && 
    ['sale', 'rent', 'both'].includes(d.listing_types)
  );

  console.log(`📋 Classified domains: ${classified.length}`);
  console.log(`   🏠 Sale: ${classified.filter(d => d.listing_types === 'sale').length}`);
  console.log(`   🔑 Rent: ${classified.filter(d => d.listing_types === 'rent').length}`);
  console.log(`   🏠🔑 Both: ${classified.filter(d => d.listing_types === 'both').length}`);
  console.log('');

  // Process all domains
  let processed = 0;
  let totalSale = 0;
  let totalRent = 0;
  let totalUnknown = 0;
  
  const dailySale: { [date: string]: number } = {};
  const dailyRent: { [date: string]: number } = {};
  const dailyUnknown: { [date: string]: number } = {};
  const domainResults: DomainResult[] = [];

  async function processBatch(batch: DomainData[]) {
    const promises = batch.map(async (domain) => {
      const urls = await fetchSitemapData(
        domain.sitemap_url, 
        domain.listing_types,
        domain.sale_patterns,
        domain.rent_patterns
      );
      
      const result: DomainResult = {
        domain: domain.domain,
        classification: domain.listing_types,
        totalUrls: urls.length,
        saleUrls: 0,
        rentUrls: 0,
        unknownUrls: 0,
        dateBreakdown: {}
      };

      for (const u of urls) {
        if (u.type === 'sale') {
          result.saleUrls++;
          totalSale++;
          if (u.lastmod) {
            dailySale[u.lastmod] = (dailySale[u.lastmod] || 0) + 1;
          }
        } else if (u.type === 'rent') {
          result.rentUrls++;
          totalRent++;
          if (u.lastmod) {
            dailyRent[u.lastmod] = (dailyRent[u.lastmod] || 0) + 1;
          }
        } else {
          result.unknownUrls++;
          totalUnknown++;
          if (u.lastmod) {
            dailyUnknown[u.lastmod] = (dailyUnknown[u.lastmod] || 0) + 1;
          }
        }
      }

      domainResults.push(result);
      processed++;
      
      if (processed % 50 === 0) {
        console.log(`   ✓ ${processed}/${classified.length} | Sale: ${totalSale.toLocaleString()} | Rent: ${totalRent.toLocaleString()}`);
      }
    });
    await Promise.all(promises);
  }

  console.log('📥 Fetching all sitemaps...');
  console.log('');
  
  for (let i = 0; i < classified.length; i += CONCURRENCY) {
    const batch = classified.slice(i, i + CONCURRENCY);
    await processBatch(batch);
  }

  // Generate 30-day breakdown
  const today = new Date();
  const last30Days: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    last30Days.push(d.toISOString().substring(0, 10));
  }

  // Save results
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify({
    fetchedAt: new Date().toISOString(),
    summary: {
      totalDomains: classified.length,
      totalListings: totalSale + totalRent + totalUnknown,
      saleLive: totalSale,
      rentLive: totalRent,
      unknownLive: totalUnknown
    },
    daily: last30Days.map(date => ({
      date,
      sale: dailySale[date] || 0,
      rent: dailyRent[date] || 0,
      unknown: dailyUnknown[date] || 0
    })),
    topDomainsBySale: domainResults
      .filter(d => d.saleUrls > 0)
      .sort((a, b) => b.saleUrls - a.saleUrls)
      .slice(0, 20),
    topDomainsByRent: domainResults
      .filter(d => d.rentUrls > 0)
      .sort((a, b) => b.rentUrls - a.rentUrls)
      .slice(0, 20)
  }, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  // Print results
  console.log('');
  console.log('═'.repeat(70));
  console.log('');
  console.log('📊 LIVE LISTINGS RIGHT NOW');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`   🏠 FOR SALE:    ${totalSale.toLocaleString().padStart(10)}`);
  console.log(`   🔑 FOR RENT:    ${totalRent.toLocaleString().padStart(10)}`);
  console.log(`   ❓ UNKNOWN:     ${totalUnknown.toLocaleString().padStart(10)}`);
  console.log(`   ─────────────────────────`);
  console.log(`   📦 TOTAL:       ${(totalSale + totalRent + totalUnknown).toLocaleString().padStart(10)}`);
  console.log('');

  console.log('═'.repeat(70));
  console.log('📅 DAILY UPDATES - LAST 30 DAYS (Sale vs Rent)');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`${'Date'.padEnd(12)} ${'Day'.padEnd(10)} ${'🏠 Sale'.padStart(10)} ${'🔑 Rent'.padStart(10)} ${'Total'.padStart(10)}`);
  console.log('─'.repeat(55));

  let totalDailySale = 0;
  let totalDailyRent = 0;

  for (const date of last30Days) {
    const sale = dailySale[date] || 0;
    const rent = dailyRent[date] || 0;
    const total = sale + rent;
    totalDailySale += sale;
    totalDailyRent += rent;
    
    const dayName = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
    console.log(`${date.padEnd(12)} ${dayName.padEnd(10)} ${sale.toLocaleString().padStart(10)} ${rent.toLocaleString().padStart(10)} ${total.toLocaleString().padStart(10)}`);
  }

  console.log('─'.repeat(55));
  console.log(`${'30-DAY TOTAL'.padEnd(22)} ${totalDailySale.toLocaleString().padStart(10)} ${totalDailyRent.toLocaleString().padStart(10)} ${(totalDailySale + totalDailyRent).toLocaleString().padStart(10)}`);
  console.log('');

  console.log(`⏱️  Time: ${elapsed} minutes`);
  console.log(`📁 Full data: ${OUTPUT_JSON}`);
  console.log('');
}

main().catch(e => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});

