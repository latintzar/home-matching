/**
 * 📅 Fetch lastmod dates from ALL sitemaps
 * 
 * Processes all 1,029 domains with sitemaps and extracts lastmod dates
 * to show day-by-day listing update activity.
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import * as cheerio from 'cheerio';

const INPUT_CSV = 'data/MASTER_AGENCY_LIST.csv';
const OUTPUT_JSON = 'data/all_lastmod_dates.json';
const CONCURRENCY = 30;
const TIMEOUT_MS = 12000;

interface DateCount {
  [date: string]: number;
}

interface DomainInput {
  domain: string;
  sitemap_url: string;
  sitemap_found: string;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; LeoBot/1.0)',
        'Accept': 'application/xml,text/xml,*/*'
      },
      signal: controller.signal
    });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

async function extractDatesFromSitemap(sitemapUrl: string, depth = 0): Promise<string[]> {
  if (depth > 2) return [];
  
  try {
    const res = await fetchWithTimeout(sitemapUrl);
    if (!res.ok) return [];
    
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const dates: string[] = [];

    // Handle sitemap index
    const sitemaps = $('sitemap');
    if (sitemaps.length > 0) {
      const childUrls: string[] = [];
      sitemaps.each((_, el) => {
        const loc = $(el).find('loc').text().trim();
        if (loc) childUrls.push(loc);
      });
      
      // Fetch first 3 child sitemaps
      for (const childUrl of childUrls.slice(0, 3)) {
        const childDates = await extractDatesFromSitemap(childUrl, depth + 1);
        dates.push(...childDates);
      }
      return dates;
    }

    // Extract lastmod dates from urlset
    $('url').each((_, el) => {
      const lastmod = $(el).find('lastmod').text().trim();
      if (lastmod) {
        // Extract just the date part (YYYY-MM-DD)
        const dateOnly = lastmod.substring(0, 10);
        if (dateOnly.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dates.push(dateOnly);
        }
      }
    });

    return dates;
  } catch (e) {
    return [];
  }
}

async function main() {
  const startTime = Date.now();
  
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  📅 Fetching lastmod dates from ALL sitemaps                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Read all domains with sitemaps
  const allRecords: DomainInput[] = parse(fs.readFileSync(INPUT_CSV, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true
  });

  const domains = allRecords.filter(r => r.sitemap_found === 'YES' && r.sitemap_url);
  console.log(`📋 Domains with sitemaps: ${domains.length}`);
  console.log(`⚙️  Concurrency: ${CONCURRENCY}`);
  console.log('');

  const allDates: DateCount = {};
  const domainCounts: { [domain: string]: number } = {};
  let processed = 0;
  let withDates = 0;

  async function processBatch(batch: DomainInput[]) {
    const promises = batch.map(async (record) => {
      const dates = await extractDatesFromSitemap(record.sitemap_url);
      
      if (dates.length > 0) {
        withDates++;
        domainCounts[record.domain] = dates.length;
        for (const date of dates) {
          allDates[date] = (allDates[date] || 0) + 1;
        }
      }
      
      processed++;
      if (processed % 100 === 0) {
        console.log(`   ✓ Processed ${processed}/${domains.length} (${withDates} have dates)`);
      }
    });
    await Promise.all(promises);
  }

  console.log('📥 Fetching sitemaps...');
  for (let i = 0; i < domains.length; i += CONCURRENCY) {
    const batch = domains.slice(i, i + CONCURRENCY);
    await processBatch(batch);
  }

  // Save raw data
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify({
    fetchedAt: new Date().toISOString(),
    totalDomains: domains.length,
    domainsWithDates: withDates,
    dateCountsByDate: allDates,
    topDomainsByVolume: Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([domain, count]) => ({ domain, count }))
  }, null, 2));

  // Calculate last 7 days
  const today = new Date();
  const last7Days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    last7Days.push(d.toISOString().substring(0, 10));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('');
  console.log('═'.repeat(60));
  console.log('');
  console.log('📊 LISTING PAGE UPDATES - LAST 7 DAYS');
  console.log('   (from ALL sitemaps with lastmod data)');
  console.log('');
  console.log('Date            Day              Updates');
  console.log('─'.repeat(45));

  let total7 = 0;
  for (const dateStr of last7Days) {
    const count = allDates[dateStr] || 0;
    total7 += count;
    const dayName = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    const bar = '█'.repeat(Math.min(Math.floor(count / 500), 40));
    console.log(`${dateStr}      ${dayName.padEnd(12)} ${count.toString().padStart(8)}  ${bar}`);
  }

  console.log('─'.repeat(45));
  console.log(`${'7-DAY TOTAL'.padEnd(30)} ${total7.toString().padStart(8)}`);
  console.log('');

  // Top domains
  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log('🏆 Top 10 Most Active Domains:');
  for (const [domain, count] of topDomains) {
    console.log(`   ${domain.padEnd(35)} ${count.toLocaleString().padStart(8)} URLs`);
  }

  console.log('');
  console.log(`⏱️  Time: ${elapsed}s`);
  console.log(`📁 Raw data saved to: ${OUTPUT_JSON}`);
  console.log('');
}

main().catch(e => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});

