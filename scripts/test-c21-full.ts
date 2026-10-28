/**
 * Century21 - Full Lambda Test with Valid URLs
 */

import * as cheerio from 'cheerio';

const NOMINATIM_URL = 'http://3.230.148.50:8080';

// Fetch page (from Lambda)
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

// Parse detail page (from Lambda)
function parseDetailPage(html: string, url: string) {
  const $ = cheerio.load(html);
  
  // ID from URL
  const id = url.split('/').pop() || '';
  
  // Title
  const title = $('title').text().trim();
  
  // Price from various locations
  let price: number | null = null;
  const priceText = $('[class*="price"], [class*="precio"]').first().text();
  const priceMatch = priceText.match(/([0-9.,]+)\s*€/) || html.match(/([0-9.,]+)\s*€/);
  if (priceMatch) {
    price = parseInt(priceMatch[1].replace(/[.,]/g, ''));
  }
  
  // Location from title or page
  const titleParts = title.split('|');
  const locationPart = titleParts[1]?.trim() || '';
  const cityMatch = locationPart.match(/(\w+)!*$/);
  const city = cityMatch ? cityMatch[1] : null;
  
  // Description
  const description = $('meta[name="description"]').attr('content') || '';
  
  // Photos
  const photos: string[] = [];
  $('img[src*="cloudfront"], img[src*="c21"]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && !src.includes('logo') && !src.includes('icon')) {
      photos.push(src);
    }
  });
  
  // Boolean flags from description
  const searchText = (title + ' ' + description).toLowerCase();
  const has_elevator = /ascensor/i.test(searchText);
  const has_ac = /aire\s*acondicionado/i.test(searchText);
  const has_parking = /garaje|parking/i.test(searchText);
  const has_terrace = /terraza/i.test(searchText);
  const has_pool = /piscina/i.test(searchText);
  
  return { id, title, price, city, photos: photos.length, has_elevator, has_ac, has_parking, has_terrace, has_pool, description: description.substring(0, 100) };
}

// Geocode
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

// Fetch sitemap and find valid URLs
async function findValidUrls(count: number): Promise<string[]> {
  const response = await fetch('https://century21.es/ref/sitemap/0.xml');
  const xml = await response.text();
  
  const urls = xml.match(/<loc>([^<]+)<\/loc>/g)?.map(m => m.replace(/<\/?loc>/g, '')) || [];
  console.log(`Sitemap has ${urls.length} URLs`);
  
  const valid: string[] = [];
  for (let i = 0; i < Math.min(urls.length, 100) && valid.length < count; i++) {
    const url = urls[i];
    const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      valid.push(url);
      console.log(`  ✅ Found valid: ${url}`);
    }
    // Rate limit
    await new Promise(r => setTimeout(r, 100));
  }
  
  return valid;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('CENTURY21 - ACTUAL LAMBDA CODE TEST');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  console.log('1️⃣ Finding valid URLs (sitemap has ~95% stale 404s)...');
  const validUrls = await findValidUrls(3);
  
  if (validUrls.length === 0) {
    console.log('❌ No valid URLs found in first 100 sitemap entries');
    return;
  }
  
  console.log(`\n2️⃣ Testing ${validUrls.length} valid listings...\n`);
  
  let parsed = 0;
  let geocoded = 0;
  
  for (const url of validUrls) {
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
    console.log(`     Title: ${listing.title.substring(0, 60)}...`);
    console.log(`     Price: ${listing.price ? '€' + listing.price.toLocaleString() : 'N/A'}`);
    console.log(`     City: ${listing.city || 'N/A'}`);
    console.log(`     Photos: ${listing.photos}`);
    console.log(`     Elevator: ${listing.has_elevator} | AC: ${listing.has_ac} | Parking: ${listing.has_parking}`);
    parsed++;
    
    // Geocode
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
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`Valid URLs found: ${validUrls.length}`);
  console.log(`Successfully parsed: ${parsed}/${validUrls.length}`);
  console.log(`Successfully geocoded: ${geocoded}/${parsed}`);
  
  if (parsed > 0) {
    console.log('\n✅ CENTURY21 LAMBDA CODE WORKS!');
    console.log('⚠️ Known issue: ~95% of sitemap URLs are 404s (stale)');
    console.log('   Lambda handles this with self-continuation until all checked');
  }
}

main().catch(console.error);
