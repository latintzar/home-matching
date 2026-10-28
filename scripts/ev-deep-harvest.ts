/**
 * ENGEL & VÖLKERS DEEP HARVEST
 * 
 * Recursively discovers ALL geo URLs to maximize coverage
 * 
 * Run: npx tsx scripts/ev-deep-harvest.ts
 */

import * as fs from 'fs/promises';

const BASE_SEARCH_URLS = [
  'https://www.engelvoelkers.com/es/en/properties/res/rent/house',
  'https://www.engelvoelkers.com/es/en/properties/res/rent/apartment',
  'https://www.engelvoelkers.com/es/en/properties/res/sale/house',
  'https://www.engelvoelkers.com/es/en/properties/res/sale/apartment',
  'https://www.engelvoelkers.com/es/en/properties/res/sale/land',
];

interface EVListing {
  // Core identifiers
  id: string;
  displayId: string;
  
  // Property classification
  propertyType: string;
  marketingType: string;
  businessArea: string;
  
  // Listing details
  title: string;
  price: number | null;
  priceType: string;
  currency: string;
  hasPriceOnRequest: boolean;
  
  // Rooms
  bedrooms: number | null;
  bathrooms: number | null;
  rooms: number | null;
  
  // Surfaces
  totalSurface: number | null;
  livingSurface: number | null;
  plotSurface: number | null;
  
  // Location
  country: string;
  countryCode: string;
  region: string;
  city: string;
  municipality: string;
  googlePlaceIds: {
    country?: string;
    region?: string;
    city?: string;
    municipality?: string;
  };
  
  // Agency
  shopName: string;
  
  // Media
  imageIds: string[];
  
  // Flags
  isNew: boolean;
  isExclusive: boolean;
  isPrivateOffice: boolean;
  isDevelopmentProject: boolean;
  
  // Meta
  url: string;
  harvestedAt?: string;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

function extractSubUrls(html: string, basePath: string): string[] {
  // Find all URLs that extend this path
  const regex = new RegExp(`href="(${basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]+)"`, 'g');
  const urls = new Set<string>();
  
  let match;
  while ((match = regex.exec(html)) !== null) {
    const path = match[1];
    // Only include paths that are deeper (have more segments)
    if (path.split('/').length > basePath.split('/').length) {
      urls.add(`https://www.engelvoelkers.com${path}`);
    }
  }
  
  return Array.from(urls);
}

function parseListings(html: string): EVListing[] {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>({.*?})<\/script>/);
  if (!match) return [];
  
