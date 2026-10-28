/**
 * Local test script for donpiso harvest
 * 
 * Tests the parsing logic against a few real URLs
 * 
 * Usage: npx tsx scripts/dp-harvest-test.ts
 */

const SITEMAP_URL = 'https://www.donpiso.com/sitemap.xml';
const REQUEST_DELAY_MS = 500;

interface DPListing {
  id: string;
  url: string;
  propertyType: string;
  listingType: string;
  price: number | null;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqm: number | null;
  description: string;
  addressLocality: string;
  addressRegion: string;
  addressCountry: string;
  neighborhood: string;
  lat: number | null;
  lng: number | null;
  imageUrls: string[];
  amenities: string[];
  agencyPhone: string;
  agencyEmail: string;
  harvestedAt: string;
}

async function fetchSitemap(): Promise<string[]> {
  console.log('Fetching sitemap...');
  
  const response = await fetch(SITEMAP_URL, {
    headers: { 'User-Agent': 'PuedoCasa/1.0 (property aggregator)' }
  });
  
  if (!response.ok) {
    throw new Error(`Sitemap fetch failed: ${response.status}`);
  }
  
  const xml = await response.text();
  
  const listPageUrls: string[] = [];
  const locRegex = /<loc>([^<]+\/listado)<\/loc>/g;
  let match;
  
  while ((match = locRegex.exec(xml)) !== null) {
    listPageUrls.push(match[1]);
  }
  
  console.log(`Found ${listPageUrls.length} list pages in sitemap`);
  return listPageUrls;
}

async function fetchListingUrlsFromListPage(listPageUrl: string): Promise<string[]> {
  const response = await fetch(listPageUrl, {
    headers: { 'User-Agent': 'PuedoCasa/1.0 (property aggregator)' }
  });
  
  if (!response.ok) {
    console.warn(`List page fetch failed: ${listPageUrl} - ${response.status}`);
    return [];
  }
  
  const html = await response.text();
  
  const listingUrls: string[] = [];
  const urlRegex = /href="(https:\/\/www\.donpiso\.com\/pisos-y-casas\/(\d+)[^"]*?)"/g;
  let match;
  const seen = new Set<string>();
  
  while ((match = urlRegex.exec(html)) !== null) {
    const listingId = match[2];
    if (!seen.has(listingId)) {
      seen.add(listingId);
      listingUrls.push(`https://www.donpiso.com/pisos-y-casas/${listingId}`);
    }
  }
  
  return listingUrls;
}

function parseListingHtml(url: string, html: string): DPListing | null {
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">\s*(\{[\s\S]*?"@type"[\s\S]*?\})\s*<\/script>/);
  
  if (!jsonLdMatch) {
    console.warn(`No JSON-LD found: ${url}`);
    return null;
  }
  
  let jsonLd: any;
  try {
    jsonLd = JSON.parse(jsonLdMatch[1]);
  } catch (e) {
    console.warn(`Invalid JSON-LD: ${url}`);
    return null;
  }
  
  const types = Array.isArray(jsonLd['@type']) ? jsonLd['@type'] : [jsonLd['@type']];
  if (!types.some((t: string) => t.includes('Product') || t.includes('Residence'))) {
    return null;
  }
  
  const id = jsonLd.productID || url.match(/\/pisos-y-casas\/(\d+)/)?.[1] || '';
  if (!id) return null;
  
  const listingType = url.includes('alquiler') ? 'rent' : 'sale';
  
  let propertyType = 'Piso';
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1].toLowerCase();
    if (title.includes('apartamento')) propertyType = 'Apartamento';
    else if (title.includes('casa') || title.includes('chalet')) propertyType = 'Casa';
    else if (title.includes('ático')) propertyType = 'Ático';
    else if (title.includes('dúplex')) propertyType = 'Dúplex';
  }
  
  const price = jsonLd.offers?.price ? parseFloat(jsonLd.offers.price) : null;
  const currency = jsonLd.offers?.priceCurrency || 'EUR';
  
  const lat = jsonLd.geo?.latitude ? parseFloat(jsonLd.geo.latitude) : null;
  const lng = jsonLd.geo?.longitude ? parseFloat(jsonLd.geo.longitude) : null;
  
  const addressLocality = jsonLd.address?.addressLocality || '';
  const addressRegion = jsonLd.address?.addressRegion || '';
  const addressCountry = jsonLd.address?.addressCountry || 'Spain';
  
  let neighborhood = '';
  const neighborhoodMatch = html.match(/Collblanc-Torrassa|Sant Andreu|Eixample|Gràcia|[A-Z][a-záéíóúñ]+(?:-[A-Z][a-záéíóúñ]+)+/);
  if (neighborhoodMatch) {
    neighborhood = neighborhoodMatch[0];
  }
  
  const bedrooms = jsonLd.numberOfRooms ? parseInt(jsonLd.numberOfRooms) : null;
  
  let bathrooms: number | null = null;
  const bathroomMatch = html.match(/(\d+)\s*Baño/i);
  if (bathroomMatch) {
    bathrooms = parseInt(bathroomMatch[1]);
  }
  
  let sqm: number | null = null;
  const areaMatch = html.match(/(\d+)\s*m²/);
  if (areaMatch) {
    sqm = parseInt(areaMatch[1]);
  }
  
  let description = jsonLd.description || '';
  const descMatch = html.match(/<div class="detail-block__text">\s*([\s\S]*?)\s*<\/div>/);
  if (descMatch) {
    description = descMatch[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
  }
  
  const imageUrls: string[] = [];
  const photoRegex = /data-src="(https:\/\/www\.donpiso\.com\/[^"]+(?:nfoto|gfoto)[^"]+\.jpg)"/g;
  let photoMatch;
  const seenPhotos = new Set<string>();
  
  while ((photoMatch = photoRegex.exec(html)) !== null) {
    const photoUrl = photoMatch[1];
    if (!seenPhotos.has(photoUrl)) {
      seenPhotos.add(photoUrl);
      imageUrls.push(photoUrl);
    }
  }
  
  const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (ogImageMatch && !seenPhotos.has(ogImageMatch[1])) {
    imageUrls.unshift(ogImageMatch[1]);
  }
  
  const amenities: string[] = [];
  const amenityRegex = /<li class="col-[^"]*">([^<]+)<\/li>/g;
  let amenityMatch;
  
  while ((amenityMatch = amenityRegex.exec(html)) !== null) {
    const amenity = amenityMatch[1].trim();
    if (amenity && !amenity.match(/^\d+\s*(m²|hab|Baño)/i)) {
      amenities.push(amenity);
    }
  }
  
  const agencyPhone = jsonLd.brand?.contactPoint?.telephone || '';
  const agencyEmail = jsonLd.brand?.contactPoint?.email || '';
  
  return {
    id,
    url,
    propertyType,
    listingType,
    price,
    currency,
    bedrooms,
    bathrooms,
    sqm,
    description,
    addressLocality,
    addressRegion,
    addressCountry,
    neighborhood,
    lat,
    lng,
    imageUrls,
    amenities,
    agencyPhone,
    agencyEmail,
    harvestedAt: new Date().toISOString(),
  };
}

