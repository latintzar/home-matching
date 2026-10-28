/**
 * ENGEL & VÖLKERS DIRECT HARVEST
 * 
 * Extracts all listings directly from their SSR pages.
 * No spidering needed - just hit search pages and extract __NEXT_DATA__
 * 
 * Run: npx tsx scripts/ev-harvest.ts
 */

const SEARCH_URLS = [
  // Rent
  { url: 'https://www.engelvoelkers.com/es/en/properties/res/rent/house', type: 'rent', property: 'house' },
  { url: 'https://www.engelvoelkers.com/es/en/properties/res/rent/apartment', type: 'rent', property: 'apartment' },
  { url: 'https://www.engelvoelkers.com/es/en/properties/res/rent/land', type: 'rent', property: 'land' },
  // Sale
  { url: 'https://www.engelvoelkers.com/es/en/properties/res/sale/house', type: 'sale', property: 'house' },
  { url: 'https://www.engelvoelkers.com/es/en/properties/res/sale/apartment', type: 'sale', property: 'apartment' },
  { url: 'https://www.engelvoelkers.com/es/en/properties/res/sale/land', type: 'sale', property: 'land' },
  { url: 'https://www.engelvoelkers.com/es/en/properties/res/sale/real-estate', type: 'sale', property: 'all' },
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

async function extractNextData(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>({.*?})<\/script>/);
  
  if (!match) {
    throw new Error('No __NEXT_DATA__ found');
  }
  
  return JSON.parse(match[1]);
}

function parseListings(data: any): { listings: EVListing[]; total: number } {
  const searchResults = data?.props?.pageProps?.searchModule?.initialSearchResults;
  
  if (!searchResults) {
    return { listings: [], total: 0 };
  }
  
  const listings: EVListing[] = [];
  
  for (const item of searchResults.listings || []) {
    const l = item.listing;
    if (!l) continue;
    
    const addressParts = l.addressComponents || [];
    const country = addressParts.find((a: any) => a.placeType === 'country')?.text || '';
    const region = addressParts.find((a: any) => a.placeType === 'administrative_area_level_1')?.text || '';
    const city = addressParts.find((a: any) => a.placeType === 'locality')?.text || '';
    
    // Determine price
    let price: number | null = null;
    let priceType = '';
    if (l.price?.rentTotal?.min) {
      price = l.price.rentTotal.min;
      priceType = 'rent';
    } else if (l.price?.salePrice?.min) {
      price = l.price.salePrice.min;
      priceType = 'sale';
    } else if (l.basePrice?.rentTotal?.min) {
      price = l.basePrice.rentTotal.min;
      priceType = 'rent';
    } else if (l.basePrice?.salePrice?.min) {
      price = l.basePrice.salePrice.min;
      priceType = 'sale';
    }
    
    listings.push({
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
    });
  }
  
  return {
    listings,
    total: searchResults.listingsTotal || 0,
  };
}

async function fetchAllPages(baseUrl: string, type: string, property: string): Promise<EVListing[]> {
  const allListings: EVListing[] = [];
  const seenIds = new Set<string>();
  
  let page = 1;
  let totalPages = 1;
  
  while (page <= totalPages && page <= 200) {  // Max 200 pages (7000 listings)
    const url = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
    
    try {
      const data = await extractNextData(url);
      const { listings, total } = parseListings(data);
      
      if (page === 1) {
        totalPages = Math.ceil(total / 35);  // 35 per page
        console.log(`   📊 ${type}/${property}: ${total} total listings (${totalPages} pages)`);
      }
      
      for (const listing of listings) {
        if (!seenIds.has(listing.id)) {
          seenIds.add(listing.id);
          allListings.push(listing);
        }
      }
      
      if (listings.length === 0) break;
      
      // Progress every 10 pages
      if (page % 10 === 0) {
        console.log(`   📄 Page ${page}/${totalPages} (${allListings.length} listings so far)`);
      }
      
      page++;
      
      // Small delay to be nice
      await new Promise(r => setTimeout(r, 300));
      
    } catch (err: any) {
      console.log(`   ⚠️ Page ${page} error: ${err.message}`);
      break;
    }
  }
  
  return allListings;
}

async function main() {
  console.log('🏠 ENGEL & VÖLKERS SPAIN HARVEST\n');
  console.log('Extracting listings directly from search pages...\n');
  
  const allListings: EVListing[] = [];
  const seenIds = new Set<string>();
  
  for (const { url, type, property } of SEARCH_URLS) {
    console.log(`📥 Fetching ${type}/${property}...`);
    
    try {
      const listings = await fetchAllPages(url, type, property);
      
      for (const listing of listings) {
        if (!seenIds.has(listing.id)) {
          seenIds.add(listing.id);
          allListings.push(listing);
        }
      }
      
      console.log(`   ✅ Got ${listings.length} unique listings\n`);
      
    } catch (err: any) {
      console.log(`   ❌ Error: ${err.message}\n`);
    }
  }
  
  // Summary
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const rentCount = allListings.filter(l => l.marketingType === 'rent').length;
  const saleCount = allListings.filter(l => l.marketingType === 'sale').length;
  
  console.log(`
📊 TOTAL UNIQUE LISTINGS: ${allListings.length}
   🏠 For Rent: ${rentCount}
   💰 For Sale: ${saleCount}

📍 BY REGION:
${Array.from(new Set(allListings.map(l => l.region))).sort().map(r => {
  const count = allListings.filter(l => l.region === r).length;
  return `   ${r}: ${count}`;
}).join('\n')}

🏢 BY AGENCY (top 10):
${Object.entries(
  allListings.reduce((acc, l) => {
    acc[l.shopName] = (acc[l.shopName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>)
).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => `   ${name}: ${count}`).join('\n')}
`);

  // Sample listings
  console.log('=== SAMPLE LISTINGS ===\n');
  for (const l of allListings.slice(0, 5)) {
    console.log(`${l.displayId}: ${l.title.substring(0, 50)}...`);
    console.log(`   💰 €${l.price?.toLocaleString() || 'N/A'} (${l.priceType})`);
    console.log(`   🛏️ ${l.bedrooms || 'N/A'} beds | 🚿 ${l.bathrooms || 'N/A'} baths | 📐 ${l.totalSurface || 'N/A'}m²`);
    console.log(`   📍 ${l.city}, ${l.region}`);
    console.log(`   🔗 ${l.url}`);
    console.log();
  }

  // Save to JSON
  const fs = await import('fs/promises');
  const outputPath = '/Users/peterneyra/puedo_casa/data/ev-listings.json';
  await fs.writeFile(outputPath, JSON.stringify(allListings, null, 2));
  console.log(`💾 Saved to ${outputPath}`);
}

main().catch(console.error);

