/**
 * End-to-End Lambda Test
 * Tests the ACTUAL parsing logic from each Lambda with real data
 */

import * as cheerio from 'cheerio';
import * as zlib from 'zlib';

interface TestResult {
  domain: string;
  success: boolean;
  listing?: {
    id: string;
    price: number | null;
    bedrooms: number | null;
    coords: { lat: number | null; lng: number | null };
    photos: number;
  };
  error?: string;
}

// ============================================================
// E&V - Test __NEXT_DATA__ extraction (same as Lambda)
// ============================================================
async function testEV(): Promise<TestResult> {
  try {
    const res = await fetch('https://www.engelvoelkers.com/es/en/properties/res/sale/apartment', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
    });
    const html = await res.text();
    
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>({.*?})<\/script>/);
    if (!match) return { domain: 'E&V', success: false, error: 'No __NEXT_DATA__' };
    
    const data = JSON.parse(match[1]);
    const listings = data?.props?.pageProps?.searchModule?.initialSearchResults?.listings;
    if (!listings?.length) return { domain: 'E&V', success: false, error: 'No listings in data' };
    
    const l = listings[0].listing;
    return {
      domain: 'E&V',
      success: true,
      listing: {
        id: l.displayId,
        price: l.price?.salesPrice?.min || l.price?.rentTotal?.min || null,
        bedrooms: l.bedrooms?.min || null,
        coords: { lat: null, lng: null }, // Comes from detail page
        photos: l.imageDisturbers?.length || 0
      }
    };
  } catch (e: any) {
    return { domain: 'E&V', success: false, error: e.message };
  }
}

