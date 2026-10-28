/**
 * aProperties Spain Harvest Test Script
 * 
 * Local testing for aProperties harvest before Lambda deployment.
 * Tests:
 * 1. Sitemap discovery and URL extraction
 * 2. HTML parsing from local file
 * 3. Live page fetching and parsing
 * 4. URL location extraction
 * 
 * Usage:
 *   cd /Users/peterneyra/puedo_casa
 *   npx tsx scripts/aproperties-harvest-test.ts
 */

import * as cheerio from 'cheerio';
import * as fs from 'fs';

const LOCAL_HTML_FILE = '/Users/peterneyra/puedo_casa/Random Files I Want To Give Cursor/113 sqm flat for sale in Eixample Esquerra, Barcelona _ aProperties.html';
const SITEMAP_URL = 'https://www.aproperties.es/sitemap-es.xml';

// Rate limiting
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Listing URL patterns
const LISTING_PATTERNS = [
  /piso-de-\d+/,
  /casa-de-\d+/,
  /villa-de-\d+/,
  /apartamento-de-\d+/,
  /chalet-de-\d+/,
  /atico-de-\d+/,
  /estudio-de-\d+/,
  /sqm-flat-for-sale/,
  /sqm-house-for-sale/,
  /sqm-villa-for-sale/,
  /sqm-flat-for-rent/
];

function isListingUrl(url: string): boolean {
  return LISTING_PATTERNS.some(pattern => pattern.test(url));
}

// Extract location from URL
function parseUrlLocation(url: string): {
  city: string | null;
  neighborhood: string | null;
  contract_type: string;
  property_type: string | null;
} {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    let city: string | null = null;
    let neighborhood: string | null = null;
    const slug = pathParts[pathParts.length - 1] || '';
    
    const langPrefixes = ['en', 'ca', 'fr', 'de'];
    let startIdx = langPrefixes.includes(pathParts[0]) ? 1 : 0;
    
    if (pathParts.length > startIdx + 1) {
      city = pathParts[startIdx]?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || null;
    }
    if (pathParts.length > startIdx + 2) {
      neighborhood = pathParts[startIdx + 1]?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || null;
    }
    
    const contract_type = slug.includes('alquiler') || slug.includes('rent') ? 'rent' : 'sale';
    
    let property_type: string | null = null;
    const typeMap: Record<string, string> = {
      'piso': 'apartment',
      'flat': 'apartment',
      'casa': 'house',
      'house': 'house',
      'villa': 'villa',
      'chalet': 'house',
      'atico': 'penthouse',
      'penthouse': 'penthouse'
    };
    
    for (const [keyword, type] of Object.entries(typeMap)) {
      if (slug.includes(keyword)) {
        property_type = type;
        break;
      }
    }
    
    return { city, neighborhood, contract_type, property_type };
  } catch {
    return { city: null, neighborhood: null, contract_type: 'sale', property_type: null };
  }
}

