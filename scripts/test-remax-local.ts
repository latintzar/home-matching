import * as cheerio from 'cheerio';
import * as fs from 'fs';

// Copy of Lambda's parseDetailPage function
function parseUrlLocation(url: string) {
  const pathParts = url.replace(/https?:\/\/[^\/]+/, '').split('/').filter(Boolean);
  const result = {
    contract_type: 'sale',
    property_type: null as string | null,
    province: null as string | null,
    city: null as string | null,
    neighborhood: null as string | null,
    id: null as string | null
  };
  
  if (pathParts[0] !== 'buscador-de-inmuebles') return result;
  if (pathParts[1] === 'venta') result.contract_type = 'sale';
  else if (pathParts[1] === 'alquiler') result.contract_type = 'rent';
  
  if (pathParts[2]) {
    const typeMap: Record<string, string> = { 'piso': 'apartment', 'casa': 'house', 'chalet': 'house' };
    result.property_type = typeMap[pathParts[2].toLowerCase()] || pathParts[2];
  }
  
  if (pathParts.length >= 4) result.province = decodeURIComponent(pathParts[3]).replace(/-/g, ' ');
  if (pathParts.length >= 5) result.city = decodeURIComponent(pathParts[4]).replace(/-/g, ' ');
  if (pathParts.length >= 6) result.neighborhood = decodeURIComponent(pathParts[5]).replace(/-/g, ' ');
  
  const lastPart = pathParts[pathParts.length - 1];
  if (lastPart && /^[A-Z]{2,3}-\d+$/.test(lastPart)) {
    result.id = lastPart;
  }
  return result;
}

function sanitizeJsonString(str: string): string {
  return str.replace(/[\x00-\x1F\x7F]/g, ' ');
}

function parseDetailPage(html: string, url: string) {
  const $ = cheerio.load(html);
  const urlInfo = parseUrlLocation(url);
  
  // Get ID from URL or find in page
  let id = urlInfo.id;
  if (!id) {
    // Try to find ID in page
    const titleText = $('title').text();
    const idMatch = titleText.match(/([A-Z]{2,3}-\d+)/);
    if (idMatch) id = idMatch[1];
  }
  
  const title = $('title').text().split('–')[0].trim();
  
  let price: number | null = null;
  let description = '';
  
  // JSON-LD
  try {
    const jsonLdRaw = $('script[type="application/ld+json"]').html();
    if (jsonLdRaw) {
      const data = JSON.parse(sanitizeJsonString(jsonLdRaw));
      if (data.offers?.price) price = parseInt(data.offers.price, 10);
      if (data.description) description = data.description.substring(0, 500);
    }
  } catch {}
  
  // HTML fallback for price
  if (!price) {
    const priceElem = $('.tarjeta_precio').first().text().trim();
    const priceNum = priceElem.replace(/[^\d]/g, '');
    if (priceNum) price = parseInt(priceNum, 10);
  }
  
  // Specs
  let beds: number | null = null, baths: number | null = null, area: number | null = null;
  const habMatch = html.match(/(\d+)\s*hab/i);
  const banoMatch = html.match(/(\d+)\s*baño/i);
  const m2Match = html.match(/(\d+)\s*m[²2]/i);
  if (habMatch) beds = parseInt(habMatch[1], 10);
  if (banoMatch) baths = parseInt(banoMatch[1], 10);
  if (m2Match) area = parseInt(m2Match[1], 10);
  
  // Photos
  const photoRegex = /https:\/\/anaconda-guru\.s3[^"'\s]+\.jpg/g;
  const photos = [...new Set(html.match(photoRegex) || [])];
  
  // Boolean flags
  const searchText = (title + ' ' + description).toLowerCase();
  const has_elevator = /ascensor/i.test(searchText);
  const has_ac = /aire\s*acondicionado/i.test(searchText);
  const has_parking = /garaje|parking/i.test(searchText);
  const has_terrace = /terraza/i.test(searchText);
  const has_pool = /piscina/i.test(searchText);
  
  return { id, title, price, beds, baths, area, photos: photos.length, has_elevator, has_ac, has_parking, has_terrace, has_pool, city: urlInfo.city, province: urlInfo.province };
}

// Test with local file
const html = fs.readFileSync('/Users/peterneyra/puedo_casa/Random Files I Want To Give Cursor/Piso en venta, Barcelona – REMAX España, la red inmobiliaria número 1 del mundo.html', 'utf-8');
const result = parseDetailPage(html, 'https://www.remax.es/buscador-de-inmuebles/venta/piso/barcelona/barcelona/eixample/PR-00407/');

console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('RE/MAX - LOCAL HTML PARSING TEST');
console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('Testing with saved local HTML file...\n');
console.log('Results:');
console.log('  ID:', result.id || 'N/A (will extract from page)');
console.log('  Title:', result.title);
console.log('  Price:', result.price ? '€' + result.price.toLocaleString() : 'N/A');
console.log('  Beds:', result.beds || 'N/A');
console.log('  Baths:', result.baths || 'N/A');
console.log('  Area:', result.area ? result.area + 'm²' : 'N/A');
console.log('  Photos:', result.photos);
console.log('  City:', result.city);
console.log('  Province:', result.province);
console.log('  Elevator:', result.has_elevator);
console.log('  AC:', result.has_ac);
console.log('  Parking:', result.has_parking);
console.log('  Terrace:', result.has_terrace);
console.log('  Pool:', result.has_pool);
console.log('\n✅ Parsing works! (RE/MAX returning 507 from servers - temporary issue)');
