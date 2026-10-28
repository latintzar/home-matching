/**
 * Audit "Unknown" URLs to determine what they actually are
 * 
 * Goal: Sample unknown URLs from high-unknown domains and categorize them
 */

import * as fs from 'fs';
import * as path from 'path';

// Load the census data
const censusPath = path.join(process.cwd(), 'data', 'full_listing_census.json');
const census = JSON.parse(fs.readFileSync(censusPath, 'utf-8'));

// Patterns that indicate NON-listing pages
const NON_LISTING_PATTERNS = [
  /\/blog\//i,
  /\/noticias\//i,
  /\/news\//i,
  /\/contacto/i,
  /\/contact/i,
  /\/about/i,
  /\/sobre-nosotros/i,
  /\/quienes-somos/i,
  /\/servicios/i,
  /\/services/i,
  /\/legal/i,
  /\/privacy/i,
  /\/terms/i,
  /\/cookies/i,
  /\/aviso-legal/i,
  /\/politica/i,
  /\/faq/i,
  /\/team/i,
  /\/equipo/i,
  /\/agents?\.xml/i,
  /\/searches?\.xml/i,
  /\/search\//i,
  /\/buscar/i,
  /sitemap/i,
];

// Patterns that strongly indicate LISTING pages
const LISTING_PATTERNS = [
  /\/inmueble\//i,
  /\/propiedad\//i,
  /\/property\//i,
  /\/anuncio\//i,
  /\/ficha\//i,
  /\/detalle\//i,
  /\/ref[-_]?\d+/i,
  /\/id[-_]?\d+/i,
  /\/\d{5,10}(?:\/|\.html?|$)/i,  // Numeric IDs
  /piso|apartamento|casa|chalet|local|garaje|terreno|nave/i,
  /apartment|house|flat|villa|studio/i,
];

// Patterns that indicate SALE even without /venta/
const SALE_EMBEDDED_PATTERNS = [
  /[-_]venta[-_]/i,
  /[-_]en[-_]venta/i,
  /-venta\//i,
  /venta-/i,
  /comprar[-_]/i,
  /[-_]sale[-_]/i,
  /-for-sale/i,
];

// Patterns that indicate RENT even without /alquiler/
const RENT_EMBEDDED_PATTERNS = [
  /[-_]alquiler[-_]/i,
  /[-_]en[-_]alquiler/i,
  /-alquiler\//i,
  /alquiler-/i,
  /arrendar[-_]/i,
  /[-_]rent[-_]/i,
  /-for-rent/i,
];

interface UrlAnalysis {
  url: string;
  isListing: boolean;
  listingType: 'sale' | 'rent' | 'unknown';
  reason: string;
}

function analyzeUrl(url: string): UrlAnalysis {
  // Check if it's a non-listing page
  for (const pattern of NON_LISTING_PATTERNS) {
    if (pattern.test(url)) {
      return { url, isListing: false, listingType: 'unknown', reason: `Non-listing: ${pattern.source}` };
    }
  }
  
  // Check embedded sale patterns
  for (const pattern of SALE_EMBEDDED_PATTERNS) {
    if (pattern.test(url)) {
      return { url, isListing: true, listingType: 'sale', reason: `Embedded sale: ${pattern.source}` };
    }
  }
  
  // Check embedded rent patterns
  for (const pattern of RENT_EMBEDDED_PATTERNS) {
    if (pattern.test(url)) {
      return { url, isListing: true, listingType: 'rent', reason: `Embedded rent: ${pattern.source}` };
    }
  }
  
  // Check if it looks like a listing
  for (const pattern of LISTING_PATTERNS) {
    if (pattern.test(url)) {
      return { url, isListing: true, listingType: 'unknown', reason: `Listing pattern: ${pattern.source}` };
    }
  }
  
  return { url, isListing: false, listingType: 'unknown', reason: 'No recognizable pattern' };
}

async function fetchSitemapUrls(domain: string, limit: number = 50): Promise<string[]> {
  const urls: string[] = [];
  
  try {
    // Try common sitemap locations
    const sitemapUrls = [
      `https://www.${domain}/sitemap.xml`,
      `https://${domain}/sitemap.xml`,
      `https://www.${domain}/sitemap_index.xml`,
    ];
    
    for (const sitemapUrl of sitemapUrls) {
      try {
        const response = await fetch(sitemapUrl, { 
          signal: AbortSignal.timeout(10000),
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PuedoCasa/1.0)' }
        });
        if (!response.ok) continue;
        
        const text = await response.text();
        
        // Extract URLs from sitemap
        const locMatches = text.matchAll(/<loc>([^<]+)<\/loc>/gi);
        for (const match of locMatches) {
          const loc = match[1];
          
          // If it's a sitemap index, we need to go deeper
          if (loc.includes('.xml')) {
            try {
              const subResponse = await fetch(loc, { 
                signal: AbortSignal.timeout(10000),
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PuedoCasa/1.0)' }
              });
              if (subResponse.ok) {
                let subText = await subResponse.text();
                
                // Handle gzipped sitemaps
                if (loc.endsWith('.gz')) {
                  // Skip gzipped for now
                  continue;
                }
                
                const subMatches = subText.matchAll(/<loc>([^<]+)<\/loc>/gi);
                for (const subMatch of subMatches) {
                  if (!subMatch[1].includes('.xml')) {
                    urls.push(subMatch[1]);
                    if (urls.length >= limit) return urls;
                  }
                }
              }
            } catch (e) {
              // Skip this sub-sitemap
            }
          } else {
            urls.push(loc);
            if (urls.length >= limit) return urls;
          }
        }
        
        if (urls.length > 0) break;
      } catch (e) {
        // Try next sitemap URL
      }
    }
  } catch (e) {
    console.error(`Failed to fetch sitemap for ${domain}:`, e);
  }
  
  return urls;
}

