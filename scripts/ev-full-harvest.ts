/**
 * ENGEL & VÖLKERS FULL HARVEST
 * 
 * Strategy: Hit ALL region URLs to get complete inventory
 * Since SSR only returns 35/page, we use geo-segmentation
 * 
 * Run: npx tsx scripts/ev-full-harvest.ts
 */

import * as fs from 'fs/promises';

const BASE_URLS = [
  // Rent
  { base: 'https://www.engelvoelkers.com/es/en/properties/res/rent/house', type: 'rent', prop: 'house' },
  { base: 'https://www.engelvoelkers.com/es/en/properties/res/rent/apartment', type: 'rent', prop: 'apartment' },
  // Sale  
  { base: 'https://www.engelvoelkers.com/es/en/properties/res/sale/house', type: 'sale', prop: 'house' },
  { base: 'https://www.engelvoelkers.com/es/en/properties/res/sale/apartment', type: 'sale', prop: 'apartment' },
  { base: 'https://www.engelvoelkers.com/es/en/properties/res/sale/land', type: 'sale', prop: 'land' },
];

interface EVListing {
  id: string;
  displayId: string;
  propertyType: string;
  marketingType: string;
  title: string;
  price: number | null;
  priceType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  totalSurface: number | null;
  plotSurface: number | null;
  country: string;
  region: string;
  city: string;
  shopName: string;
  imageIds: string[];
  url: string;
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function extractRegionUrls(baseUrl: string): Promise<string[]> {
  const html = await fetchHtml(baseUrl);
  const basePath = new URL(baseUrl).pathname;
  
  // Extract all region URLs that extend this base path
  const regex = new RegExp(`href="(${basePath.replace(/\//g, '\\/')}[^"]+)"`, 'g');
  const urls = new Set<string>();
  urls.add(baseUrl); // Include base URL
  
  let match;
  while ((match = regex.exec(html)) !== null) {
    urls.add(`https://www.engelvoelkers.com${match[1]}`);
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
    
    return searchResults.listings.map((item: any) => {
      const l = item.listing;
      if (!l) return null;
      
      const addressParts = l.addressComponents || [];
      const country = addressParts.find((a: any) => a.placeType === 'country')?.text || '';
      const region = addressParts.find((a: any) => a.placeType === 'administrative_area_level_1')?.text || '';
      const city = addressParts.find((a: any) => a.placeType === 'locality')?.text || '';
      
      let price: number | null = null;
      let priceType = '';
      if (l.price?.rentTotal?.min) { price = l.price.rentTotal.min; priceType = 'rent'; }
      else if (l.price?.salePrice?.min) { price = l.price.salePrice.min; priceType = 'sale'; }
      else if (l.basePrice?.rentTotal?.min) { price = l.basePrice.rentTotal.min; priceType = 'rent'; }
      else if (l.basePrice?.salePrice?.min) { price = l.basePrice.salePrice.min; priceType = 'sale'; }
      
      return {
        id: l.id,
        displayId: l.displayId,
        propertyType: l.propertyType || '',
        marketingType: l.propertyMarketingType || l.marketingType || '',
        title: l.profile?.title || '',
        price,
        priceType,
        bedrooms: l.bedrooms?.min ?? null,
        bathrooms: l.bathrooms?.min ?? null,
        totalSurface: l.area?.totalSurface?.min ?? null,
        plotSurface: l.area?.plotSurface?.min ?? null,
        country,
        region,
        city,
        shopName: l.shopName || '',
        imageIds: l.uploadCareImageIds || [],
        url: `https://www.engelvoelkers.com/es/en/property/${l.displayId}`,
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

async function main() {
  console.log('🏠 ENGEL & VÖLKERS FULL SPAIN HARVEST\n');
  console.log('Strategy: Geo-segmented scraping to bypass 35-listing limit\n');
  
  const allListings = new Map<string, EVListing>();
  let totalUrlsScraped = 0;
  
  for (const { base, type, prop } of BASE_URLS) {
    console.log(`\n📂 ${type.toUpperCase()}/${prop.toUpperCase()}`);
    console.log('─'.repeat(40));
    
    // Get all region URLs
    const regionUrls = await extractRegionUrls(base);
    console.log(`   Found ${regionUrls.length} region URLs`);
    
    const beforeCount = allListings.size;
    
    // Scrape each region
    for (let i = 0; i < regionUrls.length; i++) {
      const url = regionUrls[i];
      try {
        const html = await fetchHtml(url);
        const listings = parseListings(html);
        
        for (const listing of listings) {
          if (!allListings.has(listing.id)) {
            allListings.set(listing.id, listing);
          }
        }
        
        totalUrlsScraped++;
        
        // Progress every 10 URLs
        if ((i + 1) % 10 === 0 || i === regionUrls.length - 1) {
          const newInCategory = allListings.size - beforeCount;
          process.stdout.write(`\r   Progress: ${i + 1}/${regionUrls.length} URLs | ${newInCategory} new listings`);
        }
        
        // Small delay
        await new Promise(r => setTimeout(r, 200));
        
      } catch (err: any) {
        // Skip errors silently
      }
    }
    
    const newInCategory = allListings.size - beforeCount;
    console.log(`\n   ✅ Got ${newInCategory} unique listings from ${type}/${prop}`);
  }
  
  // Convert to array
  const listingsArray = Array.from(allListings.values());
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('HARVEST COMPLETE');
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
).sort((a, b) => b[1] - a[1]).map(([name, count]) => `   ${name}: ${count}`).join('\n')}

🏢 BY AGENCY (top 10):
${Object.entries(
  listingsArray.reduce((acc, l) => {
    acc[l.shopName] = (acc[l.shopName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>)
).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => `   ${name}: ${count}`).join('\n')}
`);

  // Save
  const outputPath = '/Users/peterneyra/puedo_casa/data/ev-listings-full.json';
  await fs.writeFile(outputPath, JSON.stringify(listingsArray, null, 2));
  console.log(`💾 Saved to ${outputPath}`);
  
  // Sample
  console.log('\n=== SAMPLE LISTINGS ===\n');
  for (const l of listingsArray.slice(0, 3)) {
    console.log(`${l.displayId}: ${l.title.substring(0, 50)}...`);
    console.log(`   💰 €${l.price?.toLocaleString() || 'N/A'} (${l.priceType}) | 🛏️ ${l.bedrooms || 'N/A'} beds | 📐 ${l.totalSurface || 'N/A'}m²`);
    console.log(`   📍 ${l.city}, ${l.region}`);
    console.log();
  }
}

main().catch(console.error);

