/**
 * Quick test: Harvest 10 listings from each domain and verify DynamoDB writes
 * 
 * This tests the full pipeline: fetch → parse → write to DynamoDB
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const TABLE = 'leo-listings';

interface TestResult {
  domain: string;
  fetched: number;
  parsed: number;
  written: number;
  verified: number;
  error?: string;
}

async function testDomain(domain: string, fetchFn: () => Promise<any[]>): Promise<TestResult> {
  const result: TestResult = { domain, fetched: 0, parsed: 0, written: 0, verified: 0 };
  
  try {
    console.log(`\n📊 Testing ${domain}...`);
    
    // Fetch listings
    const listings = await fetchFn();
    result.fetched = listings.length;
    console.log(`   Fetched: ${result.fetched}`);
    
    // Filter valid
    const valid = listings.filter(l => l && l.listing_id && l.price);
    result.parsed = valid.length;
    console.log(`   Parsed: ${result.parsed}`);
    
    // Write to DynamoDB
    for (const listing of valid.slice(0, 10)) {
      try {
        await dynamoClient.send(new PutCommand({
          TableName: TABLE,
          Item: {
            ...listing,
            _test: true,
            updated_at: new Date().toISOString(),
          },
        }));
        result.written++;
      } catch (e: any) {
        console.log(`   Write error: ${e.message}`);
      }
    }
    console.log(`   Written: ${result.written}`);
    
    // Verify
    const scan = await dynamoClient.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'contains(listing_id, :prefix)',
      ExpressionAttributeValues: { ':prefix': domain.split('.')[0] },
      Limit: 10,
    }));
    result.verified = scan.Items?.length || 0;
    console.log(`   Verified in DB: ${result.verified}`);
    
  } catch (e: any) {
    result.error = e.message;
    console.log(`   ❌ Error: ${e.message}`);
  }
  
  return result;
}

// Simple fetch helpers for each domain
async function fetchEV(): Promise<any[]> {
  const res = await fetch('https://www.engelvoelkers.com/es/en/properties/res/sale/apartment');
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return [];
  
  const data = JSON.parse(match[1]);
  const listings = data?.props?.pageProps?.searchModule?.initialSearchResults?.list || [];
  
  return listings.slice(0, 10).map((l: any) => ({
    listing_id: `ev_${l.uuid}`,
    domain: 'engelvoelkers.com',
    source: 'engelvoelkers',
    source_url: `https://www.engelvoelkers.com${l.detailPageUrl}`,
    price: l.price?.amount || 0,
    title: l.headline || '',
    location: {
      lat: l.geoLocation?.latitude,
      lng: l.geoLocation?.longitude,
      city: l.locationName,
      country: 'Spain',
    },
    property: {
      bedrooms: l.rooms,
      area_m2: l.livingSurface,
      type: 'apartment',
    },
    photos: l.images?.map((img: any) => img.url) || [],
    status: 'active',
    first_seen: new Date().toISOString(),
    last_seen: new Date().toISOString(),
  }));
}

async function fetchTC(): Promise<any[]> {
  // Tecnocasa sitemap
  const res = await fetch('https://www.tecnocasa.es/sitemap-venta-piso-barcelona.xml.gz');
  const buffer = await res.arrayBuffer();
  const zlib = require('zlib');
  const xml = zlib.gunzipSync(Buffer.from(buffer)).toString();
  
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]).slice(0, 10);
  const listings: any[] = [];
  
  for (const url of urls) {
    try {
      const pageRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const html = await pageRes.text();
      
      // Extract :estate JSON
      const estateMatch = html.match(/:estate="([^"]+)"/);
      if (estateMatch) {
        const estateJson = estateMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        const estate = JSON.parse(estateJson);
        
        listings.push({
          listing_id: `tc_${estate.ref || url.split('/').pop()}`,
          domain: 'tecnocasa.es',
          source: 'tecnocasa',
          source_url: url,
          price: estate.price || 0,
          title: estate.title || '',
          location: {
            lat: estate.latitude,
            lng: estate.longitude,
            city: estate.location?.city,
            country: 'Spain',
          },
          property: {
            bedrooms: estate.bedrooms,
            bathrooms: estate.bathrooms,
            area_m2: estate.surface,
            type: 'apartment',
          },
          photos: estate.images?.map((img: any) => img.url) || [],
          status: 'active',
          first_seen: new Date().toISOString(),
          last_seen: new Date().toISOString(),
        });
      }
    } catch (e) {
      // Skip failed URLs
    }
  }
  
  return listings;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('HARVEST TEST: 10 Listings Per Domain → DynamoDB');
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  const results: TestResult[] = [];
  
  // Test E&V (no Nominatim needed)
  results.push(await testDomain('engelvoelkers.com', fetchEV));
  
  // Test Tecnocasa (no Nominatim needed, has coords in JSON)
  results.push(await testDomain('tecnocasa.es', fetchTC));
  
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  for (const r of results) {
    const status = r.error ? '❌' : (r.verified > 0 ? '✅' : '⚠️');
    console.log(`${status} ${r.domain}: fetched=${r.fetched}, written=${r.written}, verified=${r.verified}`);
    if (r.error) console.log(`   Error: ${r.error}`);
  }
  
  // Final DynamoDB count
  const finalCount = await dynamoClient.send(new ScanCommand({
    TableName: TABLE,
    Select: 'COUNT',
  }));
  console.log(`\nTotal listings in DynamoDB: ${finalCount.Count}`);
}

main().catch(console.error);

