/**
 * Century21 Spain Harvest Test Script
 * 
 * Tests the extraction of listing data from Century21.es
 * 
 * Data Source: HTML parsing (no JSON-LD in server response)
 * URL Discovery: Sitemap at https://century21.es/ref/sitemap/0.xml (23,056 URLs)
 * 
 * Available Data:
 * - ID, URL, Title, Price, Description
 * - Bedrooms, Bathrooms, Area (m²)
 * - Address (from og:image parameters)
 * - Photos (all URLs embedded)
 * - Coordinates: Via Nominatim geocoding from address
 * 
 * NOT Available (requires JavaScript):
 * - Energy certificate
 * - Amenities list
 * - Year built
 */

import * as cheerio from 'cheerio';
import * as zlib from 'zlib';

interface Century21Listing {
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
  city: string | null;
  province: string | null;
  photos: string[];
  latitude: number | null;
  longitude: number | null;
  source: 'century21.es';
  scraped_at: string;
}

// Nominatim client for geocoding
const NOMINATIM_URL = process.env.NOMINATIM_URL || '';

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  if (!address) return null;
  
  try {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '1',
      countrycodes: 'es'
    });
    
    const response = await fetch(`${NOMINATIM_URL}/search?${params}`, {
      headers: { 'User-Agent': 'PuedoCasa/1.0' }
    });
    
    if (!response.ok) {
      console.log(`Nominatim request failed: ${response.status}`);
      return null;
    }
    
    const results = await response.json();
    if (results && results.length > 0) {
      return {
        lat: parseFloat(results[0].lat),
        lon: parseFloat(results[0].lon)
      };
    }
  } catch (error) {
    console.log(`Geocoding error for ${address}: ${error}`);
  }
  
  return null;
}

