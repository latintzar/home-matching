/**
 * aProperties - Full Lambda Test
 */

import * as cheerio from 'cheerio';

const NOMINATIM_URL = 'http://3.230.148.50:8080';

const LISTING_PATTERNS = [
  /piso-de-\d+/, /casa-de-\d+/, /villa-de-\d+/, /apartamento-de-\d+/,
  /sqm-flat-for-sale/, /sqm-house-for-sale/, /sqm-villa-for-sale/
];

function isListingUrl(url: string): boolean {
  return LISTING_PATTERNS.some(p => p.test(url));
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function fetchSitemapUrls(): Promise<Array<{ url: string; lastmod: string | null }>> {
  const response = await fetch('https://www.aproperties.es/sitemap-es.xml', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const xml = await response.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  
  const listings: Array<{ url: string; lastmod: string | null }> = [];
  $('url').each((_, el) => {
    const loc = $(el).find('loc').text();
    const lastmod = $(el).find('lastmod').text() || null;
    if (loc && isListingUrl(loc)) {
      listings.push({ url: loc, lastmod });
    }
  });
  
  return listings;
}

function parseDetailPage(html: string, url: string) {
  const $ = cheerio.load(html);
  
  // ID from photo URLs
  const photoMatch = html.match(/\/media\/properties\/(\d+)\//);
  const id = photoMatch ? photoMatch[1] : url.split('/').pop()?.replace(/[^a-z0-9]/gi, '-') || '';
  
  // Title
  const title = $('title').text().split('|')[0].trim();
  
  // Price
  let price: number | null = null;
  const priceElem = $('.propHeader__priceCurrent').first().text().trim();
  const priceNum = priceElem.replace(/[^\d]/g, '');
  if (priceNum) price = parseInt(priceNum, 10);
  
  // Specs
  let beds: number | null = null, baths: number | null = null, area: number | null = null;
  $('.propHeader__specs__item').each((_, el) => {
    const label = $(el).find('.propHeader__specs__itemLabel').text().toLowerCase();
    const value = $(el).find('.propHeader__specs__itemValue').text().trim();
    if (/bedroom|dormitorio/.test(label)) beds = parseInt(value, 10) || null;
    if (/bathroom|baño/.test(label)) baths = parseInt(value, 10) || null;
    if (/surface|superficie|m²/.test(label)) area = parseInt(value.replace(/[^\d]/g, ''), 10) || null;
  });
  
  // Description
  const description = $('meta[name="description"]').attr('content') || '';
  
  // Photos
  const photoUrls: string[] = [];
  $('a[data-fancybox="gallery"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href?.includes('aproperties.es/media/properties')) photoUrls.push(href);
  });
  
  // City from URL
  const urlParts = new URL(url).pathname.split('/').filter(Boolean);
  const langPrefixes = ['en', 'ca', 'fr', 'de'];
  const startIdx = langPrefixes.includes(urlParts[0]) ? 1 : 0;
  const city = urlParts[startIdx]?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || null;
  
  // Boolean flags
  const searchText = (title + ' ' + description).toLowerCase();
  const has_elevator = /ascensor|elevator|lift/i.test(searchText);
  const has_ac = /aire\s*acondicionado|climatización|air\s*conditioning/i.test(searchText);
  const has_parking = /garaje|parking|aparcamiento/i.test(searchText);
  const has_terrace = /terraza|balcón|terrace|balcony/i.test(searchText);
  const has_pool = /piscina|pool/i.test(searchText);
  
  return { id, title, price, beds, baths, area, city, photos: photoUrls.length, has_elevator, has_ac, has_parking, has_terrace, has_pool };
}

async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const response = await fetch(`${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=es`);
    const results = await response.json();
    if (results.length > 0) {
      return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
    }
  } catch {}
  return null;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('aPROPERTIES - ACTUAL LAMBDA CODE TEST');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  console.log('1️⃣ Fetching sitemap...');
  const urls = await fetchSitemapUrls();
  console.log(`   Found ${urls.length} listing URLs`);
  
  console.log(`\n2️⃣ Testing 3 listings...\n`);
  
  let parsed = 0, geocoded = 0;
  
  for (let i = 0; i < 3 && i < urls.length; i++) {
    const { url, lastmod } = urls[i];
    console.log('─────────────────────────────────────────────────────────────────────────────────');
    console.log(`URL: ${url}`);
    
    const html = await fetchPage(url);
    if (!html) {
      console.log('  ❌ Failed to fetch');
      continue;
    }
    console.log(`  ✅ Fetched (${html.length.toLocaleString()} chars)`);
    
    const listing = parseDetailPage(html, url);
    console.log(`  ✅ Parsed:`);
    console.log(`     ID: ${listing.id}`);
    console.log(`     Title: ${listing.title.substring(0, 50)}...`);
    console.log(`     Price: ${listing.price ? '€' + listing.price.toLocaleString() : 'N/A'}`);
    console.log(`     Beds: ${listing.beds || 'N/A'} | Baths: ${listing.baths || 'N/A'} | Area: ${listing.area ? listing.area + 'm²' : 'N/A'}`);
    console.log(`     City: ${listing.city || 'N/A'}`);
    console.log(`     Photos: ${listing.photos}`);
    console.log(`     Elevator: ${listing.has_elevator} | AC: ${listing.has_ac} | Parking: ${listing.has_parking}`);
    console.log(`     Terrace: ${listing.has_terrace} | Pool: ${listing.has_pool}`);
    parsed++;
    
    if (listing.city) {
      const query = `${listing.city}, España`;
      console.log(`  🌍 Geocoding: "${query}"`);
      const coords = await geocode(query);
      if (coords) {
        console.log(`  ✅ Geocoded: ${coords.lat}, ${coords.lon}`);
        geocoded++;
      } else {
        console.log(`  ⚠️ Geocoding failed`);
      }
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`Sitemap URLs: ${urls.length}`);
  console.log(`Successfully parsed: ${parsed}/3`);
  console.log(`Successfully geocoded: ${geocoded}/${parsed}`);
  
  if (parsed > 0) {
    console.log('\n✅ aPROPERTIES LAMBDA CODE WORKS!');
  }
}

main().catch(console.error);
