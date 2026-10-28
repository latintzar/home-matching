/**
 * Supabase → DynamoDB Migration Script
 * 
 * Migrates bulk data from Supabase Free tier to AWS DynamoDB.
 * 
 * Tables to migrate:
 * - listings (150 rows) → leo-listings
 * - listing_photos (2,747 rows) → leo-listings (embedded)
 * - clusters (210 rows) → leo-listings (embedded)
 * - text_analysis_results (499 rows) → leo-analysis-cache
 * - whole_property_analysis (8 rows) → leo-wpa-cache
 * - room_analyses (9 rows) → leo-analysis-cache
 * - scraping_rules (3,667 rows) → leo-scraping-rules
 * - harvest_queue (3,667 rows) → leo-crawl-tracking
 * 
 * Tables staying on Supabase:
 * - agents, deepdives, user_lifestyle_profiles, auth tables
 */

import { createClient } from '@supabase/supabase-js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import * as dotenv from 'dotenv';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

// Recipient configuration is supplied by tools/runtime-env.py.
// Initialize clients
const supabase = lazySupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Stats tracking
const stats = {
  listings: { read: 0, written: 0, errors: 0 },
  photos: { read: 0, written: 0, errors: 0 },
  clusters: { read: 0, written: 0, errors: 0 },
  analysis: { read: 0, written: 0, errors: 0 },
  scrapingRules: { read: 0, written: 0, errors: 0 },
};

/**
 * Migrate listings table
 */
async function migrateListings() {
  console.log('\n📋 Migrating listings...');
  
  // Fetch ALL listings with pagination (without joins - they fail)
  const listings: any[] = [];
  let offset = 0;
  const pageSize = 100;
  
  while (true) {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .range(offset, offset + pageSize - 1);
    
    if (error) {
      console.error('❌ Error fetching listings:', error.message);
      break;
    }
    
    if (!data || data.length === 0) break;
    listings.push(...data);
    
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  
  // Fetch photos separately
  const photos: any[] = [];
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('listing_photos')
      .select('*')
      .range(offset, offset + 1000 - 1);
    
    if (error) break;
    if (!data || data.length === 0) break;
    photos.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`   Found ${photos.length} photos`);
  
  // Fetch clusters separately
  const clusters: any[] = [];
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('clusters')
      .select('*')
      .range(offset, offset + 1000 - 1);
    
    if (error) break;
    if (!data || data.length === 0) break;
    clusters.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`   Found ${clusters.length} clusters`);
  
  // Group photos and clusters by listing_id
  const photosByListing = new Map<string, any[]>();
  for (const photo of photos) {
    const key = photo.listing_id?.toString() || 'unknown';
    if (!photosByListing.has(key)) photosByListing.set(key, []);
    photosByListing.get(key)!.push(photo);
  }
  
  const clustersByListing = new Map<string, any[]>();
  for (const cluster of clusters) {
    const key = cluster.listing_id?.toString() || 'unknown';
    if (!clustersByListing.has(key)) clustersByListing.set(key, []);
    clustersByListing.get(key)!.push(cluster);
  }
  
  stats.listings.read = listings.length;
  console.log(`   Found ${stats.listings.read} listings`);
  
  for (const listing of listings) {
    try {
      // Extract domain from source_url
      const domain = listing.source_url 
        ? new URL(listing.source_url).hostname.replace('www.', '')
        : 'unknown';
      
      const listingPhotos = photosByListing.get(listing.id.toString()) || [];
      const listingClusters = clustersByListing.get(listing.id.toString()) || [];
      
      // Transform to DynamoDB format
      const item = {
        domain,
        listing_id: listing.id.toString(),
        url: listing.source_url,
        title: listing.title,
        address: listing.address,
        city: listing.city,
        region: listing.region,
        price: listing.price_eur,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        sqm: listing.sqm,
        lat: listing.lat,
        lng: listing.lng,
        scraped_data: listing.scraped_data,
        pipeline_checkpoints: listing.pipeline_checkpoints,
        // Embed photos as array of URLs (Fetch-and-Dump pattern)
        image_urls: listingPhotos.map((p: any) => p.original_url || p.url),
        // Embed clusters
        clusters: listingClusters.map((c: any) => ({
          name: c.cluster_name,
          room_type: c.room_type,
          photo_urls: c.photo_urls,
        })),
        created_at: listing.created_at,
        updated_at: listing.updated_at,
        // Status tracking for harvest
        status: 'active',
        first_seen: listing.created_at,
        last_seen: new Date().toISOString(),
      };
      
      await docClient.send(new PutCommand({
        TableName: 'leo-listings',
        Item: item,
      }));
      
      stats.listings.written++;
      if (stats.listings.written % 10 === 0) {
        console.log(`   Progress: ${stats.listings.written}/${stats.listings.read}`);
      }
    } catch (err: any) {
      console.error(`   ❌ Error migrating listing ${listing.id}:`, err.message);
      stats.listings.errors++;
    }
  }
  
  console.log(`   ✅ Migrated ${stats.listings.written} listings (${stats.listings.errors} errors)`);
}

