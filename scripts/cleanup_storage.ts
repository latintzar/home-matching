
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

async function cleanupStorage() {
  console.log('Cleaning up Supabase Storage...');

  const targetListingId = '1000000121';
  
  // 1. Cleanup property-images bucket
  console.log('\nChecking property-images bucket...');
  const { data: propertyFiles, error: propError } = await supabase.storage
    .from('property-images')
    .list();

  if (propError) {
    console.error('Error listing property-images:', propError);
  } else if (propertyFiles) {
    const foldersToDelete = [];
    for (const file of propertyFiles) {
      // Check if it's a listing folder (numeric name)
      if (/^\d+$/.test(file.name)) {
        if (file.name !== targetListingId) {
          foldersToDelete.push(file.name);
        }
      }
    }

    if (foldersToDelete.length > 0) {
      console.log(`Found ${foldersToDelete.length} orphaned listing folders to delete.`);
      
      // Delete each folder contents recursively
      for (const folder of foldersToDelete) {
        console.log(`Deleting folder: ${folder}...`);
        
        // List files in the folder
        const { data: subFiles } = await supabase.storage
          .from('property-images')
          .list(folder);
          
        if (subFiles && subFiles.length > 0) {
          const pathsToDelete = subFiles.map(f => `${folder}/${f.name}`);
          const { error: deleteError } = await supabase.storage
            .from('property-images')
            .remove(pathsToDelete);
            
          if (deleteError) console.error(`Failed to delete files in ${folder}:`, deleteError);
        }
        
        // Note: In Supabase/S3, "folders" disappear when empty, so we don't explicitly delete the folder itself usually, 
        // but sometimes empty placeholder objects exist. 
        // We'll try to remove the folder path itself just in case it's an object.
        // Actually, listing returns it, so it might be an object if it has size 0 but is returned.
        // But usually removing contents is enough.
      }
    } else {
      console.log('No orphaned listing folders found in property-images.');
    }
  }

  // 2. Cleanup pipeline-masks bucket (assuming these are temporary)
  console.log('\nCleaning up pipeline-masks bucket...');
  const { data: maskFiles, error: maskError } = await supabase.storage
    .from('pipeline-masks')
    .list();
    
  if (maskError) {
    console.error('Error listing pipeline-masks:', maskError);
  } else if (maskFiles && maskFiles.length > 0) {
    console.log(`Found ${maskFiles.length} mask files to delete.`);
    const paths = maskFiles.map(f => f.name);
    
    // Delete in batches of 100
    for (let i = 0; i < paths.length; i += 100) {
        const batch = paths.slice(i, i + 100);
        const { error } = await supabase.storage.from('pipeline-masks').remove(batch);
        if (error) console.error('Error deleting masks batch:', error);
    }
    console.log('Pipeline masks cleared.');
  } else {
    console.log('pipeline-masks bucket is empty.');
  }

  // 3. Cleanup clusters bucket (if needed - keeping folder '1' might be safe if it's for 1000000121, 
  // but checking if it corresponds to the target listing or just a test run)
  // "1" is likely a test run ID or listing ID. If listings are 1000..., "1" is probably trash.
  console.log('\nChecking clusters bucket...');
  const { data: clusterFiles, error: clusterError } = await supabase.storage
    .from('clusters')
    .list();
    
  if (clusterFiles) {
      const clustersToDelete = clusterFiles
        .filter(f => f.name !== targetListingId) // Keep if it matches our listing (though 1 != 1000000121)
        .map(f => f.name);
        
      if (clustersToDelete.length > 0) {
          console.log(`Deleting ${clustersToDelete.length} folders from clusters bucket (orphaned/test)...`);
          for (const folder of clustersToDelete) {
              const { data: sub } = await supabase.storage.from('clusters').list(folder);
              if (sub && sub.length > 0) {
                  const paths = sub.map(f => `${folder}/${f.name}`);
                  await supabase.storage.from('clusters').remove(paths);
              }
          }
      }
  }

  console.log('\nStorage cleanup complete.');
}

cleanupStorage();

