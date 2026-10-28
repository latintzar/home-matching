import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

// Initialize Supabase (Service Role for Admin access)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || (process.env.NEXT_PUBLIC_SUPABASE_URL || '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Helper to extract domain from URL
function getDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) {
    return '';
  }
}

async function seedHarvestQueue() {
  console.log('🌱 Seeding Harvest Queue from MASTER_AGENCY_LIST.csv...');

  const csvPath = path.join(process.cwd(), 'data', 'MASTER_AGENCY_LIST.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found at ${csvPath}`);
    return;
  }

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  
  // Parse CSV
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  console.log(`📊 Found ${records.length} records in CSV.`);

  let insertedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Process in chunks to avoid massive payloads
  const CHUNK_SIZE = 50;
  
  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    const domainsToInsert: any[] = [];
    const queueItemsToInsert: any[] = [];

    for (const record of chunk as any[]) {
      // Adapt fields based on CSV structure (adjust keys if needed)
      // Assuming CSV has 'URL' or 'Website' column
      const url = record.URL || record.Website || record.url || record.website;
      
      if (!url || !url.startsWith('http')) {
        skippedCount++;
        continue;
      }

      const domain = getDomain(url);
      if (!domain) {
        skippedCount++;
        continue;
      }

      // Prepare Rules Entry (if not exists)
      domainsToInsert.push({
        domain: domain,
        status: 'learning' // Start in learning mode
      });

      // Prepare Queue Entry
      queueItemsToInsert.push({
        domain: domain,
        seed_url: url, // Use the main URL as seed for now
        status: 'pending',
        priority: record.Priority || 1 // Optional priority column
      });
    }

    if (domainsToInsert.length > 0) {
      // 1. Upsert Rules (Ignore duplicates)
      const { error: rulesError } = await supabase
        .from('scraping_rules')
        .upsert(domainsToInsert, { onConflict: 'domain', ignoreDuplicates: true });

      if (rulesError) {
        console.error('❌ Error upserting rules:', rulesError.message);
        errorCount += domainsToInsert.length;
      } else {
        // 2. Upsert Queue (Update if exists)
        const { error: queueError } = await supabase
          .from('harvest_queue')
          .upsert(queueItemsToInsert, { 
            onConflict: 'domain',
            // If it exists, just update the URL/Priority, don't reset status if it's already running
            ignoreDuplicates: false 
          });

        if (queueError) {
            console.error('❌ Error upserting queue:', queueError.message);
            errorCount += queueItemsToInsert.length;
        } else {
            insertedCount += queueItemsToInsert.length;
        }
      }
    }
    
    // Progress Log
    if ((i + CHUNK_SIZE) % 500 === 0) {
        console.log(`... Processed ${i + CHUNK_SIZE} rows`);
    }
  }

  console.log('\n✅ Seeding Complete!');
  console.log(`📥 Inserted/Updated: ${insertedCount}`);
  console.log(`⏭️ Skipped (Invalid/Empty): ${skippedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
}

seedHarvestQueue().catch(console.error);

