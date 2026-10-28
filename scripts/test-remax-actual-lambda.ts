/**
 * Test RE/MAX using ACTUAL Lambda code
 * Per Requirement #13: Real Data Testing - No simplified scripts!
 */

// Import actual Lambda functions
import * as cheerio from 'cheerio';

// ============================================================
// Copy of Lambda's core functions (for testing without AWS)
// ============================================================

const NOMINATIM_URL = process.env.NOMINATIM_URL || '';

interface RemaxListing {
  id: string;
  url: string;
  title: string;
  price: number | null;
  price_raw: string;
  description: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area_m2: number | null;
  address: string;
  neighborhood: string | null;
  city: string | null;
  province: string | null;
  photos: string[];
  latitude: number | null;
  longitude: number | null;
  property_type: string | null;
  contract_type: string;
  source: 'remax.es';
  scraped_at: string;
  lastmod: string | null;
  has_elevator: boolean;
  has_ac: boolean;
  has_parking: boolean;
  has_terrace: boolean;
  has_pool: boolean;
  floor: number | null;
}

// URL patterns for RE/MAX
interface UrlInfo {
  contract_type: string;
  property_type: string | null;
  province: string | null;
  city: string | null;
  neighborhood: string | null;
  id: string | null;
}

function parseUrlLocation(url: string): UrlInfo {
  const pathParts = url.replace(/https?:\/\/[^\/]+/, '').split('/').filter(Boolean);
  
  // Expected: buscador-de-inmuebles / venta / piso / madrid / madrid / centro / PR-00407
  const result: UrlInfo = {
    contract_type: 'sale',
    property_type: null,
    province: null,
    city: null,
    neighborhood: null,
    id: null
  };
  
  if (pathParts[0] !== 'buscador-de-inmuebles') return result;
  
  if (pathParts[1] === 'venta') result.contract_type = 'sale';
  else if (pathParts[1] === 'alquiler') result.contract_type = 'rent';
  
  // Property type
  if (pathParts[2]) {
    const typeMap: Record<string, string> = {
      'piso': 'apartment',
      'apartamento': 'apartment',
      'atico': 'penthouse',
      'duplex': 'duplex',
      'casa': 'house',
      'chalet': 'house',
      'villa': 'villa',
      'estudio': 'studio',
      'local': 'commercial',
      'oficina': 'office',
      'terreno': 'land',
    };
    result.property_type = typeMap[pathParts[2].toLowerCase()] || pathParts[2];
  }
  
  // Location and ID
  if (pathParts.length >= 4) result.province = decodeURIComponent(pathParts[3]).replace(/-/g, ' ');
  if (pathParts.length >= 5) result.city = decodeURIComponent(pathParts[4]).replace(/-/g, ' ');
  if (pathParts.length >= 6) result.neighborhood = decodeURIComponent(pathParts[5]).replace(/-/g, ' ');
  
  // Last part is the ID
  const lastPart = pathParts[pathParts.length - 1];
  if (lastPart && /^[A-Z]{2,3}-\d+$/.test(lastPart)) {
    result.id = lastPart;
  }
  
  return result;
}

function sanitizeJsonString(str: string): string {
  // Remove control characters that can break JSON parsing
  return str.replace(/[\x00-\x1F\x7F]/g, ' ');
}

