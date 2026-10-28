/**
 * ENGEL & VÖLKERS FULL HARVEST V2
 * 
 * TWO-PHASE APPROACH:
 * Phase 1: Get all listing IDs from search result pages (SSR)
 * Phase 2: Fetch each detail page to get amenities, coordinates, full description
 * 
 * Run: npx tsx scripts/ev-full-harvest-v2.ts
 */

import * as fs from 'fs/promises';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_SEARCH_URLS = [
  'https://www.engelvoelkers.com/es/en/properties/res/sale/house',
  'https://www.engelvoelkers.com/es/en/properties/res/sale/apartment',
  'https://www.engelvoelkers.com/es/en/properties/res/rent/house',
  'https://www.engelvoelkers.com/es/en/properties/res/rent/apartment',
  'https://www.engelvoelkers.com/es/en/properties/res/sale/land',
];

const OUTPUT_PATH = '/Users/peterneyra/puedo_casa/data/ev-listings-v2.json';
const PROGRESS_PATH = '/Users/peterneyra/puedo_casa/data/ev-harvest-progress.json';
const DELAY_MS = 200; // Between requests to avoid rate limiting
const DETAIL_DELAY_MS = 300; // Slightly longer for detail pages
const MAX_DETAIL_ERRORS = 5; // Stop enriching if too many consecutive errors

// ============================================================================
// TYPES
// ============================================================================

interface EVListingBasic {
  id: string;  // UUID - used for detail page URL
  displayId: string;  // W-XXXXX - human readable
  propertyType: string;
  marketingType: string;
  title: string;
  price: number | null;
  priceType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  rooms: number | null;
  totalSurface: number | null;
  livingSurface: number | null;
  plotSurface: number | null;
  country: string;
  region: string;
  city: string;
  shopName: string;
  imageIds: string[];
  isNew: boolean;
  isExclusive: boolean;
}

interface EVListingFull extends EVListingBasic {
  // From detail page - Location
  lat: number | null;
  lng: number | null;
  
  // From detail page - Amenities
  amenities: {
    hasGarden: boolean;
    hasSwimmingPool: boolean;
    hasTerrace: boolean;
    hasBalcony: boolean;
    hasBasement: boolean;
    hasBuiltInKitchen: boolean;
    hasBuiltInWardrobe: boolean;
    hasMountainView: boolean;
    hasPatio: boolean;
    hasCoveredParking: boolean;
    isFurnished: boolean;
    isPetsAllowed: boolean;
  };
  
  // From detail page - Description
  description: string;
  locationDescription: string;
  
  // From detail page - Building details
  constructionYear: number | null;
  condition: string;
  flooring: string[];
  heatingType: string[];
  floors: number | null;
  
  // From detail page - Full image list
  allImageIds: string[];
  
  // From detail page - Agency details
  agentName: string;
  shopEmail: string;
  shopPhone: string;
  
  // Metadata
  url: string;
  detailUrl: string;
  harvestedAt: string;
  enrichedAt: string | null;
  publishedAt: string | null;
}

interface HarvestProgress {
  phase: 'search' | 'enriching' | 'complete';
  searchUrlsProcessed: string[];
  listingsEnriched: string[];  // IDs that have been enriched
  lastSaveTime: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!response.ok) {
      console.error(`   ⚠️ HTTP ${response.status} for ${url}`);
      return null;
    }
    return response.text();
  } catch (error) {
    console.error(`   ❌ Fetch error: ${error}`);
    return null;
  }
}

