/**
 * END-TO-END TEST: Actually write to DynamoDB
 * Tests the FULL Lambda flow for recommender use
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import * as cheerio from 'cheerio';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const TABLE = 'leo-listings';

// Test listing data (from aProperties test)
const TEST_DOMAIN = 'aproperties.es';
const TEST_ID = 'e2e-test-38301';

async function fetchAndParse() {
  console.log('1️⃣ Fetching real listing from aProperties...');
  const url = 'https://www.aproperties.es/aguilas/casa-de-562-m2-con-terraza-aparcamiento-piscina-y-sea-views-en-venta-en-aguilas';
  
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }
  
  const html = await response.text();
  console.log(`   ✅ Fetched ${html.length.toLocaleString()} chars`);
  
  const $ = cheerio.load(html);
  
  // Parse like the Lambda does
  const photoMatch = html.match(/\/media\/properties\/(\d+)\//);
  const realId = photoMatch ? photoMatch[1] : 'unknown';
  const title = $('title').text().split('|')[0].trim();
  
  let price: number | null = null;
  const priceText = $('.propHeader__priceCurrent').first().text().trim();
  const priceNum = priceText.replace(/[^\d]/g, '');
  if (priceNum) price = parseInt(priceNum, 10);
  
  let beds: number | null = null, baths: number | null = null, area: number | null = null;
  $('.propHeader__specs__item').each((_, el) => {
    const label = $(el).find('.propHeader__specs__itemLabel').text().toLowerCase();
    const value = $(el).find('.propHeader__specs__itemValue').text().trim();
    if (/bedroom|dormitorio/.test(label)) beds = parseInt(value, 10) || null;
    if (/bathroom|baño/.test(label)) baths = parseInt(value, 10) || null;
    if (/surface|superficie|m²/.test(label)) area = parseInt(value.replace(/[^\d]/g, ''), 10) || null;
  });
  
  const description = $('meta[name="description"]').attr('content') || '';
  const searchText = (title + ' ' + description).toLowerCase();
  
  return {
    realId,
    title,
    price,
    beds,
    baths,
    area,
    has_elevator: /ascensor|elevator/i.test(searchText),
    has_ac: /aire\s*acondicionado/i.test(searchText),
    has_parking: /garaje|parking/i.test(searchText),
    has_terrace: /terraza|terrace/i.test(searchText),
    has_pool: /piscina|pool/i.test(searchText),
  };
}

async function writeToDb(parsed: any) {
  console.log('\n2️⃣ Writing to DynamoDB...');
  
  const now = new Date().toISOString();
  const item = {
    domain: TEST_DOMAIN,
    listing_id: TEST_ID,
    url: 'https://www.aproperties.es/test-e2e',
    title: parsed.title,
    price: parsed.price,
    
    location: {
      city: 'Aguilas',
      province: 'Murcia',
      country: 'Spain',
      lat: 37.4099628,
      lng: -1.5804922,
    },
    
    property: {
      type: 'house',
      bedrooms: parsed.beds,
      bathrooms: parsed.baths,
      area_m2: parsed.area,
    },
    
    // Boolean flags (DATA COMPLETENESS)
    has_elevator: parsed.has_elevator,
    has_ac: parsed.has_ac,
    has_parking: parsed.has_parking,
    has_terrace: parsed.has_terrace,
    has_pool: parsed.has_pool,
    
    // Photos
    photos: ['https://example.com/photo1.jpg'],
    photo_count: 1,
    
    // Tracking (for recommender)
    status: 'active',
    status_signal: 'in_sitemap',
    first_seen: now,
    last_seen: now,
    days_on_market: 0,
    price_history: [{ price: parsed.price, date: now.split('T')[0] }],
    
    scraped_at: now,
    updated_at: now,
    
    // E2E test marker
    _e2e_test: true,
  };
  
  await client.send(new PutCommand({
    TableName: TABLE,
    Item: item,
  }));
  
  console.log(`   ✅ Written to DynamoDB: ${TEST_DOMAIN}/${TEST_ID}`);
  return item;
}

async function readFromDb() {
  console.log('\n3️⃣ Reading back from DynamoDB...');
  
  const result = await client.send(new GetCommand({
    TableName: TABLE,
    Key: {
      domain: TEST_DOMAIN,
      listing_id: TEST_ID,
    },
  }));
  
  if (!result.Item) {
    throw new Error('Item not found in DynamoDB!');
  }
  
  console.log('   ✅ Retrieved from DynamoDB:');
  console.log(`      Domain: ${result.Item.domain}`);
  console.log(`      ID: ${result.Item.listing_id}`);
  console.log(`      Title: ${result.Item.title?.substring(0, 50)}...`);
  console.log(`      Price: €${result.Item.price?.toLocaleString()}`);
  console.log(`      Beds: ${result.Item.property?.bedrooms} | Baths: ${result.Item.property?.bathrooms} | Area: ${result.Item.property?.area_m2}m²`);
  console.log(`      Location: ${result.Item.location?.city}, ${result.Item.location?.province}`);
  console.log(`      Coords: ${result.Item.location?.lat}, ${result.Item.location?.lng}`);
  console.log(`      Status: ${result.Item.status}`);
  console.log(`      Elevator: ${result.Item.has_elevator} | AC: ${result.Item.has_ac} | Parking: ${result.Item.has_parking}`);
  console.log(`      Terrace: ${result.Item.has_terrace} | Pool: ${result.Item.has_pool}`);
  
  return result.Item;
}

async function cleanup() {
  console.log('\n4️⃣ Cleaning up test data...');
  
  await client.send(new DeleteCommand({
    TableName: TABLE,
    Key: {
      domain: TEST_DOMAIN,
      listing_id: TEST_ID,
    },
  }));
  
  console.log('   ✅ Deleted test item');
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('END-TO-END DYNAMODB TEST');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  try {
    // Step 1: Fetch and parse real data
    const parsed = await fetchAndParse();
    console.log(`   Parsed: ${parsed.title.substring(0, 40)}...`);
    console.log(`   Price: €${parsed.price?.toLocaleString()} | Beds: ${parsed.beds} | Baths: ${parsed.baths}`);
    console.log(`   Parking: ${parsed.has_parking} | Terrace: ${parsed.has_terrace} | Pool: ${parsed.has_pool}`);
    
    // Step 2: Write to DynamoDB
    await writeToDb(parsed);
    
    // Step 3: Read back and verify
    const retrieved = await readFromDb();
    
    // Step 4: Verify data integrity
    console.log('\n5️⃣ Verifying data integrity...');
    const checks = [
      { name: 'Price', expected: parsed.price, actual: retrieved.price },
      { name: 'Beds', expected: parsed.beds, actual: retrieved.property?.bedrooms },
      { name: 'Baths', expected: parsed.baths, actual: retrieved.property?.bathrooms },
      { name: 'has_parking', expected: parsed.has_parking, actual: retrieved.has_parking },
      { name: 'has_pool', expected: parsed.has_pool, actual: retrieved.has_pool },
      { name: 'status', expected: 'active', actual: retrieved.status },
    ];
    
    let passed = 0;
    for (const check of checks) {
      if (check.expected === check.actual) {
        console.log(`   ✅ ${check.name}: ${check.actual}`);
        passed++;
      } else {
        console.log(`   ❌ ${check.name}: expected ${check.expected}, got ${check.actual}`);
      }
    }
    
    // Step 5: Cleanup
    await cleanup();
    
    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log(`RESULT: ${passed}/${checks.length} checks passed`);
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    
    if (passed === checks.length) {
      console.log('\n✅ END-TO-END TEST PASSED! Data flows correctly to DynamoDB for recommender use.');
    } else {
      console.log('\n⚠️ Some checks failed - review output above');
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    // Try cleanup anyway
    try { await cleanup(); } catch {}
    process.exit(1);
  }
}

main();