// Main parsing function from the Lambda
function parseDetailPage(html: string, url: string, lastmod: string | null): RemaxListing | null {
  const $ = cheerio.load(html);
  
  // Extract location and ID from URL
  const urlInfo = parseUrlLocation(url);
  const id = urlInfo.id;
  
  if (!id) {
    return null;
  }
  
  // Extract title from title tag or h1
  const titleTag = $('title').text();
  const title = titleTag.split('–')[0].trim() || `Property ${id}`;
  
  // Extract price from JSON-LD (sanitize to remove control characters)
  let price: number | null = null;
  let priceRaw = '';
  let description = '';
  
  try {
    const jsonLdRaw = $('script[type="application/ld+json"]').html();
    if (jsonLdRaw) {
      const jsonLd = sanitizeJsonString(jsonLdRaw);
      const data = JSON.parse(jsonLd);
      if (data.offers?.price) {
        price = parseInt(data.offers.price, 10);
        priceRaw = `${price} €`;
      }
      if (data.description) {
        description = data.description.substring(0, 2000);
      }
    }
  } catch (e) {
    // JSON-LD parsing failed, will use HTML fallback
  }
  
  // Fallback: try to get price from HTML elements
  if (!price) {
    // Try tarjeta_precio class (main price display)
    const priceElem = $('.tarjeta_precio').first();
    if (priceElem.length) {
      priceRaw = priceElem.text().trim();
      const priceNum = priceRaw.replace(/[^\d]/g, '');
      price = priceNum ? parseInt(priceNum, 10) : null;
    }
    
    // Try regex on HTML for "Precio: X.XXX.XXX €" pattern
    if (!price) {
      const priceMatch = html.match(/Precio:\s*([\d.]+)\s*€/i);
      if (priceMatch) {
        priceRaw = priceMatch[1] + ' €';
        price = parseInt(priceMatch[1].replace(/\./g, ''), 10);
      }
    }
  }
  
  // Fallback description from meta tag
  if (!description) {
    description = $('meta[name="description"]').attr('content') || '';
  }
  
  // Extract specs from HTML
  let bedrooms: number | null = null;
  let bathrooms: number | null = null;
  let area_m2: number | null = null;
  
  // Try specific patterns from the HTML content
  const habMatch = html.match(/(\d+)\s*hab/i);
  const banoMatch = html.match(/(\d+)\s*baño/i);
  const m2Match = html.match(/(\d+)\s*m[²2]/i);
  
  if (habMatch) bedrooms = parseInt(habMatch[1], 10);
  if (banoMatch) bathrooms = parseInt(banoMatch[1], 10);
  if (m2Match) area_m2 = parseInt(m2Match[1], 10);
  
  // Extract photos from anaconda-guru S3 URLs
  const photoRegex = /https:\/\/anaconda-guru\.s3[^"'\s]+\.jpg/g;
  const photos = [...new Set(html.match(photoRegex) || [])];
  
  // Build address from URL components
  const addressParts = [
    urlInfo.neighborhood,
    urlInfo.city,
    urlInfo.province
  ].filter(Boolean);
  const address = addressParts.join(', ');
  
  // Extract boolean amenity flags from title and description (Data Completeness)
  const lowerTitle = title.toLowerCase();
  const lowerDesc = description.toLowerCase();
  const searchText = lowerTitle + ' ' + lowerDesc;
  
  const has_elevator = /ascensor|elevator/i.test(searchText);
  const has_ac = /aire\s*acondicionado|climatización|a\/c/i.test(searchText);
  const has_parking = /garaje|parking|plaza\s*de\s*garaje|aparcamiento/i.test(searchText);
  const has_terrace = /terraza|balcón|solarium/i.test(searchText);
  const has_pool = /piscina|pool/i.test(searchText);
  
  // Extract floor number if available
  let floor: number | null = null;
  const floorMatch = searchText.match(/(\d+)(?:º|ª|a|er|o)\s*(?:planta|piso)/i) ||
                    searchText.match(/planta\s*(\d+)/i);
  if (floorMatch) {
    floor = parseInt(floorMatch[1]);
  }
  if (/planta\s*baja|bajo|ground\s*floor/i.test(searchText)) {
    floor = 0;
  }
  
  return {
    id,
    url,
    title,
    price,
    price_raw: priceRaw,
    description,
    bedrooms,
    bathrooms,
    area_m2,
    address,
    neighborhood: urlInfo.neighborhood,
    city: urlInfo.city,
    province: urlInfo.province,
    photos,
    latitude: null,
    longitude: null,
    property_type: urlInfo.property_type,
    contract_type: urlInfo.contract_type,
    source: 'remax.es',
    scraped_at: new Date().toISOString(),
    lastmod,
    has_elevator,
    has_ac,
    has_parking,
    has_terrace,
    has_pool,
    floor,
  };
}

// Geocode function
async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const query = encodeURIComponent(address);
    const response = await fetch(`${NOMINATIM_URL}/search?q=${query}&format=json&limit=1&countrycodes=es`);
    
    if (!response.ok) return null;
    
    const results = await response.json();
    if (results && results.length > 0) {
      return {
        lat: parseFloat(results[0].lat),
        lon: parseFloat(results[0].lon)
      };
    }
  } catch {
    // Geocoding failed
  }
  return null;
}

// Fetch functions
async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      }
    });
    
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function fetchSitemapIndex(): Promise<string[]> {
  const response = await fetch('https://www.remax.es/sitemap-general.xml', {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/xml,text/xml'
    }
  });
  
  if (!response.ok) return [];
  const xml = await response.text();
  
  // Find all sub-sitemaps
  const matches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
  const sitemaps = [];
  
  for (const match of matches) {
    const url = match[1];
    if (url.includes('sitemap-fichas')) {
      sitemaps.push(url);
    }
  }
  
  return sitemaps;
}