async function fetchSitemapUrls(): Promise<string[]> {
  const sitemapUrl = 'https://century21.es/ref/sitemap/0.xml';
  console.log(`Fetching sitemap: ${sitemapUrl}`);
  
  const response = await fetch(sitemapUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status}`);
  }
  
  const xml = await response.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  
  const urls: string[] = [];
  $('url loc').each((_, el) => {
    const url = $(el).text();
    if (url.startsWith('https://century21.es/ref/')) {
      urls.push(url);
    }
  });
  
  console.log(`Found ${urls.length} listing URLs in sitemap`);
  return urls;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      }
    });
    
    if (!response.ok) {
      console.log(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    
    return await response.text();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

function parseDetailPage(html: string, url: string): Century21Listing | null {
  const $ = cheerio.load(html);
  
  // Extract reference ID from canonical URL
  const canonical = $('link[rel="canonical"]').attr('href') || url;
  const id = canonical.split('/').pop() || '';
  
  if (!id) {
    console.log(`No ID found for ${url}`);
    return null;
  }
  
  // Extract title from <title> tag
  const titleTag = $('title').text();
  const titleParts = titleTag.split('|');
  const title = titleParts.length >= 2 ? titleParts[1].trim() : titleParts[0].trim();
  
  // Extract price from tagline-1 class
  const priceElem = $('.tagline-1').first();
  const priceRaw = priceElem.text().trim();
  const priceNum = priceRaw.replace(/[^\d]/g, '');
  const price = priceNum ? parseInt(priceNum, 10) : null;
  
  // Extract specs (bedrooms, bathrooms, area) from tagline-2 class
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
  
  // Extract description from meta tag
  const description = $('meta[name="description"]').attr('content') || '';
  
  // Extract address from og:image URL parameters
  const ogImage = $('meta[property="og:image"]').attr('content') || '';
  let address = '';
  let city: string | null = null;
  let province: string | null = null;
  
  if (ogImage) {
    try {
      const ogUrl = new URL(ogImage.replace(/&amp;/g, '&'));
      address = ogUrl.searchParams.get('location') || '';
      
      // Try to extract city and province from address
      const addressParts = address.split(',').map(p => p.trim());
      if (addressParts.length >= 2) {
        city = addressParts[addressParts.length - 2];
        // Province might be in the last part if it's not "Spain"
        const lastPart = addressParts[addressParts.length - 1];
        if (lastPart !== 'Spain' && lastPart !== 'España') {
          province = lastPart;
        }
      }
    } catch (e) {
      // Failed to parse og:image URL
    }
  }
  
  // Extract photos
  const photoRegex = /https:\/\/images\.century21\.pt\/[^"]+\.jpg/g;
  const photos = [...new Set(html.match(photoRegex) || [])];
  
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
    latitude: null, // Will be geocoded
    longitude: null,
    source: 'century21.es',
    scraped_at: new Date().toISOString()
  };
}

async function testLocalFile() {
  console.log('\n=== Testing Local HTML File ===\n');
  
  const fs = await import('fs');
  const path = 'Random Files I Want To Give Cursor/109-00913 _ EL MARESME - VILASSAR DE MAR.html';
  
  if (!fs.existsSync(path)) {
    console.log('Local file not found, skipping local test');
    return null;
  }
  
  const html = fs.readFileSync(path, 'utf-8');
  const listing = parseDetailPage(html, 'https://century21.es/ref/109-00913');
  
  if (listing) {
    console.log('Parsed listing from local file:');
    console.log(`  ID: ${listing.id}`);
    console.log(`  Title: ${listing.title}`);
    console.log(`  Price: ${listing.price?.toLocaleString()} €`);
    console.log(`  Bedrooms: ${listing.bedrooms}`);
    console.log(`  Bathrooms: ${listing.bathrooms}`);
    console.log(`  Area: ${listing.area_m2} m²`);
    console.log(`  Address: ${listing.address}`);
    console.log(`  Photos: ${listing.photos.length}`);
    console.log(`  Description: ${listing.description.substring(0, 100)}...`);
  }
  
  return listing;
}

async function testLivePage() {
  console.log('\n=== Testing Live Page ===\n');
  
  const testUrl = 'https://century21.es/ref/109-00913';
  console.log(`Fetching: ${testUrl}`);
  
  const html = await fetchPage(testUrl);
  if (!html) {
    console.log('Failed to fetch live page');
    return null;
  }
  
  const listing = parseDetailPage(html, testUrl);
  
  if (listing) {
    console.log('Parsed listing from live page:');
    console.log(`  ID: ${listing.id}`);
    console.log(`  Title: ${listing.title}`);
    console.log(`  Price: ${listing.price?.toLocaleString()} €`);
    console.log(`  Bedrooms: ${listing.bedrooms}`);
    console.log(`  Bathrooms: ${listing.bathrooms}`);
    console.log(`  Area: ${listing.area_m2} m²`);
    console.log(`  Address: ${listing.address}`);
    console.log(`  Photos: ${listing.photos.length}`);
    
    // Test geocoding
    if (listing.address) {
      console.log('\n  Testing geocoding...');
      const coords = await geocodeAddress(listing.address);
      if (coords) {
        listing.latitude = coords.lat;
        listing.longitude = coords.lon;
        console.log(`  Coordinates: ${coords.lat}, ${coords.lon}`);
      } else {
        console.log('  Geocoding failed (Nominatim may be unavailable)');
      }
    }
  }
  
  return listing;
}

async function testSitemap() {
  console.log('\n=== Testing Sitemap ===\n');
  
  try {
    const urls = await fetchSitemapUrls();
    console.log(`Total URLs in sitemap: ${urls.length}`);
    
    // Show sample URLs
    console.log('\nSample URLs:');
    for (let i = 0; i < Math.min(5, urls.length); i++) {
      console.log(`  ${urls[i]}`);
    }
    
    return urls;
  } catch (error) {
    console.error('Sitemap test failed:', error);
    return [];
  }
}

async function testBatchHarvest(limit: number = 5) {
  console.log(`\n=== Testing Batch Harvest (${limit} listings) ===\n`);
  
  const urls = await fetchSitemapUrls();
  const sampleUrls = urls.slice(0, limit);
  const listings: Century21Listing[] = [];
  
  for (const url of sampleUrls) {
    console.log(`Fetching: ${url}`);
    const html = await fetchPage(url);
    
    if (html) {
      const listing = parseDetailPage(html, url);
      if (listing) {
        listings.push(listing);
        console.log(`  ✓ ${listing.title} - ${listing.price?.toLocaleString()} €`);
      } else {
        console.log(`  ✗ Failed to parse`);
      }
    } else {
      console.log(`  ✗ Failed to fetch`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\nSuccessfully parsed: ${listings.length}/${limit}`);
  return listings;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Century21 Spain Harvest Test');
  console.log('='.repeat(60));
  
  // Test 1: Local file
  await testLocalFile();
  
  // Test 2: Live page
  await testLivePage();
  
  // Test 3: Sitemap
  await testSitemap();
  
  // Test 4: Batch harvest (optional)
  const args = process.argv.slice(2);
  if (args.includes('--batch')) {
    const limit = parseInt(args[args.indexOf('--batch') + 1] || '5', 10);
    await testBatchHarvest(limit);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Test Complete');
  console.log('='.repeat(60));
}

main().catch(console.error);

