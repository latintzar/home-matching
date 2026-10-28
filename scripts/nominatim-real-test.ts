/**
 * Real Nominatim Test - Tests geocoding with actual latest listings
 * Uses the EXACT same logic as the Lambda harvesters
 */

import * as cheerio from 'cheerio';

const NOMINATIM_URL = 'http://3.230.148.50:8080';

interface TestResult {
  domain: string;
  listingId: string;
  url: string;
  address: string;
  lat: number | null;
  lon: number | null;
  success: boolean;
  error?: string;
}

// Same geocoding function as Lambda
async function geocodeAddress(locality: string, region: string, country: string = 'Spain'): Promise<{ lat: number; lon: number } | null> {
  const query = [locality, region, country].filter(Boolean).join(', ');
  
  if (!query || query.length < 3) return null;
  
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: '1',
      countrycodes: 'es,pt,fr,ad',
    });
    
    const response = await fetch(`${NOMINATIM_URL}/search?${params.toString()}`, {
      headers: { 'User-Agent': 'PuedoCasa/1.0 (property search)' },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) return null;
    
    const results = await response.json();
    if (results.length === 0) return null;
    
    return {
      lat: parseFloat(results[0].lat),
      lon: parseFloat(results[0].lon),
    };
  } catch (error) {
    return null;
  }
}

// ============================================================
// LUCAS FOX - Using exact Lambda logic
// ============================================================
async function testLucasFox(count: number = 3): Promise<TestResult[]> {
  console.log(`\n1️⃣ LUCAS FOX - Testing ${count} latest listings...`);
  const results: TestResult[] = [];
  
  try {
    // Fetch sitemap (same as Lambda)
    const sitemapRes = await fetch('https://www.lucasfox.com/sitemap.xml', {
      headers: { 'User-Agent': 'PuedoCasa/1.0 (+https://leo.casa)' }
    });
    const xml = await sitemapRes.text();
    
    // Extract property URLs (same regex as Lambda)
    const propertyUrls: string[] = [];
    const locMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/gi);
    
    for (const match of locMatches) {
      const url = match[1].trim();
      if ((url.includes('/property-for-sale/') || url.includes('/property-to-rent/')) && 
          /\/[a-z]{2,4}\d{4,6}\.html$/.test(url)) {
        propertyUrls.push(url);
      }
    }
    
    console.log(`   Found ${propertyUrls.length} properties in sitemap`);
    
    // Test first N listings
    for (let i = 0; i < Math.min(count, propertyUrls.length); i++) {
      const url = propertyUrls[i];
      console.log(`   [${i+1}/${count}] ${url.split('/').pop()}`);
      
      const pageRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
      });
      const html = await pageRes.text();
      
      // Parse JSON-LD (same as Lambda)
      const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/gi);
      let propertyData: any = null;
      
      for (const match of jsonLdMatches) {
        try {
          const data = JSON.parse(match[1]);
          if (data['@type'] && data['@type'] !== 'BreadcrumbList') {
            propertyData = data;
            break;
          }
        } catch { continue; }
      }
      
      if (!propertyData) {
        results.push({ domain: 'Lucas Fox', listingId: 'unknown', url, address: '', lat: null, lon: null, success: false, error: 'No JSON-LD found' });
        continue;
      }
      
      const locality = propertyData.address?.addressLocality || '';
      const region = propertyData.address?.addressRegion || '';
      const idMatch = url.match(/\/([a-z]{2,4}\d{4,6})\.html$/i);
      const id = idMatch ? idMatch[1].toUpperCase() : 'unknown';
      
      // Geocode (same as Lambda)
      const coords = await geocodeAddress(locality, region, 'Spain');
      
      results.push({
        domain: 'Lucas Fox',
        listingId: id,
        url,
        address: `${locality}, ${region}`,
        lat: coords?.lat || null,
        lon: coords?.lon || null,
        success: !!coords
      });
      
      await new Promise(r => setTimeout(r, 200));
    }
  } catch (error: any) {
    results.push({ domain: 'Lucas Fox', listingId: 'error', url: '', address: '', lat: null, lon: null, success: false, error: error.message });
  }
  
  return results;
}

