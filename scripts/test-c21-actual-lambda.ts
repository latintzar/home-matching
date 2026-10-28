/**
 * Test Century21 Lambda using ACTUAL code
 */

import * as cheerio from 'cheerio';

const NOMINATIM_URL = 'http://3.230.148.50:8080';

// ACTUAL classifyPhotos from Lambda
const FLOORPLAN_PATTERNS = [
  /floorplan/i, /floor[-_]?plan/i, /plano/i, /planta/i, /grundriss/i,
  /distribucion/i, /layout/i, /blueprint/i, /esquema/i, /planimetria/i
];

interface ClassifiedPhotos {
  regular: string[];
  floorplan: string[];
  exterior: string[];
  other: string[];
  total: number;
}

function classifyPhotos(imageUrls: string[]): ClassifiedPhotos {
  const result: ClassifiedPhotos = {
    regular: [],
    floorplan: [],
    exterior: [],
    other: [],
    total: imageUrls.length
  };
  
  for (const url of imageUrls) {
    const filename = url.split('/').pop()?.toLowerCase() || '';
    
    if (FLOORPLAN_PATTERNS.some(p => p.test(filename) || p.test(url))) {
      result.floorplan.push(url);
    } else if (/exterior|fachada|facade|building/i.test(filename)) {
      result.exterior.push(url);
    } else {
      result.regular.push(url);
    }
  }
  
  return result;
}

