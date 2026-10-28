/**
 * Test: Get N LATEST listings from each premium domain
 * FIXED VERSION - Uses correct approaches for each domain
 */

import * as cheerio from 'cheerio';
import * as zlib from 'zlib';

interface LatestResult {
  domain: string;
  requested: number;
  fetched: number;
  sitemapTotal: number;
  listings: { id: string; url: string }[];
  success: boolean;
  error?: string;
}

// ============================================================
// 1. ENGEL & VÖLKERS - Uses /es/en/properties/ URL with __NEXT_DATA__
// ============================================================
async function getLatestEV(count: number): Promise<LatestResult> {
  const result: LatestResult = { domain: 'Engel & Völkers', requested: count, fetched: 0, sitemapTotal: 0, listings: [], success: false };
  
  try {
    const url = 'https://www.engelvoelkers.com/es/en/properties/res/sale/apartment';
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await res.text();
    
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
    if (!match) throw new Error('No __NEXT_DATA__');
    
    const data = JSON.parse(match[1]);
    const listings = data?.props?.pageProps?.searchModule?.initialSearchResults?.listings || [];
    result.sitemapTotal = data?.props?.pageProps?.searchModule?.initialSearchResults?.total || listings.length;
    
    for (const item of listings.slice(0, count)) {
      const l = item.listing;
      if (l?.displayId) {
        result.listings.push({
          id: l.displayId,
          url: `https://www.engelvoelkers.com/es/exposes/${l.id}`
        });
      }
    }
    
    result.fetched = result.listings.length;
    result.success = result.fetched >= Math.min(count, 35); // E&V returns max 35 per page
  } catch (e: any) {
    result.error = e.message;
  }
  
  return result;
}

// ============================================================
// 2. LUCAS FOX - Uses sitemap.xml
// ============================================================
async function getLatestLF(count: number): Promise<LatestResult> {
  const result: LatestResult = { domain: 'Lucas Fox', requested: count, fetched: 0, sitemapTotal: 0, listings: [], success: false };
  
  try {
    const res = await fetch('https://www.lucasfox.com/sitemap.xml', { headers: { 'User-Agent': 'PuedoCasa/1.0' } });
    const xml = await res.text();
    
    const urls: string[] = [];
    const matches = xml.matchAll(/<loc>([^<]+)<\/loc>/gi);
    for (const match of matches) {
      const url = match[1].trim();
      if ((url.includes('/property-for-sale/') || url.includes('/property-to-rent/')) && 
          /\/[a-z]{2,4}\d{4,6}\.html$/.test(url)) {
        urls.push(url);
      }
    }
    
    result.sitemapTotal = urls.length;
    
    for (const url of urls.slice(0, count)) {
      const idMatch = url.match(/\/([a-z]{2,4}\d{4,6})\.html$/i);
      result.listings.push({
        id: idMatch ? idMatch[1].toUpperCase() : 'unknown',
        url
      });
    }
    
    result.fetched = result.listings.length;
    result.success = result.fetched >= count;
  } catch (e: any) {
    result.error = e.message;
  }
  
  return result;
}

