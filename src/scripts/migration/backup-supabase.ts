/**
 * Supabase Backup Script
 * 
 * Exports all tables to JSON files before migration.
 * Creates backup in: backups/supabase-YYYY-MM-DD-HH-mm/
 * 
 * Tables backed up:
 * - listings (150 rows)
 * - listing_photos (2,747 rows)
 * - clusters (210 rows)
 * - text_analysis_results (499 rows)
 * - whole_property_analysis (8 rows)
 * - room_analyses (9 rows)
 * - scraping_rules (3,667 rows)
 * - harvest_queue (3,667 rows)
 * - agents (671 rows) - stays on Supabase but backup anyway
 * - deepdives (0 rows) - stays on Supabase but backup anyway
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

// Recipient configuration is supplied by tools/runtime-env.py.
const supabase = lazySupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Tables to backup
const TABLES = [
  'listings',
  'listing_photos', 
  'clusters',
  'text_analysis_results',
  'whole_property_analysis',
  'room_analyses',
  'scraping_rules',
  'harvest_queue',
  'agents',
  'deepdives',
  'tier_scope',
  'timeline_milestones',
  'permit_notes',
  'intelligent_consideraciones',
  'analysis_search_results',
  'analysis_curated_results',
  'research_search_results',
];

async function backupTable(tableName: string, backupDir: string): Promise<number> {
  console.log(`   📋 Backing up ${tableName}...`);
  
  try {
    // Fetch ALL rows with pagination (Supabase limits to 1000 by default)
    const allData: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(offset, offset + pageSize - 1);
      
      if (error) {
        console.error(`   ❌ Error backing up ${tableName}:`, error.message);
        return 0;
      }
      
      if (!data || data.length === 0) break;
      
      allData.push(...data);
      
      if (data.length < pageSize) break; // Last page
      offset += pageSize;
    }
    
    const filePath = path.join(backupDir, `${tableName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(allData, null, 2));
    
    console.log(`   ✅ ${tableName}: ${allData.length} rows`);
    return allData.length;
  } catch (err: any) {
    console.error(`   ❌ Error backing up ${tableName}:`, err.message);
    return 0;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SUPABASE BACKUP');
  console.log('═══════════════════════════════════════════════════════════');
  
  // Create backup directory with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(process.cwd(), 'backups', `supabase-${timestamp}`);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  console.log(`\n📁 Backup directory: ${backupDir}\n`);
  
  // Test connection
  const { error: testError } = await supabase.from('listings').select('id').limit(1);
  if (testError) {
    console.error('❌ Supabase connection failed:', testError.message);
    process.exit(1);
  }
  console.log('🔌 Supabase connected\n');
  
  // Backup each table
  let totalRows = 0;
  const summary: Record<string, number> = {};
  
  for (const table of TABLES) {
    const rows = await backupTable(table, backupDir);
    summary[table] = rows;
    totalRows += rows;
  }
  
  // Write summary
  const summaryPath = path.join(backupDir, '_BACKUP_SUMMARY.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    tables: summary,
    totalRows,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  }, null, 2));
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  BACKUP COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Total rows backed up: ${totalRows}`);
  console.log(`  Backup location: ${backupDir}`);
  console.log('');
  console.log('  To restore, use the JSON files in the backup directory.');
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(console.error);