/**
 * Migrate analysis results
 */
async function migrateAnalysis() {
  console.log('\n📊 Migrating analysis results...');
  
  // Migrate text_analysis_results
  const { data: textResults, error: textError } = await supabase
    .from('text_analysis_results')
    .select('*');
  
  if (textError) {
    console.error('❌ Error fetching text_analysis_results:', textError.message);
  } else {
    console.log(`   Found ${textResults?.length || 0} text analysis results`);
    
    for (const result of textResults || []) {
      try {
        await docClient.send(new PutCommand({
          TableName: 'leo-analysis-cache',
          Item: {
            listing_id: result.listing_id,
            analysis_type: `text_${result.phase}`,
            results: result.results,
            created_at: result.created_at,
            schema_version: '1.0',
          },
        }));
        stats.analysis.written++;
      } catch (err: any) {
        stats.analysis.errors++;
      }
    }
  }
  
  // Migrate whole_property_analysis
  const { data: wpaResults, error: wpaError } = await supabase
    .from('whole_property_analysis')
    .select('*');
  
  if (wpaError) {
    console.error('❌ Error fetching whole_property_analysis:', wpaError.message);
  } else {
    console.log(`   Found ${wpaResults?.length || 0} WPA results`);
    
    for (const result of wpaResults || []) {
      try {
        await docClient.send(new PutCommand({
          TableName: 'leo-wpa-cache',
          Item: {
            listing_url: result.listing_id, // Using listing_id as key
            analysis_data: result.analysis_data,
            created_at: result.created_at,
            schema_version: '1.0',
          },
        }));
        stats.analysis.written++;
      } catch (err: any) {
        stats.analysis.errors++;
      }
    }
  }
  
  // Migrate room_analyses
  const { data: roomResults, error: roomError } = await supabase
    .from('room_analyses')
    .select('*');
  
  if (roomError) {
    console.error('❌ Error fetching room_analyses:', roomError.message);
  } else {
    console.log(`   Found ${roomResults?.length || 0} room analysis results`);
    
    for (const result of roomResults || []) {
      try {
        await docClient.send(new PutCommand({
          TableName: 'leo-analysis-cache',
          Item: {
            listing_id: result.listing_id,
            analysis_type: 'room_by_room',
            results: result.analysis_data,
            created_at: result.created_at,
            schema_version: '1.0',
          },
        }));
        stats.analysis.written++;
      } catch (err: any) {
        stats.analysis.errors++;
      }
    }
  }
  
  console.log(`   ✅ Migrated ${stats.analysis.written} analysis results (${stats.analysis.errors} errors)`);
}

/**
 * Migrate scraping rules
 */