// ============================================================
// CENTURY21 - Using exact Lambda logic
// ============================================================
async function testCentury21(count: number = 3): Promise<TestResult[]> {
  console.log(`\n2️⃣ CENTURY21 - Testing ${count} latest listings...`);
  const results: TestResult[] = [];
  
  try {
    // Fetch sitemap
    const sitemapRes = await fetch('https://century21.es/ref/sitemap/0.xml');
    const xml = await sitemapRes.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    
    const urls = $('url loc').map((_, el) => $(el).text()).get();
    console.log(`   Found ${urls.length} properties in sitemap`);
    
    // Test first N listings
    for (let i = 0; i < Math.min(count, urls.length); i++) {
      const url = urls[i];
      const listingId = url.split('/').pop() || 'unknown';
      console.log(`   [${i+1}/${count}] ${listingId}`);
      
      const pageRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PuedoCasa/1.0)' }
      });
      const html = await pageRes.text();
      const $page = cheerio.load(html);
      
      // Extract address from HTML (same as Lambda)
      const street = $page('span[itemprop="streetAddress"]').text().trim();
      const locality = $page('span[itemprop="addressLocality"]').text().trim();
      const region = $page('span[itemprop="addressRegion"]').text().trim();
      
      // Also try meta tags
      const metaAddress = $page('meta[property="og:street-address"]').attr('content') || '';
      const metaCity = $page('meta[property="og:locality"]').attr('content') || '';
      
      let address = '';
      let addressForGeocode = { locality: '', region: '' };
      
      if (locality) {
        address = street ? `${street}, ${locality}` : locality;
        addressForGeocode = { locality, region };
      } else if (metaCity) {
        address = metaAddress ? `${metaAddress}, ${metaCity}` : metaCity;
        addressForGeocode = { locality: metaCity, region: '' };
      }
      
      // Geocode
      const coords = await geocodeAddress(addressForGeocode.locality, addressForGeocode.region, 'Spain');
      
      results.push({
        domain: 'Century21',
        listingId,
        url,
        address,
        lat: coords?.lat || null,
        lon: coords?.lon || null,
        success: !!coords
      });
      
      await new Promise(r => setTimeout(r, 200));
    }
  } catch (error: any) {
    results.push({ domain: 'Century21', listingId: 'error', url: '', address: '', lat: null, lon: null, success: false, error: error.message });
  }
  
  return results;
}

// ============================================================
// RE/MAX - Using exact Lambda logic (FIXED)
// URL: /buscador-de-inmuebles/{contract}/{propertyType}/{province}/{city}/{neighborhood}/{id}/
// ============================================================
async function testRemax(count: number = 3): Promise<TestResult[]> {
  console.log(`\n3️⃣ RE/MAX - Testing ${count} latest listings...`);
  const results: TestResult[] = [];
  
  try {
    // Get sitemap index
    const indexRes = await fetch('https://www.remax.es/sitemap-general.xml');
    const indexXml = await indexRes.text();
    const $index = cheerio.load(indexXml, { xmlMode: true });
    
    // Get first fichas sitemap
    const sitemapUrl = $index('sitemap loc').filter((_, el) => 
      cheerio.load(el).text().includes('fichas')
    ).first().text();
    
    const sitemapRes = await fetch(sitemapUrl);
    const sitemapXml = await sitemapRes.text();
    const $ = cheerio.load(sitemapXml, { xmlMode: true });
    
    const urls = $('url loc').map((_, el) => $(el).text()).get();
    console.log(`   Found ${urls.length} properties in sitemap`);
    
    // Test first N listings
    for (let i = 0; i < Math.min(count, urls.length); i++) {
      const url = urls[i];
      
      // FIXED: Correct URL parsing
      // URL: /buscador-de-inmuebles/{contract}/{propertyType}/{province}/{city}/{neighborhood}/{id}/
      const urlPath = new URL(url).pathname;
      const parts = urlPath.split('/').filter(p => p);
      // parts[0] = "buscador-de-inmuebles"
      // parts[1] = contract (alquiler/venta)
      // parts[2] = propertyType (atico/piso/casa)
      // parts[3] = province
      // parts[4] = city  
      // parts[5] = neighborhood (or "todos")
      // parts[6] = id
      
      const province = parts[3]?.replace(/-/g, ' ') || '';
      const city = parts[4]?.replace(/-/g, ' ') || '';
      const neighborhood = parts[5] !== 'todos' ? parts[5]?.replace(/-/g, ' ') : '';
      const listingId = parts[6] || 'unknown';
      
      console.log(`   [${i+1}/${count}] ${listingId} (${city}, ${province})`);
      
      // Build address for geocoding - just city and province
      const address = neighborhood ? `${neighborhood}, ${city}, ${province}` : `${city}, ${province}`;
      
      // Geocode with city, province
      const coords = await geocodeAddress(city, province, 'Spain');
      
      results.push({
        domain: 'RE/MAX',
        listingId,
        url,
        address,
        lat: coords?.lat || null,
        lon: coords?.lon || null,
        success: !!coords
      });
      
      await new Promise(r => setTimeout(r, 200));
    }
  } catch (error: any) {
    results.push({ domain: 'RE/MAX', listingId: 'error', url: '', address: '', lat: null, lon: null, success: false, error: error.message });
  }
  
  return results;
}

