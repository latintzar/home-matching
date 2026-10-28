
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Recipient configuration is supplied by tools/runtime-env.py.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function wipeStorage() {
  console.log('🚨 STARTING COMPLETE STORAGE WIPE...');

  const bucketsToCheck = ['property-images', 'clusters', 'pipeline-masks', 'pipeline-segmentation'];

  for (const bucketName of bucketsToCheck) {
    console.log(`\n🗑️  Emptying bucket: ${bucketName}...`);
    
    // List top-level items (files or folders)
    const { data: items, error } = await supabase.storage.from(bucketName).list();

    if (error) {
      console.log(`   Skipping (error or not found): ${error.message}`);
      continue;
    }

    if (!items || items.length === 0) {
      console.log('   (empty)');
      continue;
    }

    console.log(`   Found ${items.length} root items.`);

    for (const item of items) {
      // Try to delete it as a file first
      const { error: fileErr } = await supabase.storage
        .from(bucketName)
        .remove([item.name]);

      if (!fileErr) {
        console.log(`   Deleted: ${item.name}`);
      } 
      
      // If it's a folder (or to be thorough), look inside
      // This is common for listing IDs (e.g. "1000000121")
      if (!item.metadata) { 
         const { data: subItems } = await supabase.storage
           .from(bucketName)
           .list(item.name);
           
         if (subItems && subItems.length > 0) {
           const subPaths = subItems.map(s => `${item.name}/${s.name}`);
           console.log(`   Deleting ${subPaths.length} files inside ${item.name}...`);
           await supabase.storage.from(bucketName).remove(subPaths);
           
           // Try deleting the folder itself again (now empty)
           await supabase.storage.from(bucketName).remove([item.name]);
         }
      }
    }
  }
  
  console.log('\n✨ Storage wipe complete.');
}

wipeStorage();