async function migrateScrapingRules() {
  console.log('\n🔧 Migrating scraping rules...');
  
  // Fetch ALL with pagination
  const rules: any[] = [];
  let offset = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('scraping_rules')
      .select('*')
      .range(offset, offset + pageSize - 1);
    
    if (error) {
      console.error('❌ Error fetching scraping_rules:', error.message);
      break;
    }
    
    if (!data || data.length === 0) break;
    rules.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  
  stats.scrapingRules.read = rules.length;
  console.log(`   Found ${stats.scrapingRules.read} scraping rules`);
  
  // Batch write in chunks of 25 (DynamoDB limit)
  const chunks = [];
  for (let i = 0; i < rules.length; i += 25) {
    chunks.push(rules.slice(i, i + 25));
  }
  
  for (const chunk of chunks) {
    try {
      const items = chunk.map((rule: any) => ({
        PutRequest: {
          Item: {
            domain: rule.domain,
            selectors: rule.selectors || {},
            status: rule.status || 'learning',
            trust_level: rule.confidence_score ? Math.round(rule.confidence_score * 10) : 0,
            last_success: rule.last_success,
            failure_count: rule.failure_count || 0,
            version: rule.version || 1,
          },
        },
      }));
      
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          'leo-scraping-rules': items,
        },
      }));
      
      stats.scrapingRules.written += chunk.length;
      console.log(`   Progress: ${stats.scrapingRules.written}/${stats.scrapingRules.read}`);
    } catch (err: any) {
      console.error(`   ❌ Batch error:`, err.message);
      stats.scrapingRules.errors += chunk.length;
    }
  }
  
  console.log(`   ✅ Migrated ${stats.scrapingRules.written} scraping rules (${stats.scrapingRules.errors} errors)`);
}

/**
 * Migrate harvest queue to crawl tracking
 */
async function migrateCrawlTracking() {
  console.log('\n📡 Migrating crawl tracking...');
  
  // Fetch ALL with pagination
  const queue: any[] = [];
  let offset = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('harvest_queue')
      .select('*')
      .range(offset, offset + pageSize - 1);
    
    if (error) {
      console.error('❌ Error fetching harvest_queue:', error.message);
      break;
    }
    
    if (!data || data.length === 0) break;
    queue.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  
  console.log(`   Found ${queue.length} harvest queue entries`);
  
  // Batch write
  const chunks = [];
  for (let i = 0; i < queue.length; i += 25) {
    chunks.push(queue.slice(i, i + 25));
  }
  
  let written = 0;
  for (const chunk of chunks) {
    try {
      const items = chunk.map((entry: any) => ({
        PutRequest: {
          Item: {
            domain: entry.domain,
            has_sitemap: true, // Will be updated by harvest
            sitemap_url: entry.seed_url,
            last_full_crawl: entry.last_run,
            status: entry.status === 'completed' ? 'healthy' : 'pending',
          },
        },
      }));
      
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          'leo-crawl-tracking': items,
        },
      }));
      
      written += chunk.length;
    } catch (err: any) {
      console.error(`   ❌ Batch error:`, err.message);
    }
  }
  
  console.log(`   ✅ Migrated ${written} crawl tracking entries`);
}

/**
 * Main migration function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SUPABASE → DYNAMODB MIGRATION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log('');
  
  // Check connections
  console.log('🔌 Testing connections...');
  
  // Test Supabase
  const { error: supabaseError } = await supabase.from('listings').select('id').limit(1);
  if (supabaseError) {
    console.error('❌ Supabase connection failed:', supabaseError.message);
    process.exit(1);
  }
  console.log('   ✅ Supabase connected');
  
  // Test DynamoDB
  try {
    await docClient.send(new PutCommand({
      TableName: 'leo-listings',
      Item: { domain: 'test', listing_id: 'connection-test' },
    }));
    console.log('   ✅ DynamoDB connected');
  } catch (err: any) {
    console.error('❌ DynamoDB connection failed:', err.message);
    process.exit(1);
  }
  
  // Run migrations
  await migrateListings();
  await migrateAnalysis();
  await migrateScrapingRules();
  await migrateCrawlTracking();
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  MIGRATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Listings: ${stats.listings.written}/${stats.listings.read} (${stats.listings.errors} errors)`);
  console.log(`  Analysis: ${stats.analysis.written} records`);
  console.log(`  Scraping Rules: ${stats.scrapingRules.written}/${stats.scrapingRules.read}`);
  console.log('');
}

// Run if called directly
main().catch(console.error);