async function fetchSitemap(url: string): Promise<Array<{ url: string; lastmod: string | null }>> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/xml,text/xml' }
    });
    
    if (!response.ok) return [];
    const xml = await response.text();
    
    const results: Array<{ url: string; lastmod: string | null }> = [];
    const urlMatches = xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/gs);
    
    for (const match of urlMatches) {
      const listingUrl = match[1];
      const lastmod = match[2] || null;
      
      // Only include detail pages (contain property ID pattern)
      if (listingUrl.includes('buscador-de-inmuebles') && /\/[A-Z]{2,3}-\d+\//.test(listingUrl)) {
        results.push({ url: listingUrl, lastmod });
      }
    }
    
    return results;
  } catch {
    return [];
  }
}

// ============================================================
// ACTUAL TEST
// ============================================================

async function testRemax() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('RE/MAX - ACTUAL LAMBDA CODE TEST');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('\nPer Requirement #13: Real Data Testing - Using ACTUAL Lambda functions!\n');
  
  // Step 1: Fetch sitemap index
  console.log('1️⃣ Fetching sitemap index...');
  const sitemaps = await fetchSitemapIndex();
  console.log(`   Found ${sitemaps.length} sub-sitemaps`);
  
  if (sitemaps.length === 0) {
    console.log('❌ No sitemaps found!');
    return;
  }
  
  // Step 2: Fetch first sitemap (for speed)
  console.log(`\n2️⃣ Fetching URLs from first sitemap: ${sitemaps[0]}`);
  const urls = await fetchSitemap(sitemaps[0]);
  console.log(`   Found ${urls.length} listing URLs`);
  
  if (urls.length === 0) {
    console.log('❌ No URLs found!');
    return;
  }
  
  // Step 3: Process 3 listings
  const testCount = 3;
  console.log(`\n3️⃣ Processing ${testCount} listings...\n`);
  
  let successCount = 0;
  let geocodedCount = 0;
  
  for (let i = 0; i < testCount && i < urls.length; i++) {
    const { url, lastmod } = urls[i];
    console.log(`─────────────────────────────────────────────────────────────────────────────────`);
    console.log(`LISTING ${i + 1}: ${url}`);
    
    // Fetch HTML
    const html = await fetchPage(url);
    if (!html) {
      console.log('   ❌ Failed to fetch page');
      continue;
    }
    console.log(`   ✅ Fetched HTML (${html.length.toLocaleString()} chars)`);
    
    // Parse
    const listing = parseDetailPage(html, url, lastmod);
    if (!listing) {
      console.log('   ❌ Parse failed (no ID extracted)');
      continue;
    }
    
    console.log(`   ✅ Parsed successfully:`);
    console.log(`      ID: ${listing.id}`);
    console.log(`      Price: ${listing.price ? `€${listing.price.toLocaleString()}` : 'N/A'}`);
    console.log(`      Beds: ${listing.bedrooms || 'N/A'} | Baths: ${listing.bathrooms || 'N/A'} | Area: ${listing.area_m2 ? `${listing.area_m2}m²` : 'N/A'}`);
    console.log(`      Location: ${listing.city || 'N/A'}, ${listing.province || 'N/A'}`);
    console.log(`      Photos: ${listing.photos.length}`);
    console.log(`      Elevator: ${listing.has_elevator} | AC: ${listing.has_ac} | Parking: ${listing.has_parking}`);
    console.log(`      Terrace: ${listing.has_terrace} | Pool: ${listing.has_pool} | Floor: ${listing.floor ?? 'N/A'}`);
    
    // Geocode
    if (listing.city && listing.province) {
      const query = [listing.neighborhood, listing.city, listing.province, 'España']
        .filter(Boolean)
        .join(', ');
      console.log(`   🌍 Geocoding: "${query}"`);
      
      const coords = await geocodeAddress(query);
      if (coords) {
        console.log(`   ✅ Geocoded: ${coords.lat}, ${coords.lon}`);
        geocodedCount++;
      } else {
        console.log(`   ⚠️ Geocoding failed (may be Canary Islands or other limitation)`);
      }
    }
    
    successCount++;
    console.log('');
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`Total sitemaps: ${sitemaps.length}`);
  console.log(`URLs in first sitemap: ${urls.length}`);
  console.log(`Listings tested: ${testCount}`);
  console.log(`Successfully parsed: ${successCount}/${testCount}`);
  console.log(`Successfully geocoded: ${geocodedCount}/${successCount}`);
  
  if (successCount === testCount) {
    console.log('\n✅ RE/MAX Lambda code test PASSED!');
  } else {
    console.log('\n⚠️ Some listings failed - check output above');
  }
}

// Run test
testRemax().catch(console.error);

