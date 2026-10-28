/**
 * RE/MAX Spain Harvest Test Script
 * 
 * Local testing for RE/MAX harvest before Lambda deployment.
 * Tests:
 * 1. Sitemap discovery and URL extraction
 * 2. HTML parsing from local file
 * 3. Live page fetching and parsing
 * 4. URL path location extraction
 * 
 * Usage:
 *   cd /Users/peterneyra/puedo_casa
 *   npx tsx scripts/remax-harvest-test.ts
 */

import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const LOCAL_HTML_FILE = '/Users/peterneyra/puedo_casa/Random Files I Want To Give Cursor/Piso en venta, Barcelona – REMAX España, la red inmobiliaria número 1 del mundo.html';
const SITEMAP_INDEX_URL = 'https://www.remax.es/sitemap-general.xml';

// Rate limiting
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Extract location info from URL path
function parseUrlLocation(url: string): { 
  contract_type: string; 
  property_type: string | null; 
  province: string | null;
  city: string | null; 
  neighborhood: string | null;
  id: string | null;
} {
  // URL pattern: /buscador-de-inmuebles/{type}/{property-type}/{province}/{city}/{neighborhood}/{ID}/
  const match = url.match(/\/buscador-de-inmuebles\/([^\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
  
  if (!match) {
    const idMatch = url.match(/\/([A-Z0-9-]+)\/?$/);
    return {
      contract_type: url.includes('/alquiler/') ? 'rent' : 'sale',
      property_type: null,
      province: null,
      city: null,
      neighborhood: null,
      id: idMatch ? idMatch[1] : null
    };
  }
  
  const [, type, propertyType, province, city, neighborhood, id] = match;
  
  const contract_type = type === 'alquiler' ? 'rent' : 'sale';
  
  const propertyTypeMap: Record<string, string> = {
    'piso': 'apartment',
    'apartamento': 'apartment',
    'casa': 'house',
    'chalet': 'house',
    'villa': 'house',
    'atico': 'penthouse',
    'duplex': 'duplex',
    'estudio': 'studio',
    'local-comercial': 'commercial',
    'oficina': 'office',
    'terreno': 'land',
    'solar': 'land',
    'garaje': 'parking',
    'parking': 'parking',
    'nave-industrial': 'industrial',
    'finca-rustica': 'rural',
    'casa-rural': 'rural'
  };
  
  const cleanLocation = (s: string) => 
    s.replace(/-/g, ' ')
     .replace(/\b\w/g, c => c.toUpperCase());
  
  return {
    contract_type,
    property_type: propertyTypeMap[propertyType.toLowerCase()] || propertyType,
    province: cleanLocation(province),
    city: cleanLocation(city),
    neighborhood: neighborhood !== 'todos' ? cleanLocation(neighborhood) : null,
    id
  };
}

// Sanitize JSON string by removing control characters
function sanitizeJsonString(str: string): string {
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

// Parse HTML and extract listing data
function parseHtml(html: string, url: string) {
  const $ = cheerio.load(html);
  
  const urlInfo = parseUrlLocation(url);
  
  // Extract title
  const titleTag = $('title').text();
  const title = titleTag.split('–')[0].trim();
  
  // Extract price and description from JSON-LD (with sanitization)
  let price: number | null = null;
  let priceRaw = '';
  let description = '';
  
  try {
    const jsonLdRaw = $('script[type="application/ld+json"]').first().html();
    if (jsonLdRaw) {
      const jsonLd = sanitizeJsonString(jsonLdRaw);
      const data = JSON.parse(jsonLd);
      if (data.offers?.price) {
        price = parseInt(data.offers.price, 10);
        priceRaw = `${price} €`;
      }
      if (data.description) {
        description = data.description.substring(0, 500);
      }
      console.log('\n📦 JSON-LD Data (sanitized):');
      console.log(JSON.stringify(data, null, 2).substring(0, 1000));
    }
  } catch (e) {
    console.log('JSON-LD parsing failed:', e);
  }
  
  // Fallback: try to get price from HTML
  if (!price) {
    const priceElem = $('.tarjeta_precio').first();
    if (priceElem.length) {
      priceRaw = priceElem.text().trim();
      const priceNum = priceRaw.replace(/[^\d]/g, '');
      price = priceNum ? parseInt(priceNum, 10) : null;
      console.log(`\n💰 Price from HTML: ${priceRaw}`);
    }
    
    if (!price) {
      const priceMatch = html.match(/Precio:\s*([\d.]+)\s*€/i);
      if (priceMatch) {
        priceRaw = priceMatch[1] + ' €';
        price = parseInt(priceMatch[1].replace(/\./g, ''), 10);
        console.log(`\n💰 Price from regex: ${priceRaw}`);
      }
    }
  }
  
  // Fallback description
  if (!description) {
    description = $('meta[name="description"]').attr('content') || '';
  }
  
  // Extract specs from HTML
  let bedrooms: number | null = null;
  let bathrooms: number | null = null;
  let area_m2: number | null = null;
  
  const habMatch = html.match(/(\d+)\s*hab/i);
  const banoMatch = html.match(/(\d+)\s*baño/i);
  const m2Match = html.match(/(\d+)\s*m[²2]/i);
  
  if (habMatch) bedrooms = parseInt(habMatch[1], 10);
  if (banoMatch) bathrooms = parseInt(banoMatch[1], 10);
  if (m2Match) area_m2 = parseInt(m2Match[1], 10);
  
  // Extract photos
  const photoRegex = /https:\/\/anaconda-guru\.s3[^"'\s]+\.jpg/g;
  const photos = [...new Set(html.match(photoRegex) || [])];
  
  // Build address
  const addressParts = [
    urlInfo.neighborhood,
    urlInfo.city,
    urlInfo.province
  ].filter(Boolean);
  const address = addressParts.join(', ');
  
  return {
    id: urlInfo.id,
    title,
    price,
    price_raw: priceRaw,
    bedrooms,
    bathrooms,
    area_m2,
    photos: photos.slice(0, 5),
    total_photos: photos.length,
    description,
    address,
    url_info: urlInfo
  };
}

// Test 1: Local file parsing
async function testLocalFile() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: Local HTML File Parsing');
  console.log('='.repeat(60));
  
  if (!fs.existsSync(LOCAL_HTML_FILE)) {
    console.log('❌ Local file not found:', LOCAL_HTML_FILE);
    return;
  }
  
  const html = fs.readFileSync(LOCAL_HTML_FILE, 'utf-8');
  console.log(`📄 File size: ${(html.length / 1024).toFixed(1)} KB`);
  
  // Try to find a URL in the HTML
  const canonicalMatch = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/);
  const ogUrlMatch = html.match(/<meta[^>]*property="og:url"[^>]*content="([^"]+)"/);
  const url = canonicalMatch?.[1] || ogUrlMatch?.[1] || 'https://www.remax.es/buscador-de-inmuebles/venta/piso/barcelona/barcelona/sant-gervasi-galvany/PR-00407/';
  
  console.log(`🔗 URL: ${url}`);
  
  const result = parseHtml(html, url);
  
  console.log('\n📋 Parsed Data:');
  console.log(JSON.stringify(result, null, 2));
  
  return result;
}

// Test 2: Sitemap discovery
async function testSitemapDiscovery() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Sitemap Discovery');
  console.log('='.repeat(60));
  
  try {
    console.log(`\nFetching sitemap index: ${SITEMAP_INDEX_URL}`);
    
    const response = await fetch(SITEMAP_INDEX_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PuedoCasa/1.0)' }
    });
    
    if (!response.ok) {
      console.log(`❌ Failed to fetch sitemap index: ${response.status}`);
      return;
    }
    
    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    
    const sitemaps: string[] = [];
    $('sitemap loc').each((_, el) => {
      const url = $(el).text();
      if (url.includes('sitemap-fichas')) {
        sitemaps.push(url);
      }
    });
    
    console.log(`\n✅ Found ${sitemaps.length} listing sitemaps`);
    console.log('\nSample sitemaps:');
    sitemaps.slice(0, 10).forEach(url => {
      const name = url.split('/').pop();
      console.log(`  - ${name}`);
    });
    
    // Fetch first sitemap to count listings
    if (sitemaps.length > 0) {
      console.log(`\nFetching first sitemap: ${sitemaps[0]}`);
      
      const sitemapResponse = await fetch(sitemaps[0], {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PuedoCasa/1.0)' }
      });
      
      if (sitemapResponse.ok) {
        const sitemapXml = await sitemapResponse.text();
        const $sitemap = cheerio.load(sitemapXml, { xmlMode: true });
        
        let count = 0;
        const sampleUrls: Array<{ url: string; lastmod: string | null }> = [];
        
        $sitemap('url').each((_, el) => {
          const loc = $sitemap(el).find('loc').text();
          const lastmod = $sitemap(el).find('lastmod').text() || null;
          
          if (loc.includes('/buscador-de-inmuebles/')) {
            count++;
            if (sampleUrls.length < 5) {
              sampleUrls.push({ url: loc, lastmod });
            }
          }
        });
        
        console.log(`\n✅ ${count} listings in first sitemap`);
        console.log('\nSample listing URLs:');
        sampleUrls.forEach(({ url, lastmod }) => {
          console.log(`  - ${url}`);
          console.log(`    lastmod: ${lastmod}`);
        });
        
        return sampleUrls;
      }
    }
    
    return [];
  } catch (error) {
    console.log('❌ Error:', error);
    return [];
  }
}

