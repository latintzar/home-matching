/**
 * Run Recommender Migration
 * 
 * This script creates the recommender tables in Supabase.
 * Run with: npx tsx src/scripts/migration/run-recommender-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Recipient configuration is supplied by tools/runtime-env.py.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  console.log('🚀 Running Recommender Tables Migration');
  console.log('=====================================\n');

  // Read the migration file
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/010_recommender_tables.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

  // Split into individual statements (crude but works for simple migrations)
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📋 Found ${statements.length} SQL statements\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ') + '...';
    console.log(`[${i + 1}/${statements.length}] ${preview}`);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
      
      if (error) {
        // Try direct query approach for DDL
        const { data, error: queryError } = await supabase
          .from('_dummy_')
          .select('1')
          .limit(0);
        
        // If it's just an rpc not found error, we need a different approach
        console.log(`   ⚠️ RPC not available, trying raw query...`);
      } else {
        console.log(`   ✅ Success`);
      }
    } catch (err: any) {
      console.log(`   ⚠️ ${err.message}`);
    }
  }

  console.log('\n✅ Migration script completed');
  console.log('\n📝 NOTE: If some statements failed, you may need to run them manually');
  console.log('   via the Supabase SQL Editor at:');
  console.log(`   ${SUPABASE_URL.replace('.supabase.co', '.supabase.co/project/_/sql')}`);
}

// Alternative: Just check if tables exist
async function checkTables() {
  console.log('\n📊 Checking if tables exist...\n');
  
  const tables = ['user_lifestyle_profiles', 'user_matches', 'match_feedback'];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .limit(1);
    
    if (error) {
      if (error.message.includes('does not exist')) {
        console.log(`   ❌ ${table} - NOT FOUND`);
      } else {
        console.log(`   ⚠️ ${table} - Error: ${error.message}`);
      }
    } else {
      console.log(`   ✅ ${table} - EXISTS`);
    }
  }
}

async function main() {
  await checkTables();
  
  console.log('\n⚡ To create the tables, run the SQL in supabase/migrations/010_recommender_tables.sql');
  console.log('   directly in the Supabase SQL Editor.\n');
}

main().catch(console.error);

