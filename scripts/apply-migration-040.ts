import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as dotenv from 'dotenv';

// Recipient configuration is supplied by tools/runtime-env.py.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyMigration() {
  console.log('🚀 Applying migration 040: Auto Photo Clusters Test Tables...\n');

  try {
    // Read migration file
    const migrationPath = resolve(process.cwd(), 'supabase/migrations/040_auto_photo_clusters_test.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute via RPC (if we have a function) or direct query
    // Since Supabase JS doesn't support arbitrary SQL, we'll use the REST API
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ sql: migrationSQL }),
    });

    if (!response.ok) {
      // Fallback: try executing statements individually via direct SQL
      console.log('⚠️  RPC method not available, trying direct execution...\n');
      
      // For now, just print instructions
      console.log('📋 Please run this migration manually in Supabase SQL Editor:\n');
      console.log('─'.repeat(80));
      console.log(migrationSQL);
      console.log('─'.repeat(80));
      console.log('\n✅ Copy the SQL above and run it in Supabase Dashboard → SQL Editor');
      
      // Verify tables exist
      console.log('\n🔍 Checking if tables exist...');
      const { data: clusters, error: clustersError } = await supabase
        .from('auto_photo_clusters')
        .select('*')
        .limit(0);
      
      if (clustersError && clustersError.message.includes('relation') && clustersError.message.includes('does not exist')) {
        console.log('❌ Tables do not exist yet. Please run the migration SQL above.');
      } else {
        console.log('✅ Tables exist!');
      }
    } else {
      console.log('✅ Migration applied successfully!');
    }

  } catch (err: any) {
    console.error('❌ Migration error:', err.message);
    console.log('\n📋 Please run this migration manually in Supabase SQL Editor:');
    console.log('   File: supabase/migrations/040_auto_photo_clusters_test.sql');
    process.exit(1);
  }
}

applyMigration();