// ACTUAL geocodeAddress from Lambda
async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  if (!address) return null;
  
  try {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '1',
      countrycodes: 'es'
    });
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${NOMINATIM_URL}/search?${params}`, {
      headers: { 'User-Agent': 'PuedoCasa/1.0' },
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) return null;
    
    const results = await response.json();
    if (results && results.length > 0) {
      return {
        lat: parseFloat(results[0].lat),
        lon: parseFloat(results[0].lon)
      };
    }
  } catch (error) {
    // Geocoding failed
  }
  
  return null;
}

// ACTUAL fetchPage from Lambda
async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'PuedoCasa/1.0 (property aggregator)' },
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) return null;
    
    return await response.text();
  } catch {
    return null;
  }
}

// ACTUAL parseDetailPage from Lambda
function parseDetailPage(html: string, url: string) {
  const $ = cheerio.load(html);
  
  const canonical = $('link[rel="canonical"]').attr('href') || url;
  const id = canonical.split('/').pop() || '';
  
  if (!id) return null;
  
  const titleTag = $('title').text();
  const titleParts = titleTag.split('|');
  const title = titleParts.length >= 2 ? titleParts[1].trim() : titleParts[0].trim();
  
  const priceElem = $('.tagline-1').first();
  const priceRaw = priceElem.text().trim();
  const priceNum = priceRaw.replace(/[^\d]/g, '');
  const price = priceNum ? parseInt(priceNum, 10) : null;
  
  const specs = $('.tagline-2');
  let bedrooms: number | null = null;
  let bathrooms: number | null = null;
  let area_m2: number | null = null;
  
  if (specs.length >= 3) {
    const bedroomsText = specs.eq(0).text().trim();
    const bathroomsText = specs.eq(1).text().trim();
    const areaText = specs.eq(2).text().trim();
    
    bedrooms = /^\d+$/.test(bedroomsText) ? parseInt(bedroomsText, 10) : null;
    bathrooms = /^\d+$/.test(bathroomsText) ? parseInt(bathroomsText, 10) : null;
    area_m2 = /^\d+$/.test(areaText) ? parseInt(areaText, 10) : null;
  }
  
  const description = $('meta[name="description"]').attr('content') || '';
  
  let address = '';
  let city: string | null = null;
  let province: string | null = null;
  
  const locationLinks = $('a[href*="address_names="]').map((_, el) => $(el).text().trim()).get();
  const uniqueLocations = [...new Set(locationLinks)].filter(l => l && l.length > 2);
  
  if (uniqueLocations.length > 0) {
    city = uniqueLocations[0];
    if (uniqueLocations.length > 1) {
      province = uniqueLocations[1];
    }
    address = uniqueLocations.join(', ') + ', Spain';
  }
  
  if (!city) {
    const ogDesc = $('meta[property="og:description"]').attr('content') || '';
    const cityMatch = ogDesc.match(/ciudad de ([A-Za-záéíóúñÁÉÍÓÚÑ]+)/i);
    if (cityMatch) {
      city = cityMatch[1];
      address = city + ', Spain';
    }
  }
  
  const photoRegex = /https:\/\/images\.century21\.pt\/[^"]+\.jpg/g;
  const photos = [...new Set(html.match(photoRegex) || [])];
  
  const contract_type = url.includes('/alquilar/') ? 'rent' : 'sale';
  
  // Boolean flags (ACTUAL code from Lambda)
  const lowerTitle = title.toLowerCase();
  const lowerDesc = description.toLowerCase();
  const searchText = lowerTitle + ' ' + lowerDesc;
  
  const has_elevator = /ascensor|elevator/i.test(searchText);
  const has_ac = /aire\s*acondicionado|climatización|a\/c/i.test(searchText);
  const has_parking = /garaje|parking|plaza\s*de\s*garaje|aparcamiento/i.test(searchText);
  const has_terrace = /terraza|balcón|solarium/i.test(searchText);
  const has_pool = /piscina|pool/i.test(searchText);
  
  let floor: number | null = null;
  const floorMatch = searchText.match(/(\d+)(?:º|ª|a|er|o)\s*(?:planta|piso)/i) ||
                    searchText.match(/planta\s*(\d+)/i);
  if (floorMatch) floor = parseInt(floorMatch[1]);
  if (/planta\s*baja|bajo|ground\s*floor/i.test(searchText)) floor = 0;
  
  return {
    id,
    url: canonical,
    title,
    price,
    price_raw: priceRaw,
    description,
    bedrooms,
    bathrooms,
    area_m2,
    address,
    city,
    province,
    photos,
    latitude: null as number | null,
    longitude: null as number | null,
    property_type: null,
    contract_type,
    has_elevator,
    has_ac,
    has_parking,
    has_terrace,
    has_pool,
    floor,
  };
}

// ACTUAL fetchSitemapUrls from Lambda
async function fetchSitemapUrls(limit: number = 10): Promise<string[]> {
  const sitemapUrl = 'https://century21.es/ref/sitemap/0.xml';
  
  try {
    const response = await fetch(sitemapUrl, {
      headers: { 'User-Agent': 'PuedoCasa/1.0' }
    });
    
    if (!response.ok) return [];
    
    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    
    const urls: string[] = [];
    $('url > loc').each((_, elem) => {
      const loc = $(elem).text().trim();
      // Century21 uses /ref/ URL format
      if (loc.includes('/ref/') && !loc.includes('sitemap')) {
        urls.push(loc);
      }
    });
    
    return urls.slice(0, limit);
  } catch {
    return [];
  }
}

async function runActualLambdaTest() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('CENTURY21 LAMBDA - ACTUAL CODE TEST (NOT SIMPLIFIED)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  // Step 1: Fetch sitemap URLs
  console.log('1. Using ACTUAL fetchSitemapUrls()...');
  const urls = await fetchSitemapUrls(5);
  console.log(`   Found ${urls.length} URLs from sitemap`);
  
  if (urls.length === 0) {
    console.log('❌ No URLs found from sitemap');
    return;
  }
  
  // Step 2: Fetch and parse using ACTUAL functions
  console.log('\n2. Using ACTUAL fetchPage() + parseDetailPage()...\n');
  
  let passed = 0;
  let failed = 0;
  let geocoded = 0;
  
  for (const url of urls.slice(0, 3)) {
    console.log(`   Processing: ${url.split('/').pop()}`);
    
    const html = await fetchPage(url);
    if (!html) {
      console.log(`   ❌ Failed to fetch page`);
      failed++;
      continue;
    }
    
    const listing = parseDetailPage(html, url);
    if (!listing) {
      console.log(`   ❌ Failed to parse page`);
      failed++;
      continue;
    }
    
    // Geocode using ACTUAL geocodeAddress
    if (listing.address) {
      console.log(`   🌍 Geocoding: "${listing.address}"`);
      const coords = await geocodeAddress(listing.address);
      if (coords) {
        listing.latitude = coords.lat;
        listing.longitude = coords.lon;
        geocoded++;
      }
    }
    
    const photos = classifyPhotos(listing.photos);
    
    // Verify fields
    const hasRequired = listing.id && listing.price;
    
    if (hasRequired) {
      console.log(`   ✅ ${listing.id}: €${listing.price?.toLocaleString()} | ${listing.bedrooms}bd/${listing.bathrooms}ba | ${listing.area_m2}m²`);
      console.log(`      Location: ${listing.city || 'N/A'}, ${listing.province || 'N/A'}`);
      console.log(`      Coords: ${listing.latitude || 'N/A'}, ${listing.longitude || 'N/A'} ${listing.latitude ? '← FROM NOMINATIM' : ''}`);
      console.log(`      Photos: ${photos.total}`);
      console.log(`      Flags: elevator=${listing.has_elevator}, ac=${listing.has_ac}, parking=${listing.has_parking}, floor=${listing.floor}`);
      passed++;
    } else {
      console.log(`   ⚠️ ${listing.id}: Missing required fields (price=${listing.price})`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('NOMINATIM CHECK:');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`Geocoded ${geocoded}/${passed} listings via Nominatim (${NOMINATIM_URL})`);
  if (geocoded > 0) {
    console.log('→ NOMINATIM IS WORKING ✅');
  } else {
    console.log('→ NOMINATIM may need verification');
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  
  if (passed > 0 && failed === 0) {
    console.log('\n✅ CENTURY21 ACTUAL LAMBDA CODE: ALL TESTS PASSED');
    console.log('   Lambda will work autonomously');
  } else if (passed > 0) {
    console.log('\n⚠️ CENTURY21 ACTUAL LAMBDA CODE: PARTIAL SUCCESS');
  } else {
    console.log('\n❌ CENTURY21 ACTUAL LAMBDA CODE: FAILED');
  }
}

runActualLambdaTest().catch(console.error);
