/**
 * ENGEL & VÖLKERS DAILY DELTA HARVEST
 * 
 * Fetches newest listings from each category (sorted by PUBLISHED_AT_DESC).
 * Stops when encountering known listings. Run 3x daily.
 * 
 * NOW WITH DETAIL PAGE ENRICHMENT:
 * - Fetches detail pages for new listings to get amenities, coordinates, all photos
 * 
 * Usage: npx tsx scripts/ev-daily-delta.ts
 * 
 * Strategy:
 * - E&V returns listings sorted by newest first by default
 * - New listings appear at TOP of each category page
 * - Fetch first page of each category (35 listings)
 * - For new listings, fetch detail page to get full data
 * - If ALL 35 are new, fetch page 2 (indicates high activity)
 * - Stop when we hit listings we already have
 * - Append only genuinely new listings to the master file
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================
// CONFIGURATION
// ============================================================

const DATA_FILE = '/Users/peterneyra/puedo_casa/data/ev-listings-deep.json';
const FALLBACK_FILE = '/Users/peterneyra/puedo_casa/data/ev-listings-full.json';
const LOG_FILE = '/Users/peterneyra/puedo_casa/logs/ev-delta.log';

const CATEGORIES = [
  { url: 'https://www.engelvoelkers.com/es/en/properties/res/sale/house', type: 'sale/house' },
  { url: 'https://www.engelvoelkers.com/es/en/properties/res/sale/apartment', type: 'sale/apartment' },
  { url: 'https://www.engelvoelkers.com/es/en/properties/res/sale/land', type: 'sale/land' },
  { url: 'https://www.engelvoelkers.com/es/en/properties/res/rent/house', type: 'rent/house' },
  { url: 'https://www.engelvoelkers.com/es/en/properties/res/rent/apartment', type: 'rent/apartment' },
];

const REQUEST_DELAY_MS = 100;

// ============================================================
// TYPES
// ============================================================

interface EVListing {
  // Core identifiers
  id: string;
  displayId: string;
  
  // Property classification
  propertyType: string;        // house, apartment, land
  marketingType: string;       // rent, sale
  businessArea: string;        // residential, commercial
  
  // Listing details
  title: string;
  price: number | null;
  priceType: string;
  currency: string;
  hasPriceOnRequest: boolean;
  
  // Rooms
  bedrooms: number | null;
  bathrooms: number | null;
  rooms: number | null;        // Total rooms
  
  // Surfaces
  totalSurface: number | null;
  livingSurface: number | null;
  plotSurface: number | null;
  
  // Location (from search page)
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
  
  // Location (from detail page)
  lat?: number | null;
  lng?: number | null;
  
  // Agency
  shopName: string;
  
  // Media
  imageIds: string[];
  allImageIds?: string[];  // From detail page (more complete)
  
  // Amenities (from detail page)
  amenities?: {
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
  
  // Description (from detail page)
  description?: string;
  locationDescription?: string;
  
  // Building details (from detail page)
  constructionYear?: number | null;
  condition?: string;
  flooring?: string[];
  heatingType?: string[];
  
  // Flags
  isNew: boolean;
  isExclusive: boolean;
  isPrivateOffice: boolean;
  isDevelopmentProject: boolean;
  
  // Meta
  url: string;
  detailUrl?: string;
  harvestedAt?: string;
  enrichedAt?: string;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

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
      console.error(`   ❌ HTTP ${response.status} for ${url}`);
      return null;
    }
    return response.text();
  } catch (error) {
    console.error(`   ❌ Fetch error: ${error}`);
    return null;
  }
}

function extractListingsFromHtml(html: string): EVListing[] {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>({.*?})<\/script>/);
  if (!match) {
    console.error('   ⚠️ No __NEXT_DATA__ found in HTML');
    return [];
  }

  try {
    const data = JSON.parse(match[1]);
    const searchResults = data?.props?.pageProps?.searchModule?.initialSearchResults;
    
    if (!searchResults?.listings) {
      console.error('   ⚠️ No listings in search results');
      return [];
    }

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
        
        // Surfaces (all in m²)
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
    }).filter(Boolean) as EVListing[];
  } catch (error) {
    console.error(`   ❌ JSON parse error: ${error}`);
    return [];
  }
}

async function loadExistingListings(): Promise<Map<string, EVListing>> {
  const listings = new Map<string, EVListing>();
  
  // Try deep harvest file first, fall back to full harvest
  let dataFile = DATA_FILE;
  try {
    await fs.access(DATA_FILE);
  } catch {
    console.log(`⚠️ Deep harvest file not found, using fallback: ${FALLBACK_FILE}`);
    dataFile = FALLBACK_FILE;
  }

  try {
    const data = await fs.readFile(dataFile, 'utf-8');
    const existingListings: EVListing[] = JSON.parse(data);
    for (const listing of existingListings) {
      listings.set(listing.id, listing);
    }
    console.log(`📂 Loaded ${listings.size} existing listings from ${path.basename(dataFile)}`);
  } catch (error) {
    console.log(`⚠️ No existing data file found, starting fresh`);
  }

  return listings;
}

async function saveListings(listings: EVListing[]): Promise<void> {
  // Ensure data directory exists
  const dir = path.dirname(DATA_FILE);
  await fs.mkdir(dir, { recursive: true });
  
  await fs.writeFile(DATA_FILE, JSON.stringify(listings, null, 2));
}

async function appendToLog(message: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  
  try {
    const dir = path.dirname(LOG_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(LOG_FILE, logEntry);
  } catch {
    // Ignore log errors
  }
}

// ============================================================
// DETAIL PAGE ENRICHMENT
// ============================================================

async function enrichFromDetailPage(listing: EVListing): Promise<EVListing> {
  const detailUrl = `https://www.engelvoelkers.com/es/en/exposes/${listing.id}`;
  listing.detailUrl = detailUrl;
  
  try {
    const html = await fetchHtml(detailUrl);
    if (!html) return listing;
    
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>({.*?})<\/script>/);
    if (!match) return listing;
    
    const data = JSON.parse(match[1]);
    const detail = data?.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data?.listing;
    if (!detail) return listing;
    
    const features = detail.features || {};
    const profile = detail.profile || {};
    
    // Coordinates
    listing.lat = detail.displayLat ?? null;
    listing.lng = detail.displayLng ?? null;
    
    // Amenities
    listing.amenities = {
      hasGarden: features.hasGarden || detail.hasGarden || false,
      hasSwimmingPool: features.hasSwimmingPool || detail.hasSwimmingPool || false,
      hasTerrace: features.hasTerrace || detail.hasTerrace || false,
      hasBalcony: features.hasBalcony || detail.hasBalcony || false,
      hasBasement: features.hasBasement || detail.hasBasement || false,
      hasBuiltInKitchen: features.hasBuiltInKitchen || detail.hasBuiltInKitchen || false,
      hasBuiltInWardrobe: features.hasBuiltInWardrobe || detail.hasBuiltInWardrobe || false,
      hasMountainView: features.hasMountainView || detail.hasMountainView || false,
      hasPatio: features.hasPatio || detail.hasPatio || false,
      hasCoveredParking: features.hasCoveredParking || false,
      isFurnished: features.isFurnished || detail.isFurnished || false,
      isPetsAllowed: features.isPetsAllowed || detail.isPetsAllowed || false,
    };
    
    // Description
    listing.description = profile.description || '';
    listing.locationDescription = profile.locationDescription || '';
    
    // Building details
    listing.constructionYear = detail.constructionYear?.min ?? null;
    listing.condition = detail.condition || '';
    listing.flooring = detail.flooring || [];
    listing.heatingType = detail.heatingType || [];
    
    // Full image list
    listing.allImageIds = detail.uploadCareImageIds || listing.imageIds;
    
    listing.enrichedAt = new Date().toISOString();
    
  } catch (error) {
    console.error(`   ⚠️ Failed to enrich ${listing.displayId}: ${error}`);
  }
  
  return listing;
}

// ============================================================
// MAIN HARVEST LOGIC
// ============================================================

async function harvestDelta(): Promise<void> {
  const startTime = Date.now();
  console.log('🏠 ENGEL & VÖLKERS DAILY DELTA HARVEST\n');
  console.log(`📅 ${new Date().toISOString()}\n`);

  // Load existing listings
  const existingListings = await loadExistingListings();
  const initialCount = existingListings.size;

  const newListings: EVListing[] = [];
  let totalChecked = 0;

  // Check each category
  for (const category of CATEGORIES) {
    console.log(`\n🔍 Checking ${category.type}...`);

    const html = await fetchHtml(category.url);
    if (!html) continue;

    const listings = extractListingsFromHtml(html);
    totalChecked += listings.length;

    let newInCategory = 0;
    let hitExisting = false;

    for (const listing of listings) {
      if (existingListings.has(listing.id)) {
        hitExisting = true;
        // Continue checking in case of reordering, but track that we hit existing
      } else {
        newListings.push(listing);
        existingListings.set(listing.id, listing);
        newInCategory++;
      }
    }

    if (newInCategory > 0) {
      console.log(`   ✅ Found ${newInCategory} new listings`);
    } else {
      console.log(`   ✅ No new listings (all ${listings.length} already known)`);
    }

    // If ALL listings were new and we didn't hit any existing, 
    // there might be more new ones on page 2 (rare case)
    if (newInCategory === listings.length && listings.length === 35 && !hitExisting) {
      console.log(`   ⚠️ All 35 were new - high activity detected (page 2 check recommended)`);
      // TODO: Could implement page 2 fetch here for high-activity periods
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
  }

  // Enrich new listings with detail page data
  if (newListings.length > 0) {
    console.log(`\n🔎 Enriching ${newListings.length} new listings with detail page data...`);
    
    let enriched = 0;
    for (const listing of newListings) {
      const enrichedListing = await enrichFromDetailPage(listing);
      existingListings.set(enrichedListing.id, enrichedListing);
      enriched++;
      
      if (enriched % 10 === 0) {
        process.stdout.write(`\r   📥 Enriched ${enriched}/${newListings.length}...`);
      }
      
      // Rate limiting for detail pages
      await new Promise(r => setTimeout(r, 300));
    }
    console.log(`\r   ✅ Enriched ${enriched}/${newListings.length} listings with full data`);
  }
  
  // Save updated listings
  if (newListings.length > 0) {
    const allListings = Array.from(existingListings.values());
    await saveListings(allListings);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const withCoords = newListings.filter(l => l.lat && l.lng).length;
    const withAmenities = newListings.filter(l => l.amenities).length;
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ DELTA HARVEST COMPLETE`);
    console.log(`${'='.repeat(50)}`);
    console.log(`   📊 New listings found: ${newListings.length}`);
    console.log(`   📊 With coordinates: ${withCoords}`);
    console.log(`   📊 With amenities: ${withAmenities}`);
    console.log(`   📊 Total listings now: ${allListings.length}`);
    console.log(`   📊 Listings checked: ${totalChecked}`);
    console.log(`   ⏱️ Time elapsed: ${elapsed}s`);
    
    await appendToLog(`Delta: +${newListings.length} new (enriched: ${withCoords} with coords) (total: ${allListings.length})`);
  } else {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ NO NEW LISTINGS`);
    console.log(`${'='.repeat(50)}`);
    console.log(`   📊 Total listings: ${initialCount}`);
    console.log(`   📊 Listings checked: ${totalChecked}`);
    console.log(`   ⏱️ Time elapsed: ${elapsed}s`);
    
    await appendToLog(`Delta: No new listings (checked ${totalChecked})`);
  }

  // Summary by region for new listings
  if (newListings.length > 0) {
    console.log(`\n📍 NEW LISTINGS BY REGION:`);
    const byRegion = newListings.reduce((acc, l) => {
      const region = l.region || 'Unknown';
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(byRegion)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([region, count]) => {
        console.log(`   ${region}: ${count}`);
      });
  }
}

// ============================================================
// ENTRY POINT
// ============================================================

harvestDelta().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