// Parse HTML
function parseHtml(html: string, url: string) {
  const $ = cheerio.load(html);
  
  // Extract ID from photo URLs
  const photoUrlMatch = html.match(/\/media\/properties\/(\d+)\//);
  const id = photoUrlMatch ? photoUrlMatch[1] : url.split('/').pop()?.replace(/[^a-z0-9]/gi, '-') || 'unknown';
  
  // Extract title
  const titleTag = $('title').text();
  const title = titleTag.split('|')[0].trim();
  
  // Extract price
  let price: number | null = null;
  let priceRaw = '';
  
  const priceElem = $('.propHeader__priceCurrent').first();
  if (priceElem.length) {
    priceRaw = priceElem.text().trim();
    const priceNum = priceRaw.replace(/[^\d]/g, '');
    price = priceNum ? parseInt(priceNum, 10) : null;
    console.log(`\n💰 Price found: ${priceRaw} -> ${price}`);
  }
  
  // Extract specs
  let bedrooms: number | null = null;
  let bathrooms: number | null = null;
  let area_m2: number | null = null;
  
  $('.propHeader__specs__item').each((_, el) => {
    const label = $(el).find('.propHeader__specs__itemLabel').text().toLowerCase().trim();
    const value = $(el).find('.propHeader__specs__itemValue').text().trim();
    console.log(`  Spec: ${label} = ${value}`);
    
    if (label.includes('bedroom') || label.includes('dormitorio') || label.includes('surface') === false) {
      if (label.includes('bedroom') || label.includes('dormitorio')) {
        bedrooms = parseInt(value, 10) || null;
      } else if (label.includes('bathroom') || label.includes('baño')) {
        bathrooms = parseInt(value, 10) || null;
      }
    }
    if (label.includes('surface') || label.includes('superficie') || label.includes('m²')) {
      area_m2 = parseInt(value.replace(/[^\d]/g, ''), 10) || null;
    }
  });
  
  // Extract description
  const description = $('meta[name="description"]').attr('content') || '';
  
  // Extract photos
  const photos: string[] = [];
  $('a[data-fancybox="gallery"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('aproperties.es/media/properties')) {
      photos.push(href);
    }
  });
  
  // Also from regex
  const photoRegex = /https:\/\/www\.aproperties\.es\/media\/properties\/\d+\/[^"'\s]+\.(jpg|png|jpeg)/g;
  const additionalPhotos = [...new Set(html.match(photoRegex) || [])];
  additionalPhotos.forEach(p => {
    if (!photos.includes(p)) photos.push(p);
  });
  
  // Location from URL
  const urlInfo = parseUrlLocation(url);
  
  return {
    id,
    title,
    price,
    price_raw: priceRaw,
    bedrooms,
    bathrooms,
    area_m2,
    photos: photos.slice(0, 5),
    total_photos: photos.length,
    description: description.substring(0, 200),
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
  
  // Get URL from canonical
  const canonicalMatch = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/);
  const url = canonicalMatch?.[1] || 'https://www.aproperties.es/en/barcelona/eixample-esquerra/113-sqm-flat-for-sale-in-eixample-esquerra-barcelona';
  
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
    console.log(`\nFetching sitemap: ${SITEMAP_URL}`);
    
    const response = await fetch(SITEMAP_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PuedoCasa/1.0)' }
    });
    
    if (!response.ok) {
      console.log(`❌ Failed to fetch sitemap: ${response.status}`);
      return [];
    }
    
    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    
    const allUrls: Array<{ url: string; lastmod: string | null }> = [];
    
    $('url').each((_, el) => {
      const loc = $(el).find('loc').text();
      const lastmod = $(el).find('lastmod').text() || null;
      if (loc) {
        allUrls.push({ url: loc, lastmod });
      }
    });
    
    const listingUrls = allUrls.filter(u => isListingUrl(u.url));
    
    console.log(`\n✅ Total URLs in sitemap: ${allUrls.length}`);
    console.log(`✅ Listing URLs: ${listingUrls.length}`);
    
    // Sort by lastmod and show newest
    listingUrls.sort((a, b) => {
      if (!a.lastmod && !b.lastmod) return 0;
      if (!a.lastmod) return 1;
      if (!b.lastmod) return -1;
      return b.lastmod.localeCompare(a.lastmod);
    });
    
    console.log('\nNewest listings (top 5):');
    listingUrls.slice(0, 5).forEach(({ url, lastmod }) => {
      console.log(`  - ${lastmod || 'no date'}: ${url.substring(0, 80)}...`);
    });
    
    return listingUrls.slice(0, 5);
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
  
  const testUrl = url || 'https://www.aproperties.es/barcelona/eixample-esquerra/piso-de-113-m2-en-venta-en-eixample-esquerra-barcelona';
  
  console.log(`\nFetching: ${testUrl}`);
  
  try {
    const response = await fetch(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'es-ES,es;q=0.9'
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

// Test 4: URL parsing
async function testUrlParsing() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: URL Location Parsing');
  console.log('='.repeat(60));
  
  const testUrls = [
    'https://www.aproperties.es/en/barcelona/eixample-esquerra/113-sqm-flat-for-sale-in-eixample-esquerra-barcelona',
    'https://www.aproperties.es/barcelona/eixample-esquerra/piso-de-113-m2-en-venta-en-eixample-esquerra-barcelona',
    'https://www.aproperties.es/valencia/ciutat-vella/piso-de-150-m2-en-alquiler-en-ciutat-vella-valencia',
    'https://www.aproperties.es/madrid/salamanca/casa-de-300-m2-en-venta-en-salamanca-madrid'
  ];
  
  testUrls.forEach(url => {
    console.log(`\n🔗 ${url}`);
    const result = parseUrlLocation(url);
    console.log(JSON.stringify(result, null, 2));
  });
}

// Main test runner
async function main() {
  console.log('🏠 aProperties Spain Harvest Test');
  console.log('Date:', new Date().toISOString());
  
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