  try {
    const data = JSON.parse(match[1]);
    const searchResults = data?.props?.pageProps?.searchModule?.initialSearchResults;
    if (!searchResults?.listings) return [];
    
    const now = new Date().toISOString();
    
    return searchResults.listings.map((item: any) => {
      const l = item.listing;
      if (!l) return null;
      
      // Extract address components with Google Place IDs
      const addressParts = l.addressComponents || [];
      const countryPart = addressParts.find((a: any) => a.placeType === 'country');
      const regionPart = addressParts.find((a: any) => a.placeType === 'administrative_area_level_1');
      const cityPart = addressParts.find((a: any) => a.placeType === 'locality');
      const municipalityPart = addressParts.find((a: any) => a.placeType === 'administrative_area_level_4');
      
      // Extract price (supports both rent and sale)
      let price: number | null = null;
      let priceType = '';
      if (l.price?.rentTotal?.min) { price = l.price.rentTotal.min; priceType = 'rent'; }
      else if (l.price?.salesPrice?.min) { price = l.price.salesPrice.min; priceType = 'sale'; }
      else if (l.price?.salePrice?.min) { price = l.price.salePrice.min; priceType = 'sale'; }
      else if (l.basePrice?.rentTotal?.min) { price = l.basePrice.rentTotal.min; priceType = 'rent'; }
      else if (l.basePrice?.salesPrice?.min) { price = l.basePrice.salesPrice.min; priceType = 'sale'; }
      else if (l.basePrice?.salePrice?.min) { price = l.basePrice.salePrice.min; priceType = 'sale'; }
      
      // Check for exclusive badge
      const imageDisturbers = l.imageDisturbers || [];
      const isExclusive = imageDisturbers.includes('EXCLUSIVE');
      
      return {
        // Core identifiers
        id: l.id,
        displayId: l.displayId,
        
        // Property classification
        propertyType: l.propertyType || '',
        marketingType: l.propertyMarketingType || l.marketingType || '',
        businessArea: l.businessArea || 'residential',
        
        // Listing details
        title: l.profile?.title || '',
        price,
        priceType,
        currency: l.baseCurrency || 'EUR',
        hasPriceOnRequest: l.hasPriceOnRequest || false,
        
        // Rooms
        bedrooms: l.bedrooms?.min ?? null,
        bathrooms: l.bathrooms?.min ?? null,
        rooms: l.rooms?.min ?? null,
        
        // Surfaces
        totalSurface: l.area?.totalSurface?.min ?? null,
        livingSurface: l.area?.livingSurface?.min ?? null,
        plotSurface: l.area?.plotSurface?.min ?? null,
        
        // Location
        country: countryPart?.text || '',
        countryCode: l.countryAlpha2 || '',
        region: regionPart?.text || '',
        city: cityPart?.text || '',
        municipality: municipalityPart?.text || '',
        googlePlaceIds: {
          country: countryPart?.placeId,
          region: regionPart?.placeId,
          city: cityPart?.placeId,
          municipality: municipalityPart?.placeId,
        },
        
        // Agency
        shopName: l.shopName || '',
        
        // Media
        imageIds: l.uploadCareImageIds || [],
        
        // Flags
        isNew: l.isNew || false,
        isExclusive,
        isPrivateOffice: l.isPrivateOffice || false,
        isDevelopmentProject: l.isDevelopmentProject || false,
        
        // Meta
        url: `https://www.engelvoelkers.com/es/en/property/${l.displayId}`,
        harvestedAt: now,
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

async function discoverAllUrls(baseUrl: string): Promise<Set<string>> {
  const allUrls = new Set<string>();
  const visited = new Set<string>();
  const queue = [baseUrl];
  const basePath = new URL(baseUrl).pathname;
  
  console.log(`   🔍 Discovering URLs from ${basePath}...`);
  
  while (queue.length > 0 && allUrls.size < 5000) {  // Safety limit
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    
    const html = await fetchHtml(url);
    if (!html) continue;
    
    allUrls.add(url);
    
    // Find sub-URLs and add to queue
    const subUrls = extractSubUrls(html, basePath);
    for (const subUrl of subUrls) {
      if (!visited.has(subUrl)) {
        queue.push(subUrl);
      }
    }
    
    // Progress
    if (allUrls.size % 50 === 0) {
      process.stdout.write(`\r   📊 Found ${allUrls.size} URLs (queue: ${queue.length})`);
    }
    
    // Small delay
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`\r   ✅ Discovered ${allUrls.size} URLs total`);
  return allUrls;
}

async function main() {
  console.log('🏠 ENGEL & VÖLKERS DEEP HARVEST\n');
  console.log('Recursively discovering ALL geo URLs...\n');
  
  const allListings = new Map<string, EVListing>();
  let totalUrlsScraped = 0;
  
  for (const baseUrl of BASE_SEARCH_URLS) {
    const path = new URL(baseUrl).pathname;
    const parts = path.split('/');
    const type = parts[4]; // rent or sale
    const prop = parts[5]; // house, apartment, land
    
    console.log(`\n📂 ${type.toUpperCase()}/${prop.toUpperCase()}`);
    console.log('─'.repeat(50));
    
    // Discover all URLs recursively
    const urls = await discoverAllUrls(baseUrl);
    
    const beforeCount = allListings.size;
    let processed = 0;
    
    // Scrape each URL
    for (const url of urls) {
      const html = await fetchHtml(url);
      if (html) {
        const listings = parseListings(html);
        for (const listing of listings) {
          if (!allListings.has(listing.id)) {
            allListings.set(listing.id, listing);
          }
        }
        totalUrlsScraped++;
      }
      
      processed++;
      if (processed % 100 === 0) {
        const newCount = allListings.size - beforeCount;
        process.stdout.write(`\r   📥 Scraped ${processed}/${urls.size} URLs | ${newCount} new listings`);
      }
      
      await new Promise(r => setTimeout(r, 50));
    }
    
    const newInCategory = allListings.size - beforeCount;
    console.log(`\n   ✅ Got ${newInCategory} unique listings from ${type}/${prop}`);
  }
  
  // Convert to array
  const listingsArray = Array.from(allListings.values());
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('DEEP HARVEST COMPLETE');
  console.log('='.repeat(60));
  
  const rentCount = listingsArray.filter(l => l.marketingType === 'rent').length;
  const saleCount = listingsArray.filter(l => l.marketingType === 'sale').length;
  
  console.log(`
📊 TOTAL UNIQUE LISTINGS: ${listingsArray.length}
   🏠 For Rent: ${rentCount}
   💰 For Sale: ${saleCount}
   📍 URLs Scraped: ${totalUrlsScraped}

📍 BY REGION:
${Object.entries(
  listingsArray.reduce((acc, l) => {
    const r = l.region || 'Unknown';
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {} as Record<string, number>)
).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => `   ${name}: ${count}`).join('\n')}
`);

  // Save
  const outputPath = '/Users/peterneyra/puedo_casa/data/ev-listings-deep.json';
  await fs.writeFile(outputPath, JSON.stringify(listingsArray, null, 2));
  console.log(`💾 Saved to ${outputPath}`);
}

main().catch(console.error);