function extractNextData(html: string): any {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>({.*?})<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

// ============================================================================
// PHASE 1: SEARCH PAGE PARSING
// ============================================================================

function parseSearchPage(html: string): EVListingBasic[] {
  const data = extractNextData(html);
  if (!data) return [];
  
  const searchResults = data?.props?.pageProps?.searchModule?.initialSearchResults;
  if (!searchResults?.listings) return [];
  
  return searchResults.listings.map((item: any) => {
    const l = item.listing;
    if (!l) return null;
    
    // Extract address
    const addressParts = l.addressComponents || [];
    const country = addressParts.find((a: any) => a.placeType === 'country')?.text || '';
    const region = addressParts.find((a: any) => a.placeType === 'administrative_area_level_1')?.text || '';
    const city = addressParts.find((a: any) => a.placeType === 'locality')?.text || '';
    
    // Extract price
    let price: number | null = null;
    let priceType = '';
    if (l.price?.rentTotal?.min) { price = l.price.rentTotal.min; priceType = 'rent'; }
    else if (l.price?.salesPrice?.min) { price = l.price.salesPrice.min; priceType = 'sale'; }
    else if (l.price?.salePrice?.min) { price = l.price.salePrice.min; priceType = 'sale'; }
    else if (l.basePrice?.rentTotal?.min) { price = l.basePrice.rentTotal.min; priceType = 'rent'; }
    else if (l.basePrice?.salesPrice?.min) { price = l.basePrice.salesPrice.min; priceType = 'sale'; }
    else if (l.basePrice?.salePrice?.min) { price = l.basePrice.salePrice.min; priceType = 'sale'; }
    
    return {
      id: l.id,  // UUID
      displayId: l.displayId,
      propertyType: l.propertyType || '',
      marketingType: l.propertyMarketingType || l.marketingType || '',
      title: l.profile?.title || '',
      price,
      priceType,
      bedrooms: l.bedrooms?.min ?? null,
      bathrooms: l.bathrooms?.min ?? null,
      rooms: l.rooms?.min ?? null,
      totalSurface: l.area?.totalSurface?.min ?? null,
      livingSurface: l.area?.livingSurface?.min ?? null,
      plotSurface: l.area?.plotSurface?.min ?? null,
      country,
      region,
      city,
      shopName: l.shopName || '',
      imageIds: l.uploadCareImageIds || [],
      isNew: l.isNew || false,
      isExclusive: (l.imageDisturbers || []).includes('EXCLUSIVE'),
    };
  }).filter(Boolean);
}

function extractSubUrls(html: string, basePath: string): string[] {
  const regex = new RegExp(`href="(${basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]+)"`, 'g');
  const urls = new Set<string>();
  
  let match;
  while ((match = regex.exec(html)) !== null) {
    const path = match[1];
    if (path.split('/').length > basePath.split('/').length) {
      urls.add(`https://www.engelvoelkers.com${path}`);
    }
  }
  
  return Array.from(urls);
}

// ============================================================================
// PHASE 2: DETAIL PAGE PARSING
// ============================================================================

function parseDetailPage(html: string): Partial<EVListingFull> | null {
  const data = extractNextData(html);
  if (!data) return null;
  
  const listing = data?.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data?.listing;
  if (!listing) return null;
  
  const features = listing.features || {};
  const profile = listing.profile || {};
  
  return {
    // Coordinates
    lat: listing.displayLat ?? null,
    lng: listing.displayLng ?? null,
    
    // Amenities
    amenities: {
      hasGarden: features.hasGarden || listing.hasGarden || false,
      hasSwimmingPool: features.hasSwimmingPool || listing.hasSwimmingPool || false,
      hasTerrace: features.hasTerrace || listing.hasTerrace || false,
      hasBalcony: features.hasBalcony || listing.hasBalcony || false,
      hasBasement: features.hasBasement || listing.hasBasement || false,
      hasBuiltInKitchen: features.hasBuiltInKitchen || listing.hasBuiltInKitchen || false,
      hasBuiltInWardrobe: features.hasBuiltInWardrobe || listing.hasBuiltInWardrobe || false,
      hasMountainView: features.hasMountainView || listing.hasMountainView || false,
      hasPatio: features.hasPatio || listing.hasPatio || false,
      hasCoveredParking: features.hasCoveredParking || false,
      isFurnished: features.isFurnished || listing.isFurnished || false,
      isPetsAllowed: features.isPetsAllowed || listing.isPetsAllowed || false,
    },
    
    // Description
    description: profile.description || '',
    locationDescription: profile.locationDescription || '',
    
    // Building details
    constructionYear: listing.constructionYear?.min ?? null,
    condition: listing.condition || '',
    flooring: listing.flooring || [],
    heatingType: listing.heatingType || [],
    floors: listing.floors ?? null,
    
    // Full image list
    allImageIds: listing.uploadCareImageIds || [],
    
    // Agency
    agentName: listing.agent?.name || '',
    shopEmail: listing.shopEmail || '',
    shopPhone: listing.shopPhoneNumber || '',
    
    // Timestamps
    publishedAt: listing.publishedAt || null,
  };
}

// ============================================================================
// PROGRESS MANAGEMENT
// ============================================================================

async function loadProgress(): Promise<HarvestProgress> {
  try {
    const data = await fs.readFile(PROGRESS_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    return {
      phase: 'search',
      searchUrlsProcessed: [],
      listingsEnriched: [],
      lastSaveTime: new Date().toISOString(),
    };
  }
}

async function saveProgress(progress: HarvestProgress): Promise<void> {
  progress.lastSaveTime = new Date().toISOString();
  await fs.writeFile(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

async function loadExistingListings(): Promise<Map<string, EVListingFull>> {
  try {
    const data = await fs.readFile(OUTPUT_PATH, 'utf8');
    const listings: EVListingFull[] = JSON.parse(data);
    return new Map(listings.map(l => [l.id, l]));
  } catch {
    return new Map();
  }
}

async function saveListings(listings: Map<string, EVListingFull>): Promise<void> {
  const array = Array.from(listings.values());
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(array, null, 2));
}

// ============================================================================
// PHASE 1: DISCOVER ALL LISTINGS FROM SEARCH PAGES
// ============================================================================

async function phase1DiscoverListings(
  progress: HarvestProgress,
  listings: Map<string, EVListingFull>
): Promise<void> {
  console.log('\n📋 PHASE 1: Discovering listings from search pages\n');
  
  for (const baseUrl of BASE_SEARCH_URLS) {
    if (progress.searchUrlsProcessed.includes(baseUrl)) {
      console.log(`   ⏭️ Skipping ${baseUrl} (already processed)`);
      continue;
    }
    
    const path = new URL(baseUrl).pathname;
    const parts = path.split('/');
    const type = parts[4];
    const prop = parts[5];
    
    console.log(`\n🔍 ${type.toUpperCase()}/${prop.toUpperCase()}`);
    console.log('─'.repeat(50));
    
    // Discover all geo-segmented URLs
    const allUrls = new Set<string>([baseUrl]);
    const visited = new Set<string>();
    const queue = [baseUrl];
    
    while (queue.length > 0) {
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);
      
      const html = await fetchHtml(url);
      if (!html) continue;
      
      // Parse listings from this page
      const pageListings = parseSearchPage(html);
      const now = new Date().toISOString();
      
      for (const basic of pageListings) {
        if (!listings.has(basic.id)) {
          listings.set(basic.id, {
            ...basic,
            lat: null,
            lng: null,
            amenities: {
              hasGarden: false,
              hasSwimmingPool: false,
              hasTerrace: false,
              hasBalcony: false,
              hasBasement: false,
              hasBuiltInKitchen: false,
              hasBuiltInWardrobe: false,
              hasMountainView: false,
              hasPatio: false,
              hasCoveredParking: false,
              isFurnished: false,
              isPetsAllowed: false,
            },
            description: '',
            locationDescription: '',
            constructionYear: null,
            condition: '',
            flooring: [],
            heatingType: [],
            floors: null,
            allImageIds: basic.imageIds,
            agentName: '',
            shopEmail: '',
            shopPhone: '',
            url: `https://www.engelvoelkers.com/es/en/property/${basic.displayId}`,
            detailUrl: `https://www.engelvoelkers.com/es/en/exposes/${basic.id}`,
            harvestedAt: now,
            enrichedAt: null,
            publishedAt: null,
          });
        }
      }
      
      // Find sub-URLs
      const subUrls = extractSubUrls(html, path);
      for (const subUrl of subUrls) {
        if (!visited.has(subUrl)) {
          allUrls.add(subUrl);
          queue.push(subUrl);
        }
      }
      
      // Progress
      if (visited.size % 20 === 0) {
        process.stdout.write(`\r   📊 Scraped ${visited.size} URLs | ${listings.size} total listings`);
      }
      
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
    
    console.log(`\n   ✅ Discovered ${allUrls.size} URLs → ${listings.size} total listings`);
    
    progress.searchUrlsProcessed.push(baseUrl);
    await saveProgress(progress);
    await saveListings(listings);
  }
  
  progress.phase = 'enriching';
  await saveProgress(progress);
  console.log(`\n✅ Phase 1 complete: ${listings.size} listings discovered\n`);
}

// ============================================================================
// PHASE 2: ENRICH WITH DETAIL PAGE DATA
// ============================================================================

async function phase2EnrichListings(
  progress: HarvestProgress,
  listings: Map<string, EVListingFull>
): Promise<void> {
  console.log('\n🔎 PHASE 2: Enriching listings with detail page data\n');
  
  const enrichedSet = new Set(progress.listingsEnriched);
  const toEnrich = Array.from(listings.values()).filter(l => !enrichedSet.has(l.id));
  
  console.log(`   📊 ${toEnrich.length} listings to enrich (${enrichedSet.size} already done)\n`);
  
  let processed = 0;
  let enriched = 0;
  let errors = 0;
  let consecutiveErrors = 0;
  
  for (const listing of toEnrich) {
    const detailUrl = `https://www.engelvoelkers.com/es/en/exposes/${listing.id}`;
    
    const html = await fetchHtml(detailUrl);
    if (html) {
      const details = parseDetailPage(html);
      if (details) {
        // Merge detail data into listing
        Object.assign(listing, details);
        listing.enrichedAt = new Date().toISOString();
        enriched++;
        consecutiveErrors = 0;
      } else {
        errors++;
        consecutiveErrors++;
      }
    } else {
      errors++;
      consecutiveErrors++;
    }
    
    progress.listingsEnriched.push(listing.id);
    processed++;
    
    // Progress update
    if (processed % 50 === 0) {
      const pct = ((processed / toEnrich.length) * 100).toFixed(1);
      console.log(`   📥 ${processed}/${toEnrich.length} (${pct}%) | ✅ ${enriched} enriched | ❌ ${errors} errors`);
      
      // Save periodically
      await saveProgress(progress);
      await saveListings(listings);
    }
    
    // Stop if too many consecutive errors (rate limited?)
    if (consecutiveErrors >= MAX_DETAIL_ERRORS) {
      console.log(`\n   ⚠️ ${consecutiveErrors} consecutive errors - stopping to avoid rate limit`);
      break;
    }
    
    await new Promise(r => setTimeout(r, DETAIL_DELAY_MS));
  }
  
  // Final save
  await saveProgress(progress);
  await saveListings(listings);
  
  console.log(`\n✅ Phase 2 complete: ${enriched}/${processed} enriched successfully\n`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('═'.repeat(60));
  console.log('🏠 ENGEL & VÖLKERS FULL HARVEST V2');
  console.log('═'.repeat(60));
  console.log('\nTwo-phase approach:');
  console.log('  Phase 1: Discover all listings from search pages');
  console.log('  Phase 2: Enrich each listing with detail page data\n');
  
  // Load progress and existing data
  const progress = await loadProgress();
  const listings = await loadExistingListings();
  
  console.log(`📊 Current state:`);
  console.log(`   Phase: ${progress.phase}`);
  console.log(`   Listings: ${listings.size}`);
  console.log(`   Enriched: ${progress.listingsEnriched.length}`);
  
  // Phase 1: Discover listings
  if (progress.phase === 'search') {
    await phase1DiscoverListings(progress, listings);
  }
  
  // Phase 2: Enrich with detail data
  if (progress.phase === 'enriching') {
    await phase2EnrichListings(progress, listings);
  }
  
  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('HARVEST SUMMARY');
  console.log('═'.repeat(60));
  
  const listingsArray = Array.from(listings.values());
  const withCoords = listingsArray.filter(l => l.lat && l.lng).length;
  const withAmenities = listingsArray.filter(l => l.amenities && Object.values(l.amenities).some(v => v)).length;
  const withDescription = listingsArray.filter(l => l.description).length;
  
  console.log(`
📊 TOTAL LISTINGS: ${listings.size}

🎯 DATA COMPLETENESS:
   📍 With coordinates: ${withCoords} (${((withCoords/listings.size)*100).toFixed(1)}%)
   🏡 With amenities: ${withAmenities} (${((withAmenities/listings.size)*100).toFixed(1)}%)
   📝 With description: ${withDescription} (${((withDescription/listings.size)*100).toFixed(1)}%)

📂 BY TYPE:
   🏠 Sale: ${listingsArray.filter(l => l.priceType === 'sale').length}
   🔑 Rent: ${listingsArray.filter(l => l.priceType === 'rent').length}

📍 TOP REGIONS:
${Object.entries(
  listingsArray.reduce((acc, l) => {
    const r = l.region || 'Unknown';
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {} as Record<string, number>)
).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => `   ${name}: ${count}`).join('\n')}

💾 Output: ${OUTPUT_PATH}
`);
  
  // Mark complete if all enriched
  const allEnriched = progress.listingsEnriched.length >= listings.size;
  if (allEnriched) {
    progress.phase = 'complete';
    await saveProgress(progress);
    console.log('✅ All listings enriched! Harvest complete.\n');
  } else {
    console.log(`⏳ ${listings.size - progress.listingsEnriched.length} listings still need enrichment.`);
    console.log('   Run script again to continue.\n');
  }
}

main().catch(console.error);