async function fetchAndParseListing(url: string): Promise<DPListing | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'PuedoCasa/1.0 (property aggregator)' }
    });
    
    if (!response.ok) {
      console.warn(`Listing fetch failed: ${url} - ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    return parseListingHtml(url, html);
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

async function main() {
  console.log('=== donpiso Harvest Test ===\n');
  
  // Step 1: Get list pages from sitemap
  const listPageUrls = await fetchSitemap();
  
  // Step 2: Get a sample of list pages
  const sampleListPages = listPageUrls.slice(0, 3);
  console.log(`\nSample list pages: ${sampleListPages.join('\n  ')}\n`);
  
  // Step 3: Get listings from first list page
  await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
  const listingUrls = await fetchListingUrlsFromListPage(sampleListPages[0]);
  console.log(`\nFound ${listingUrls.length} listings on ${sampleListPages[0]}`);
  console.log(`Sample listing URLs:\n  ${listingUrls.slice(0, 5).join('\n  ')}\n`);
  
  // Step 4: Parse a few listings
  const listings: DPListing[] = [];
  const sampleListingUrls = listingUrls.slice(0, 3);
  
  for (const url of sampleListingUrls) {
    console.log(`Fetching: ${url}`);
    await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
    const listing = await fetchAndParseListing(url);
    if (listing) {
      listings.push(listing);
      console.log(`  ✅ Parsed: ${listing.propertyType} in ${listing.addressLocality}`);
      console.log(`     Price: ${listing.price?.toLocaleString()} ${listing.currency}`);
      console.log(`     Location: ${listing.lat}, ${listing.lng}`);
      console.log(`     Size: ${listing.sqm}m², ${listing.bedrooms} bed, ${listing.bathrooms} bath`);
      console.log(`     Photos: ${listing.imageUrls.length}`);
      console.log(`     Amenities: ${listing.amenities.slice(0, 5).join(', ')}`);
    } else {
      console.log(`  ❌ Failed to parse`);
    }
  }
  
  console.log('\n=== Sample Listing Data ===\n');
  if (listings.length > 0) {
    console.log(JSON.stringify(listings[0], null, 2));
  }
  
  console.log('\n=== Summary ===');
  console.log(`List pages in sitemap: ${listPageUrls.length}`);
  console.log(`Estimated listings: ~${listPageUrls.length * 15} (avg 15 per page)`);
  console.log(`Sample parsed successfully: ${listings.length}/${sampleListingUrls.length}`);
  console.log(`Has coordinates: ${listings.filter(l => l.lat && l.lng).length}/${listings.length}`);
}

main().catch(console.error);

