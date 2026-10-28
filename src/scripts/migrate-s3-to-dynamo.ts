/**
 * Migration Script: S3 → DynamoDB
 * 
 * Migrates legacy S3 listing data to DynamoDB for domains that have
 * data stuck in S3 (specifically Lucas Fox with 4,857 listings).
 * 
 * Usage: npx tsx src/scripts/migrate-s3-to-dynamo.ts [domain]
 * Example: npx tsx src/scripts/migrate-s3-to-dynamo.ts lucasfox.com
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import * as zlib from 'zlib';
import { config } from 'dotenv';

// Load environment variables
// Recipient configuration is supplied by tools/runtime-env.py.
const REGION = process.env.AWS_REGION || 'us-east-1';
const TABLE_NAME = 'leo-listings';
const BUCKET_NAME = 'puedo-casa-html-archive';

// S3 file mapping
const S3_FILES: Record<string, string> = {
  'tecnocasa.es': 'harvest/tc-listings.json.gz',
  'lucasfox.com': 'harvest/lf-listings.json.gz',
  'engelvoelkers.com': 'harvest/ev-listings.json.gz',
  'century21.es': 'harvest/c21-listings.json.gz',
  'donpiso.com': 'harvest/dp-listings.json.gz',
};

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

const s3Client = new S3Client({ region: REGION });

interface S3Listing {
  id: string;
  url?: string;
  title?: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  area_m2?: number;
  sqm?: number;  // Lucas Fox uses sqm
  latitude?: number;
  longitude?: number;
  lat?: number;  // Lucas Fox uses lat/lng directly
  lng?: number;
  city?: string;
  addressLocality?: string;  // Lucas Fox field
  province?: string;
  addressRegion?: string;  // Lucas Fox field
  addressCountry?: string;
  neighborhood?: string;
  street_address?: string;
  description?: string;
  property_type?: string;
  propertyType?: string;  // Lucas Fox field
  contract_type?: string;
  listingType?: string;  // Lucas Fox field (res_sale, res_rent)
  photos?: { regular?: string[]; floorplan?: string[]; exterior?: string[]; other?: string[]; total?: number };
  image_urls?: string[];
  imageUrls?: string[];  // Lucas Fox field
  first_seen?: string;
  last_seen?: string;
  scraped_at?: string;
  coordinate_precision?: string;
  saleStatus?: string;
  has_elevator?: boolean;
  has_ac?: boolean;
  has_parking?: boolean;
  has_terrace?: boolean;
  has_pool?: boolean;
  is_furnished?: boolean;
  floor?: number;
}

async function loadS3Listings(domain: string): Promise<S3Listing[]> {
  const s3Key = S3_FILES[domain];
  if (!s3Key) {
    throw new Error(`Unknown domain: ${domain}. Available: ${Object.keys(S3_FILES).join(', ')}`);
  }

  console.log(`📥 Loading from S3: ${s3Key}`);
  
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  }));

  const compressed = await response.Body?.transformToByteArray();
  if (!compressed) {
    throw new Error('Empty S3 response');
  }

  const json = zlib.gunzipSync(Buffer.from(compressed)).toString('utf-8');
  const listings = JSON.parse(json) as S3Listing[];
  
  console.log(`   Found ${listings.length} listings in S3`);
  return listings;
}

async function getExistingIds(domain: string): Promise<Set<string>> {
  console.log(`📋 Checking existing DynamoDB records for ${domain}...`);
  
  const existingIds = new Set<string>();
  let lastKey: Record<string, any> | undefined;
  
  do {
    const response = await dynamoClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: '#d = :domain',
      ExpressionAttributeNames: { '#d': 'domain' },
      ExpressionAttributeValues: { ':domain': domain },
      ProjectionExpression: 'listing_id',
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of response.Items || []) {
      existingIds.add(item.listing_id);
    }
    
    lastKey = response.LastEvaluatedKey;
  } while (lastKey);
  
  console.log(`   Found ${existingIds.size} existing records`);
  return existingIds;
}

function inferContractType(listing: S3Listing): string {
  // 1. Check Lucas Fox listingType field
  if (listing.listingType) {
    const lt = listing.listingType.toLowerCase();
    if (lt.includes('sale') || lt === 'res_sale') return 'sale';
    if (lt.includes('rent') || lt === 'res_rent') return 'rent';
  }
  
  // 2. Check explicit contract_type field
  if (listing.contract_type) {
    return listing.contract_type.toLowerCase();
  }
  
  // 3. Infer from URL
  const url = (listing.url || '').toLowerCase();
  if (url.includes('/venta/') || url.includes('/sale/') || url.includes('for-sale') || url.includes('-sale-')) {
    return 'sale';
  }
  if (url.includes('/alquiler/') || url.includes('/rent/') || url.includes('for-rent') || url.includes('-rent-')) {
    return 'rent';
  }
  
  // 4. Check title
  const title = (listing.title || '').toLowerCase();
  if (title.includes('en venta') || title.includes('for sale')) return 'sale';
  if (title.includes('en alquiler') || title.includes('for rent')) return 'rent';
  
  // 5. Fallback to price heuristic
  return (listing.price || 0) > 5000 ? 'sale' : 'rent';
}

function transformToDynamoItem(listing: S3Listing, domain: string) {
  const now = new Date().toISOString();
  
  // Handle different photo field names
  const photos = listing.photos?.regular || listing.imageUrls || listing.image_urls || [];
  
  // Handle different location field names (Lucas Fox uses addressLocality/addressRegion)
  const city = listing.city || listing.addressLocality;
  const province = listing.province || listing.addressRegion;
  const lat = listing.latitude || listing.lat;
  const lng = listing.longitude || listing.lng;
  const area = listing.area_m2 || listing.sqm;
  const propertyType = listing.property_type || listing.propertyType;
  
  // Generate title if missing
  const title = listing.title || (propertyType && city ? `${propertyType} in ${city}` : undefined);
  
  return {
    domain,
    listing_id: listing.id,
    url: listing.url,
    title,
    price: listing.price,
    
    location: {
      address: city ? `${city}, ${province || 'Spain'}` : null,
      city,
      street_address: listing.street_address,
      neighborhood: listing.neighborhood,
      province,
      country: 'Spain',
      lat,
      lng,
      coordinate_precision: listing.coordinate_precision || (lat && lng ? 'approximate' : 'unknown'),
    },
    
    property: {
      type: propertyType,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      area_m2: area,
      floor: listing.floor,
    },
    
    // Also store flat for easier querying
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    area_m2: area,
    
    photos: photos.slice(0, 20),
    image_urls: photos.slice(0, 20),
    photos_floorplan: listing.photos?.floorplan || [],
    photos_exterior: listing.photos?.exterior || [],
    photo_count: listing.photos?.total || photos.length,
    
    description: listing.description?.substring(0, 2000),
    contract_type: inferContractType(listing),
    
    status: listing.saleStatus || 'active',
    first_seen: listing.first_seen || now,
    last_seen: listing.last_seen || now,
    scraped_at: listing.scraped_at || now,
    updated_at: now,
    
    has_elevator: listing.has_elevator,
    has_ac: listing.has_ac,
    has_parking: listing.has_parking,
    has_terrace: listing.has_terrace,
    has_pool: listing.has_pool,
    is_furnished: listing.is_furnished,
    
    harvester_version: '2.0.0-migrated',
  };
}

async function migrate(domain: string, dryRun: boolean = false) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  MIGRATION: ${domain} S3 → DynamoDB`);
  console.log(`  Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  // Load S3 data
  const s3Listings = await loadS3Listings(domain);
  
  // Get existing DynamoDB IDs
  const existingIds = await getExistingIds(domain);
  
  // Find listings to migrate (not already in DynamoDB)
  const toMigrate = s3Listings.filter(l => !existingIds.has(l.id));
  console.log(`\n📊 Migration plan:`);
  console.log(`   S3 total: ${s3Listings.length}`);
  console.log(`   Already in DynamoDB: ${existingIds.size}`);
  console.log(`   To migrate: ${toMigrate.length}`);
  
  if (toMigrate.length === 0) {
    console.log('\n✅ Nothing to migrate - all data already in DynamoDB!');
    return;
  }
  
  if (dryRun) {
    console.log('\n🔍 DRY RUN - showing sample items:');
    for (const listing of toMigrate.slice(0, 3)) {
      const item = transformToDynamoItem(listing, domain);
      console.log(`\n   ${item.listing_id}:`);
      console.log(`     Title: ${item.title}`);
      console.log(`     Price: €${item.price}`);
      console.log(`     Contract: ${item.contract_type}`);
      console.log(`     City: ${item.location?.city}`);
    }
    console.log(`\n   ... and ${toMigrate.length - 3} more`);
    console.log('\n⚠️  Run without --dry-run to execute migration');
    return;
  }
  
  // Execute migration
  console.log('\n🚀 Starting migration...');
  const BATCH_SIZE = 25;
  let success = 0;
  let failed = 0;
  const startTime = Date.now();
  
  for (let i = 0; i < toMigrate.length; i += BATCH_SIZE) {
    const batch = toMigrate.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async (listing) => {
      try {
        const item = transformToDynamoItem(listing, domain);
        await dynamoClient.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
        }));
        success++;
      } catch (error) {
        failed++;
        console.error(`   ❌ Failed ${listing.id}: ${error}`);
      }
    }));
    
    const progress = Math.min(i + BATCH_SIZE, toMigrate.length);
    if (progress % 500 === 0 || progress === toMigrate.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`   📊 Progress: ${progress}/${toMigrate.length} (${success} ok, ${failed} failed) - ${elapsed}s`);
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  ✅ MIGRATION COMPLETE`);
  console.log(`     Migrated: ${success}`);
  console.log(`     Failed: ${failed}`);
  console.log(`     Time: ${totalTime}s`);
  console.log('═══════════════════════════════════════════════════════════════');
}

// Main
const args = process.argv.slice(2);
const domain = args.find(a => !a.startsWith('--')) || 'lucasfox.com';
const dryRun = args.includes('--dry-run');

migrate(domain, dryRun).catch(console.error);
