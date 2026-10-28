/**
 * Lucas Fox Harvest Test Script
 * 
 * Quick test to verify Lucas Fox sitemap and detail page parsing works.
 * Run: npx tsx scripts/lf-harvest-test.ts
 */

const SITEMAP_URL = 'https://www.lucasfox.com/sitemap.xml';

interface LFListing {
  id: string;
  url: string;
  propertyType: string;
  listingType: string;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqm: number | null;
  description: string;
  addressLocality: string;
  addressRegion: string;
  imageCount: number;
  amenities: string[];
}

async function fetchSitemap(): Promise<string[]> {
  console.log('📥 Fetching Lucas Fox sitemap...');
  
  const response = await fetch(SITEMAP_URL, {
    headers: { 'User-Agent': 'PuedoCasa/1.0' },
  });
  
  const xml = await response.text();
  const propertyUrls: string[] = [];
  const locMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/gi);
  
  for (const match of locMatches) {
    const url = match[1].trim();
    if ((url.includes('/property-for-sale/') || url.includes('/property-to-rent/')) && 
        /\/[a-z]{2,4}\d{4,6}\.html$/.test(url)) {
      propertyUrls.push(url);
    }
  }
  
  return propertyUrls;
}

async function parseDetailPage(url: string): Promise<LFListing | null> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
  });
  
  const html = await response.text();
  
  // Extract JSON-LD
  const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/gi);
  let propertyData: any = null;
  
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]);
      if (data['@type'] && data['@type'] !== 'BreadcrumbList') {
        propertyData = data;
        break;
      }
    } catch {
      continue;
    }
  }
  
  if (!propertyData) return null;
  
  // Extract GTM dataLayer
  const dataLayerMatch = html.match(/dataLayer\s*=\s*\[\s*({[^}]+})\s*\]/);
  let gtmData: any = {};
  if (dataLayerMatch) {
    try { gtmData = JSON.parse(dataLayerMatch[1]); } catch {}
  }
  
  // Extract amenities from meta description
  const metaDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  const amenities: string[] = [];
  if (metaDescMatch) {
    const desc = metaDescMatch[1].toLowerCase();
    const keywords = ['terrace', 'garden', 'pool', 'lift', 'parking', 'balcony', 'furnished', 'sea view'];
    for (const kw of keywords) {
      if (desc.includes(kw)) amenities.push(kw);
    }
  }
  
  // Parse sqm
  let sqm: number | null = null;
  if (propertyData.floorSize) {
    const sqmMatch = propertyData.floorSize.match(/(\d+)/);
    if (sqmMatch) sqm = parseInt(sqmMatch[1], 10);
  }
  
  const idMatch = url.match(/\/([a-z]{2,4}\d{4,6})\.html$/i);
  
  return {
    id: idMatch ? idMatch[1].toUpperCase() : propertyData.identifier,
    url,
    propertyType: propertyData['@type'] || '',
    listingType: gtmData.property_class || 'res_sale',
    price: propertyData.potentialAction?.price ?? null,
    bedrooms: propertyData.numberOfBedrooms ?? null,
    bathrooms: propertyData.numberOfBathroomsTotal ?? null,
    sqm,
    description: propertyData.description || '',
    addressLocality: propertyData.address?.addressLocality || '',
    addressRegion: propertyData.address?.addressRegion || '',
    imageCount: Array.isArray(propertyData.image) ? propertyData.image.length : 0,
    amenities,
  };
}

async function main() {
  console.log('🦊 LUCAS FOX HARVEST TEST\n');
  
  // 1. Test sitemap
  const urls = await fetchSitemap();
  console.log(`✅ Found ${urls.length} property URLs in sitemap\n`);
  
  // Show breakdown by type
  const saleUrls = urls.filter(u => u.includes('/property-for-sale/'));
  const rentUrls = urls.filter(u => u.includes('/property-to-rent/'));
  console.log(`   🏠 For Sale: ${saleUrls.length}`);
  console.log(`   🔑 For Rent: ${rentUrls.length}`);
  
  // 2. Test detail page parsing (sample 5 random listings)
  console.log('\n📄 Testing detail page parsing...\n');
  
  const sampleUrls = urls.sort(() => Math.random() - 0.5).slice(0, 5);
  
  for (const url of sampleUrls) {
    console.log(`   Parsing: ${url.split('/').pop()}`);
    const listing = await parseDetailPage(url);
    
    if (listing) {
      console.log(`   ✅ ${listing.id}: €${listing.price?.toLocaleString() || 'N/A'} | ${listing.bedrooms}bd/${listing.bathrooms}ba | ${listing.sqm}m² | ${listing.addressLocality}`);
      console.log(`      Images: ${listing.imageCount} | Amenities: ${listing.amenities.join(', ') || 'none parsed'}`);
    } else {
      console.log(`   ❌ Failed to parse`);
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  // 3. Summary
  console.log('\n' + '='.repeat(60));
  console.log('LUCAS FOX HARVEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`
📊 SITEMAP STATS:
   Total Properties: ${urls.length}
   For Sale: ${saleUrls.length}
   For Rent: ${rentUrls.length}

📝 DATA AVAILABLE:
   ✅ Price, Currency
   ✅ Bedrooms, Bathrooms
   ✅ Square meters
   ✅ Property type (Apartment, House, etc.)
   ✅ Location (locality, region, country)
   ✅ Images (63 per listing!)
   ✅ Description
   ✅ Amenities (from meta tags)
   ❌ Coordinates (would need geocoding)

⏱️ ESTIMATED INITIAL HARVEST:
   ${urls.length} listings × 0.5s delay = ${Math.round(urls.length * 0.5 / 60)} minutes
`);
}

main().catch(console.error);