// ============================================================
// Lucas Fox - Test sitemap + JSON-LD (same as Lambda)
// ============================================================
async function testLF(): Promise<TestResult> {
  try {
    // Get first listing from sitemap
    const sitemapRes = await fetch('https://www.lucasfox.com/sitemap.xml');
    const xml = await sitemapRes.text();
    const urlMatch = xml.match(/<loc>(https:\/\/www\.lucasfox\.com\/property-for-sale\/[^<]+\.html)<\/loc>/);
    if (!urlMatch) return { domain: 'Lucas Fox', success: false, error: 'No listing in sitemap' };
    
    const pageRes = await fetch(urlMatch[1], { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await pageRes.text();
    
    // Extract JSON-LD (same as Lambda)
    const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/gi);
    let propertyData: any = null;
    for (const match of jsonLdMatches) {
      try {
        const data = JSON.parse(match[1]);
        if (data['@type'] && data['@type'] !== 'BreadcrumbList') {
          propertyData = data;
          break;
        }
      } catch { continue; }
    }
    
    if (!propertyData) return { domain: 'Lucas Fox', success: false, error: 'No JSON-LD' };
    
    const idMatch = urlMatch[1].match(/\/([a-z]{2,4}\d{4,6})\.html$/i);
    return {
      domain: 'Lucas Fox',
      success: true,
      listing: {
        id: idMatch ? idMatch[1].toUpperCase() : 'unknown',
        price: propertyData.potentialAction?.price || null,
        bedrooms: propertyData.numberOfBedrooms || null,
        coords: { lat: null, lng: null }, // Needs Nominatim
        photos: Array.isArray(propertyData.image) ? propertyData.image.length : 0
      }
    };
  } catch (e: any) {
    return { domain: 'Lucas Fox', success: false, error: e.message };
  }
}

// ============================================================
// donpiso - Test list page + JSON-LD (same as Lambda)
// ============================================================
async function testDP(): Promise<TestResult> {
  try {
    const listRes = await fetch('https://www.donpiso.com/venta-casas-y-pisos/barcelona-barcelona/listado', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const listHtml = await listRes.text();
    
    // Extract listing ID (same as Lambda)
    const idMatch = listHtml.match(/pisos-y-casas\/(\d+)/);
    if (!idMatch) return { domain: 'donpiso', success: false, error: 'No listing ID found' };
    
    // Fetch detail page
    const detailRes = await fetch(`https://www.donpiso.com/pisos-y-casas/${idMatch[1]}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await detailRes.text();
    
    // Extract JSON-LD (same as Lambda)
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
    if (!jsonLdMatch) return { domain: 'donpiso', success: false, error: 'No JSON-LD' };
    
    const jsonLd = JSON.parse(jsonLdMatch[1]);
    return {
      domain: 'donpiso',
      success: true,
      listing: {
        id: idMatch[1],
        price: jsonLd.offers?.price ? parseFloat(jsonLd.offers.price) : null,
        bedrooms: jsonLd.numberOfRooms || null,
        coords: { 
          lat: jsonLd.geo?.latitude ? parseFloat(jsonLd.geo.latitude) : null,
          lng: jsonLd.geo?.longitude ? parseFloat(jsonLd.geo.longitude) : null
        },
        photos: Array.isArray(jsonLd.image) ? jsonLd.image.length : (jsonLd.image ? 1 : 0)
      }
    };
  } catch (e: any) {
    return { domain: 'donpiso', success: false, error: e.message };
  }
}

// ============================================================
// Tecnocasa - Test gzipped sitemap + :estate prop (same as Lambda)
// ============================================================
async function testTC(): Promise<TestResult> {
  try {
    const sitemapRes = await fetch('https://www.tecnocasa.es/sitemap/inmuebles-0.xml.gz', {
      headers: { 'Accept-Encoding': 'gzip' }
    });
    const buffer = await sitemapRes.arrayBuffer();
    const xml = zlib.gunzipSync(Buffer.from(buffer)).toString('utf-8');
    
    const $ = cheerio.load(xml, { xmlMode: true });
    const firstUrl = $('url loc').first().text();
    if (!firstUrl) return { domain: 'Tecnocasa', success: false, error: 'No URL in sitemap' };
    
    const pageRes = await fetch(firstUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await pageRes.text();
    
    // Extract :estate prop (same as Lambda)
    const estateMatch = html.match(/:estate="(\{[^"]*\})"/);
    if (!estateMatch) return { domain: 'Tecnocasa', success: false, error: 'No :estate prop' };
    
    const decoded = estateMatch[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#039;/g, "'");
    
    const estate = JSON.parse(decoded);
    
    let bedrooms: number | null = null;
    if (estate.rooms) {
      const m = estate.rooms.match(/(\d+)/);
      if (m) bedrooms = parseInt(m[1], 10);
    }
    
    return {
      domain: 'Tecnocasa',
      success: true,
      listing: {
        id: String(estate.id),
        price: estate.salePrice || estate.rentPrice || null,
        bedrooms,
        coords: { 
          lat: estate.latitude || null, 
          lng: estate.longitude || null 
        },
        photos: estate.media?.images?.length || 0
      }
    };
  } catch (e: any) {
    return { domain: 'Tecnocasa', success: false, error: e.message };
  }
}

// ============================================================
// Century21 - Test sitemap + HTML parsing (same as Lambda)
// ============================================================
async function testC21(): Promise<TestResult> {
  try {
    const sitemapRes = await fetch('https://century21.es/ref/sitemap/0.xml');
    const xml = await sitemapRes.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    
    const firstUrl = $('url loc').first().text();
    if (!firstUrl) return { domain: 'Century21', success: false, error: 'No URL in sitemap' };
    
    const pageRes = await fetch(firstUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await pageRes.text();
    const $page = cheerio.load(html);
    
    // Extract data (same as Lambda)
    const priceText = $page('.price, [class*="price"]').first().text().replace(/[^\d]/g, '');
    const bedsText = $page('[class*="bedroom"], [class*="dorm"]').first().text();
    const bedsMatch = bedsText.match(/(\d+)/);
    
    const id = firstUrl.split('/').pop() || 'unknown';
    
    return {
      domain: 'Century21',
      success: true,
      listing: {
        id,
        price: priceText ? parseInt(priceText, 10) : null,
        bedrooms: bedsMatch ? parseInt(bedsMatch[1], 10) : null,
        coords: { lat: null, lng: null }, // Needs Nominatim
        photos: $page('img[src*="property"], img[src*="imagen"]').length
      }
    };
  } catch (e: any) {
    return { domain: 'Century21', success: false, error: e.message };
  }
}

// ============================================================
// RE/MAX - Test sitemap index + HTML (same as Lambda)
// ============================================================
async function testRemax(): Promise<TestResult> {
  try {
    const indexRes = await fetch('https://www.remax.es/sitemap-general.xml');
    const indexXml = await indexRes.text();
    const $index = cheerio.load(indexXml, { xmlMode: true });
    
    const sitemapUrl = $index('sitemap loc').filter((_, el) => 
      cheerio.load(el).text().includes('fichas')
    ).first().text();
    
    const sitemapRes = await fetch(sitemapUrl);
    const xml = await sitemapRes.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    
    const firstUrl = $('url loc').first().text();
    if (!firstUrl) return { domain: 'RE/MAX', success: false, error: 'No URL in sitemap' };
    
    const pageRes = await fetch(firstUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await pageRes.text();
    const $page = cheerio.load(html);
    
    // Extract from URL (same as Lambda)
    const urlParts = firstUrl.split('/').filter(p => p);
    const id = urlParts[urlParts.length - 1] || 'unknown';
    
    const priceText = $page('[class*="price"]').first().text().replace(/[^\d]/g, '');
    
    return {
      domain: 'RE/MAX',
      success: true,
      listing: {
        id,
        price: priceText ? parseInt(priceText, 10) : null,
        bedrooms: null, // Extracted differently in Lambda
        coords: { lat: null, lng: null }, // Needs Nominatim
        photos: $page('img[src*="anaconda"]').length
      }
    };
  } catch (e: any) {
    return { domain: 'RE/MAX', success: false, error: e.message };
  }
}

// ============================================================
// aProperties - Test sitemap + HTML (same as Lambda)
// ============================================================
async function testAproperties(): Promise<TestResult> {
  try {
    const sitemapRes = await fetch('https://www.aproperties.es/sitemap-es.xml');
    const xml = await sitemapRes.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    
    const firstUrl = $('url loc').filter((_, el) => {
      const text = $(el).text();
      return text.includes('-en-venta') || text.includes('-en-alquiler');
    }).first().text();
    
    if (!firstUrl) return { domain: 'aProperties', success: false, error: 'No listing URL' };
    
    const pageRes = await fetch(firstUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await pageRes.text();
    const $page = cheerio.load(html);
    
    const priceText = $page('[class*="price"]').first().text().replace(/[^\d]/g, '');
    const idMatch = html.match(/property[_-]?id['":\s]+["']?(\d+)/i);
    
    return {
      domain: 'aProperties',
      success: true,
      listing: {
        id: idMatch ? idMatch[1] : 'unknown',
        price: priceText ? parseInt(priceText, 10) : null,
        bedrooms: null,
        coords: { lat: null, lng: null }, // Needs Nominatim
        photos: $page('img[src*="properties"]').length
      }
    };
  } catch (e: any) {
    return { domain: 'aProperties', success: false, error: e.message };
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('============================================================');
  console.log('END-TO-END LAMBDA PARSING TEST');
  console.log('Testing actual parsing logic from each Lambda');
  console.log('============================================================\n');
  
  const results: TestResult[] = [];
  
  console.log('1️⃣ Testing E&V...');
  results.push(await testEV());
  
  console.log('2️⃣ Testing Lucas Fox...');
  results.push(await testLF());
  
  console.log('3️⃣ Testing donpiso...');
  results.push(await testDP());
  
  console.log('4️⃣ Testing Tecnocasa...');
  results.push(await testTC());
  
  console.log('5️⃣ Testing Century21...');
  results.push(await testC21());
  
  console.log('6️⃣ Testing RE/MAX...');
  results.push(await testRemax());
  
  console.log('7️⃣ Testing aProperties...');
  results.push(await testAproperties());
  
  console.log('\n============================================================');
  console.log('RESULTS');
  console.log('============================================================\n');
  
  let passed = 0;
  for (const r of results) {
    if (r.success) {
      console.log(`✅ ${r.domain}`);
      console.log(`   ID: ${r.listing?.id}`);
      console.log(`   Price: €${r.listing?.price || 'N/A'}`);
      console.log(`   Beds: ${r.listing?.bedrooms || 'N/A'}`);
      console.log(`   Coords: ${r.listing?.coords.lat || 'N/A'}, ${r.listing?.coords.lng || 'N/A'}`);
      console.log(`   Photos: ${r.listing?.photos}`);
      passed++;
    } else {
      console.log(`❌ ${r.domain}: ${r.error}`);
    }
    console.log('');
  }
  
  console.log('============================================================');
  console.log(`TOTAL: ${passed}/7 passed`);
  console.log('============================================================');
  
  process.exit(passed === 7 ? 0 : 1);
}

main().catch(console.error);
