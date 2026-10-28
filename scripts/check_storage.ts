
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

async function listBucketsAndFiles() {
  console.log('Listing Supabase Storage buckets...');
  
  const { data: buckets, error } = await supabase.storage.listBuckets();
  
  if (error) {
    console.error('Error listing buckets:', error);
    return;
  }

  if (!buckets || buckets.length === 0) {
    console.log('No buckets found.');
    return;
  }

  for (const bucket of buckets) {
    console.log(`\n📁 Bucket: ${bucket.name}`);
    
    // List top-level files/folders in the bucket
    const { data: files, error: listError } = await supabase.storage
      .from(bucket.name)
      .list();
      
    if (listError) {
      console.error(`  ❌ Error listing files in ${bucket.name}:`, listError);
      continue;
    }

    if (!files || files.length === 0) {
      console.log('  (empty)');
      continue;
    }

    // Check for folders (files without metadata often represent folders in list view or checking id)
    for (const file of files) {
       // If it's a folder (no id usually, or we can check by listing inside it)
       // In Supabase storage, folders are virtual. We'll just list them.
       console.log(`  - ${file.name} (${file.id ? 'file' : 'folder?'}) - Size: ${file.metadata?.size || 0} bytes`);
       
       // If it looks like a listing ID (number), peek inside
       if (/^\d+$/.test(file.name)) {
           const { data: subFiles } = await supabase.storage
            .from(bucket.name)
            .list(file.name, { limit: 5 });
           
           if (subFiles && subFiles.length > 0) {
               console.log(`    Contains ${subFiles.length}+ files (e.g. ${subFiles[0].name})`);
           } else {
               console.log(`    (empty folder)`);
           }
       }
    }
  }
}

listBucketsAndFiles();