async function main() {
  console.log('🔍 AUDITING "UNKNOWN" URLs\n');
  console.log('Goal: Determine if unknown URLs are actually listings or other pages\n');
  
  // Find domains with high unknown counts
  const allDomains = [...(census.topDomainsBySale || []), ...(census.topDomainsByRent || [])];
  const uniqueDomains = new Map<string, any>();
  for (const d of allDomains) {
    if (!uniqueDomains.has(d.domain)) {
      uniqueDomains.set(d.domain, d);
    }
  }
  
  const highUnknown = Array.from(uniqueDomains.values())
    .filter(d => d.unknownUrls > 500)
    .sort((a, b) => b.unknownUrls - a.unknownUrls)
    .slice(0, 10);
  
  console.log(`Found ${highUnknown.length} domains with >500 unknown URLs:\n`);
  
  let totalSampled = 0;
  let totalListings = 0;
  let totalNonListings = 0;
  let missedSale = 0;
  let missedRent = 0;
  let trueUnknown = 0;
  
  for (const domain of highUnknown) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 ${domain.domain}`);
    console.log(`   Unknown URLs: ${domain.unknownUrls.toLocaleString()}`);
    console.log(`   Sale URLs: ${domain.saleUrls.toLocaleString()}`);
    console.log(`   Rent URLs: ${domain.rentUrls.toLocaleString()}`);
    
    // Fetch sample URLs
    console.log(`\n   Fetching sample URLs...`);
    const urls = await fetchSitemapUrls(domain.domain, 30);
    
    if (urls.length === 0) {
      console.log(`   ⚠️ Could not fetch sitemap URLs`);
      continue;
    }
    
    // Analyze URLs
    const analyses = urls.map(analyzeUrl);
    const listings = analyses.filter(a => a.isListing);
    const nonListings = analyses.filter(a => !a.isListing);
    const sale = analyses.filter(a => a.listingType === 'sale');
    const rent = analyses.filter(a => a.listingType === 'rent');
    const unknown = analyses.filter(a => a.isListing && a.listingType === 'unknown');
    
    totalSampled += urls.length;
    totalListings += listings.length;
    totalNonListings += nonListings.length;
    missedSale += sale.length;
    missedRent += rent.length;
    trueUnknown += unknown.length;
    
    console.log(`\n   Sample Analysis (${urls.length} URLs):`);
    console.log(`   ✅ Listings: ${listings.length} (${Math.round(listings.length/urls.length*100)}%)`);
    console.log(`   ❌ Non-listings: ${nonListings.length} (${Math.round(nonListings.length/urls.length*100)}%)`);
    console.log(`   🏠 Missed Sale: ${sale.length}`);
    console.log(`   🏢 Missed Rent: ${rent.length}`);
    console.log(`   ❓ True Unknown: ${unknown.length}`);
    
    // Show examples
    if (nonListings.length > 0) {
      console.log(`\n   Non-listing examples:`);
      for (const nl of nonListings.slice(0, 3)) {
        console.log(`     ${nl.url.slice(0, 80)}...`);
        console.log(`       Reason: ${nl.reason}`);
      }
    }
    
    if (sale.length > 0) {
      console.log(`\n   Missed SALE examples:`);
      for (const s of sale.slice(0, 3)) {
        console.log(`     ${s.url.slice(0, 80)}...`);
      }
    }
    
    if (rent.length > 0) {
      console.log(`\n   Missed RENT examples:`);
      for (const r of rent.slice(0, 3)) {
        console.log(`     ${r.url.slice(0, 80)}...`);
      }
    }
    
    if (unknown.length > 0) {
      console.log(`\n   True Unknown (listing but unclear type):`);
      for (const u of unknown.slice(0, 3)) {
        console.log(`     ${u.url.slice(0, 80)}...`);
      }
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📈 OVERALL SUMMARY\n');
  console.log(`Total URLs sampled: ${totalSampled}`);
  console.log(`\nBreakdown:`);
  console.log(`  ✅ Real Listings: ${totalListings} (${Math.round(totalListings/totalSampled*100)}%)`);
  console.log(`  ❌ Non-Listings: ${totalNonListings} (${Math.round(totalNonListings/totalSampled*100)}%)`);
  console.log(`\nAmong Listings:`);
  console.log(`  🏠 Missed Sale (our regex missed these): ${missedSale}`);
  console.log(`  🏢 Missed Rent (our regex missed these): ${missedRent}`);
  console.log(`  ❓ True Unknown (type unclear from URL): ${trueUnknown}`);
  
  console.log(`\n📊 EXTRAPOLATION:`);
  const unknownTotal = census.summary.unknownLive;
  const listingRate = totalListings / totalSampled;
  const nonListingRate = totalNonListings / totalSampled;
  const missedSaleRate = missedSale / totalSampled;
  const missedRentRate = missedRent / totalSampled;
  
  console.log(`  From ${unknownTotal.toLocaleString()} "unknown" URLs:`);
  console.log(`  - Est. Real Listings: ~${Math.round(unknownTotal * listingRate).toLocaleString()}`);
  console.log(`  - Est. Non-Listings: ~${Math.round(unknownTotal * nonListingRate).toLocaleString()}`);
  console.log(`  - Est. Missed Sales: ~${Math.round(unknownTotal * missedSaleRate).toLocaleString()}`);
  console.log(`  - Est. Missed Rentals: ~${Math.round(unknownTotal * missedRentRate).toLocaleString()}`);
}

main().catch(console.error);