// Test 3: Live page fetch
async function testLiveFetch(url?: string) {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: Live Page Fetch');
  console.log('='.repeat(60));
  
  // Use a known URL or fetch from sitemap
  const testUrl = url || 'https://www.remax.es/buscador-de-inmuebles/venta/piso/barcelona/barcelona/sant-gervasi-galvany/PR-00407/';
  
  console.log(`\nFetching: ${testUrl}`);
  
  try {
    const response = await fetch(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      }
    });
    
    if (!response.ok) {
      console.log(`❌ Failed to fetch: ${response.status}`);
      return;
    }
    
    const html = await response.text();
    console.log(`✅ Fetched ${(html.length / 1024).toFixed(1)} KB`);
    
    const result = parseHtml(html, testUrl);
    
    console.log('\n📋 Parsed Data:');
    console.log(JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.log('❌ Error:', error);
  }
}

// Test 4: URL location parsing
async function testUrlParsing() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: URL Location Parsing');
  console.log('='.repeat(60));
  
  const testUrls = [
    'https://www.remax.es/buscador-de-inmuebles/venta/piso/barcelona/barcelona/sant-gervasi-galvany/PR-00407/',
    'https://www.remax.es/buscador-de-inmuebles/alquiler/casa/madrid/madrid/salamanca/RE-12345/',
    'https://www.remax.es/buscador-de-inmuebles/venta/chalet/malaga/marbella/nueva-andalucia/CH-99999/',
    'https://www.remax.es/buscador-de-inmuebles/venta/local-comercial/valencia/valencia/ciutat-vella/LO-55555/'
  ];
  
  testUrls.forEach(url => {
    console.log(`\n🔗 ${url}`);
    const result = parseUrlLocation(url);
    console.log(JSON.stringify(result, null, 2));
  });
}

// Main test runner
async function main() {
  console.log('🏠 RE/MAX Spain Harvest Test');
  console.log('Date:', new Date().toISOString());
  
  // Run tests
  await testLocalFile();
  await sleep(500);
  
  await testUrlParsing();
  await sleep(500);
  
  const sitemapUrls = await testSitemapDiscovery();
  await sleep(500);
  
  // Test live fetch with first URL from sitemap if available
  if (sitemapUrls && sitemapUrls.length > 0) {
    await testLiveFetch(sitemapUrls[0].url);
  } else {
    await testLiveFetch();
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed');
  console.log('='.repeat(60));
}

main().catch(console.error);