// ============================================================
// 3. DONPISO - Crawl list pages, extract data-code attributes
// ============================================================
async function getLatestDP(count: number): Promise<LatestResult> {
  const result: LatestResult = { domain: 'donpiso', requested: count, fetched: 0, sitemapTotal: 0, listings: [], success: false };
  
  try {
    // Fetch a major city's list page
    const res = await fetch('https://www.donpiso.com/venta-casas-y-pisos/barcelona-barcelona/listado', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    
    // Extract data-code attributes (listing IDs)
    const ids = new Set<string>();
    const matches = html.matchAll(/data-code="(\d+)"/g);
    for (const match of matches) {
      ids.add(match[1]);
    }
    
    result.sitemapTotal = ids.size;
    
    // Get URLs from page
    const $ = cheerio.load(html);
    $('a[href*="pisos-y-casas"]').each((_, el) => {
      if (result.listings.length >= count) return;
      const href = $(el).attr('href') || '';
      const idMatch = href.match(/\/(\d{5,})_/);
      if (idMatch && !result.listings.find(l => l.id === idMatch[1])) {
        result.listings.push({
          id: idMatch[1],
          url: href.startsWith('http') ? href : `https://www.donpiso.com${href}`
        });
      }
    });
    
    // If we didn't find URLs, construct from IDs
    if (result.listings.length === 0) {
      for (const id of Array.from(ids).slice(0, count)) {
        result.listings.push({
          id,
          url: `https://www.donpiso.com/pisos-y-casas/${id}`
        });
      }
    }
    
    result.fetched = result.listings.length;
    result.success = result.fetched >= Math.min(count, ids.size);
  } catch (e: any) {
    result.error = e.message;
  }
  
  return result;
}

// ============================================================
// 4. TECNOCASA - Uses gzipped sitemap
// ============================================================
async function getLatestTC(count: number): Promise<LatestResult> {
  const result: LatestResult = { domain: 'Tecnocasa', requested: count, fetched: 0, sitemapTotal: 0, listings: [], success: false };
  
  try {
    // Fetch gzipped sitemap
    const res = await fetch('https://www.tecnocasa.es/sitemap/inmuebles-0.xml.gz', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const buffer = await res.arrayBuffer();
    const xml = zlib.gunzipSync(Buffer.from(buffer)).toString('utf-8');
    
    const $ = cheerio.load(xml, { xmlMode: true });
    const urls = $('url loc').map((_, el) => $(el).text()).get();
    
    result.sitemapTotal = urls.length;
    
    for (const url of urls.slice(0, count)) {
      const idMatch = url.match(/\/(\d+)\.html$/);
      result.listings.push({
        id: idMatch ? idMatch[1] : 'unknown',
        url
      });
    }
    
    result.fetched = result.listings.length;
    result.success = result.fetched >= count;
  } catch (e: any) {
    result.error = e.message;
  }
  
  return result;
}

// ============================================================
// 5. CENTURY21 - Uses sitemap
// ============================================================
async function getLatestC21(count: number): Promise<LatestResult> {
  const result: LatestResult = { domain: 'Century21', requested: count, fetched: 0, sitemapTotal: 0, listings: [], success: false };
  
  try {
    const res = await fetch('https://century21.es/ref/sitemap/0.xml', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    
    const urls = $('url loc').map((_, el) => $(el).text()).get();
    result.sitemapTotal = urls.length;
    
    for (const url of urls.slice(0, count)) {
      const id = url.split('/').pop() || 'unknown';
      result.listings.push({ id, url });
    }
    
    result.fetched = result.listings.length;
    result.success = result.fetched >= count;
  } catch (e: any) {
    result.error = e.message;
  }
  
  return result;
}

// ============================================================
// 6. RE/MAX - Uses sitemap index
// ============================================================
async function getLatestRemax(count: number): Promise<LatestResult> {
  const result: LatestResult = { domain: 'RE/MAX', requested: count, fetched: 0, sitemapTotal: 0, listings: [], success: false };
  
  try {
    const indexRes = await fetch('https://www.remax.es/sitemap-general.xml', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const indexXml = await indexRes.text();
    const $index = cheerio.load(indexXml, { xmlMode: true });
    
    const sitemapUrls = $index('sitemap loc').filter((_, el) => 
      cheerio.load(el).text().includes('fichas')
    ).map((_, el) => $index(el).text()).get();
    
    for (const sitemapUrl of sitemapUrls) {
      if (result.listings.length >= count) break;
      
      const res = await fetch(sitemapUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const xml = await res.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      
      $('url loc').each((_, el) => {
        if (result.listings.length >= count) return;
        const url = $(el).text();
        const parts = url.split('/').filter(p => p);
        const id = parts[parts.length - 1] || 'unknown';
        result.listings.push({ id, url });
        result.sitemapTotal++;
      });
    }
    
    result.fetched = result.listings.length;
    result.success = result.fetched >= count;
  } catch (e: any) {
    result.error = e.message;
  }
  
  return result;
}

// ============================================================
// 7. aPROPERTIES - Uses sitemap
// ============================================================
async function getLatestAproperties(count: number): Promise<LatestResult> {
  const result: LatestResult = { domain: 'aProperties', requested: count, fetched: 0, sitemapTotal: 0, listings: [], success: false };
  
  try {
    const res = await fetch('https://www.aproperties.es/sitemap-es.xml', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    
    const urls = $('url loc').filter((_, el) => {
      const text = $(el).text();
      return text.includes('-en-venta') || text.includes('-for-sale') || 
             text.includes('-en-alquiler') || text.includes('-for-rent');
    }).map((_, el) => $(el).text()).get();
    
    result.sitemapTotal = urls.length;
    
    for (const url of urls.slice(0, count)) {
      const parts = url.split('/').filter(p => p);
      const id = parts[parts.length - 1] || 'unknown';
      result.listings.push({ id, url });
    }
    
    result.fetched = result.listings.length;
    result.success = result.fetched >= count;
  } catch (e: any) {
    result.error = e.message;
  }
  
  return result;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const count = parseInt(process.argv[2] || '10', 10);
  
  console.log('============================================================');
  console.log(`TESTING: Get ${count} LATEST listings from each premium domain`);
  console.log('============================================================\n');
  
  const results: LatestResult[] = [];
  
  console.log('1️⃣ Engel & Völkers...');
  results.push(await getLatestEV(count));
  
  console.log('2️⃣ Lucas Fox...');
  results.push(await getLatestLF(count));
  
  console.log('3️⃣ donpiso...');
  results.push(await getLatestDP(count));
  
  console.log('4️⃣ Tecnocasa...');
  results.push(await getLatestTC(count));
  
  console.log('5️⃣ Century21...');
  results.push(await getLatestC21(count));
  
  console.log('6️⃣ RE/MAX...');
  results.push(await getLatestRemax(count));
  
  console.log('7️⃣ aProperties...');
  results.push(await getLatestAproperties(count));
  
  // Summary
  console.log('\n============================================================');
  console.log('RESULTS');
  console.log('============================================================\n');
  
  let allPassed = true;
  
  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    console.log(`${status} ${r.domain}: ${r.fetched}/${r.requested} (total available: ${r.sitemapTotal})`);
    if (r.error) console.log(`   Error: ${r.error}`);
    if (r.listings.length > 0) {
      console.log(`   Sample: ${r.listings[0].id}`);
      console.log(`   URL: ${r.listings[0].url.substring(0, 70)}...`);
    }
    if (!r.success) allPassed = false;
  }
  
  console.log('\n============================================================');
  console.log(allPassed ? '✅ ALL DOMAINS PASSED' : '❌ SOME DOMAINS FAILED');
  console.log('============================================================');
  
  process.exit(allPassed ? 0 : 1);
}

main().catch(console.error);