// ============================================================
// aPROPERTIES - Using exact Lambda logic (FIXED)
// URL: /{city}/{title} or /en/{city}/{title}
// Need to fetch page to get proper location
// ============================================================
async function testAproperties(count: number = 3): Promise<TestResult[]> {
  console.log(`\n4️⃣ aPROPERTIES - Testing ${count} latest listings...`);
  const results: TestResult[] = [];
  
  try {
    // Fetch sitemap
    const sitemapRes = await fetch('https://www.aproperties.es/sitemap-es.xml');
    const sitemapXml = await sitemapRes.text();
    const $ = cheerio.load(sitemapXml, { xmlMode: true });
    
    // Find property URLs
    const urls = $('url loc').filter((_, el) => {
      const text = $(el).text();
      return text.includes('-en-venta') || text.includes('-for-sale') || 
             text.includes('-en-alquiler') || text.includes('-for-rent');
    }).map((_, el) => $(el).text()).get();
    
    console.log(`   Found ${urls.length} properties in sitemap`);
    
    // Test first N listings
    for (let i = 0; i < Math.min(count, urls.length); i++) {
      const url = urls[i];
      
      // Extract city from URL (first path segment after domain)
      const urlPath = new URL(url).pathname;
      const pathParts = urlPath.split('/').filter(p => p);
      const cityIndex = pathParts[0] === 'en' ? 1 : 0;
      const city = pathParts[cityIndex]?.replace(/-/g, ' ') || '';
      
      console.log(`   [${i+1}/${count}] ${city}`);
      
      // Fetch page to get neighborhood from breadcrumb/meta
      const pageRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
      });
      const html = await pageRes.text();
      const $page = cheerio.load(html);
      
      // Try to extract location from breadcrumb or meta
      const breadcrumb = $page('.breadcrumb a, nav[aria-label="breadcrumb"] a').map((_, el) => $page(el).text().trim()).get();
      const ogTitle = $page('meta[property="og:title"]').attr('content') || '';
      
      // Extract listing ID
      const idMatch = html.match(/property[_-]?id['":\s]+["']?(\d+)/i);
      const listingId = idMatch ? idMatch[1] : 'unknown';
      
      // For geocoding, use city name (capitalized properly)
      const cityCapitalized = city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      
      // Geocode with just the city
      const coords = await geocodeAddress(cityCapitalized, '', 'Spain');
      
      results.push({
        domain: 'aProperties',
        listingId,
        url,
        address: cityCapitalized,
        lat: coords?.lat || null,
        lon: coords?.lon || null,
        success: !!coords
      });
      
      await new Promise(r => setTimeout(r, 200));
    }
  } catch (error: any) {
    results.push({ domain: 'aProperties', listingId: 'error', url: '', address: '', lat: null, lon: null, success: false, error: error.message });
  }
  
  return results;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const testCount = parseInt(process.argv[2] || '3', 10);
  
  console.log('============================================================');
  console.log('NOMINATIM REAL LISTING TEST');
  console.log(`Testing ${testCount} latest listings from each domain`);
  console.log(`Nominatim: ${NOMINATIM_URL}`);
  console.log('============================================================');
  
  // Check Nominatim
  try {
    const statusRes = await fetch(`${NOMINATIM_URL}/status`);
    console.log(`\n✅ Nominatim status: ${(await statusRes.text()).trim()}`);
  } catch {
    console.log('\n❌ Nominatim is not reachable!');
    process.exit(1);
  }
  
  // Run all tests
  const allResults: TestResult[] = [];
  
  allResults.push(...await testLucasFox(testCount));
  allResults.push(...await testCentury21(testCount));
  allResults.push(...await testRemax(testCount));
  allResults.push(...await testAproperties(testCount));
  
  // Summary
  console.log('\n============================================================');
  console.log('RESULTS SUMMARY');
  console.log('============================================================');
  
  const byDomain = new Map<string, { passed: number; failed: number; results: TestResult[] }>();
  
  for (const r of allResults) {
    if (!byDomain.has(r.domain)) {
      byDomain.set(r.domain, { passed: 0, failed: 0, results: [] });
    }
    const d = byDomain.get(r.domain)!;
    if (r.success) d.passed++; else d.failed++;
    d.results.push(r);
  }
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  for (const [domain, data] of byDomain) {
    console.log(`\n${domain}: ${data.passed}/${data.passed + data.failed} geocoded`);
    for (const r of data.results) {
      if (r.success) {
        console.log(`   ✅ ${r.listingId}: ${r.address} → ${r.lat?.toFixed(4)}, ${r.lon?.toFixed(4)}`);
      } else {
        console.log(`   ❌ ${r.listingId}: ${r.address} → ${r.error || 'No coordinates'}`);
      }
    }
    totalPassed += data.passed;
    totalFailed += data.failed;
  }
  
  console.log('\n============================================================');
  console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed`);
  console.log('============================================================');
  
  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
