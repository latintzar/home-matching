/**
 * Photo Storage Utilities
 * 
 * Handles downloading photos from external URLs and storing them in Supabase Storage.
 * This replaces dependence on Idealista URLs with reliable Supabase Storage URLs.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export interface PhotoStorageResult {
  success: boolean;
  supabaseUrl?: string;
  error?: string;
  originalUrl?: string;
  filename?: string;
}

/**
 * Download photo from external URL and store in Supabase Storage
 */
export async function storePhotoInSupabase(
  originalUrl: string,
  listingId: string,
  filename?: string
): Promise<PhotoStorageResult> {
  try {
    console.log(`📸 Downloading photo from: ${originalUrl}`);
    
    // Download photo from original URL with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(originalUrl, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`Failed to download photo: ${response.status} ${response.statusText}`);
    }
    
    const photoBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Generate filename if not provided
    const finalFilename = filename || generatePhotoFilename(originalUrl, contentType);
    
    // Upload to Supabase Storage
    const storagePath = `${listingId}/${finalFilename}`;
    const { data, error } = await supabase.storage
      .from('property-images')
      .upload(storagePath, photoBuffer, {
        contentType,
        upsert: true // Overwrite if exists
      });
    
    if (error) {
      throw new Error(`Failed to upload to Supabase Storage: ${error.message}`);
    }
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('property-images')
      .getPublicUrl(data.path);
    
    console.log(`✅ Photo stored successfully: ${publicUrlData.publicUrl}`);
    
    return {
      success: true,
      supabaseUrl: publicUrlData.publicUrl,
      originalUrl,
      filename: finalFilename
    };
    
  } catch (error) {
    const errorMessage = (error as any)?.message || 'Unknown error';
    const isTimeout = errorMessage.includes('aborted') || errorMessage.includes('timeout');
    
    console.error(`❌ Failed to store photo:`, errorMessage);
    
    return {
      success: false,
      error: isTimeout ? 'Photo download timeout' : errorMessage,
      originalUrl,
      filename: filename || 'unknown'
    };
  }
}

/**
 * Store a raw file buffer in Supabase Storage (for manual uploads)
 */
export async function storeFileInSupabase(
  fileBuffer: ArrayBuffer,
  contentType: string,
  listingId: string,
  filename?: string
): Promise<PhotoStorageResult> {
  try {
    const extension = contentType.split('/')[1] || 'jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const finalFilename = filename || `manual_upload_${timestamp}_${random}.${extension}`;

    // Upload to Supabase Storage
    const storagePath = `${listingId}/${finalFilename}`;
    const { data, error } = await supabase.storage
      .from('property-images')
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true
      });

    if (error) {
      throw new Error(`Failed to upload to Supabase Storage: ${error.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('property-images')
      .getPublicUrl(data.path);

    console.log(`✅ Manual photo stored successfully: ${publicUrlData.publicUrl}`);

    return {
      success: true,
      supabaseUrl: publicUrlData.publicUrl,
      filename: finalFilename
    };

  } catch (error) {
    const errorMessage = (error as any)?.message || 'Unknown error';
    console.error(`❌ Failed to store manual photo:`, errorMessage);

    return {
      success: false,
      error: errorMessage,
      filename: filename
    };
  }
}

/**
 * Store multiple photos for a listing
 */
export async function storeListingPhotos(
  photos: Array<{ url: string; filename?: string }>,
  listingId: string
): Promise<PhotoStorageResult[]> {
  console.log(`📸 Storing ${photos.length} photos for listing ${listingId}`);
  
  const results: PhotoStorageResult[] = [];
  
  // Process photos sequentially to avoid overwhelming the system
  for (const photo of photos) {
    const result = await storePhotoInSupabase(photo.url, listingId, photo.filename);
    results.push(result);
    
    // Small delay between uploads to be respectful
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`✅ Stored ${successCount}/${photos.length} photos successfully`);
  
  return results;
}

/**
 * Convert Supabase Storage URL to Base64 for Gemini analysis
 */
export async function convertSupabaseUrlToBase64(supabaseUrl: string): Promise<string> {
  try {
    const response = await fetch(supabaseUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch Supabase photo: ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
    
  } catch (error) {
    console.error(`❌ Failed to convert Supabase URL to Base64:`, error);
    throw new Error(`Failed to convert photo to Base64: ${(error as any)?.message}`);
  }
}

/**
 * Generate filename from URL or content type
 */
function generatePhotoFilename(originalUrl: string, contentType: string): string {
  // Try to extract filename from URL
  const urlPath = new URL(originalUrl).pathname;
  const urlFilename = urlPath.split('/').pop();
  
  if (urlFilename && urlFilename.includes('.')) {
    return urlFilename;
  }
  
  // Generate filename based on content type and timestamp
  const extension = contentType.split('/')[1] || 'jpg';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  
  return `photo_${timestamp}_${random}.${extension}`;
}

/**
 * Get Supabase Storage URL for a photo
 */
export function getSupabasePhotoUrl(listingId: string, filename: string): string {
  const { data } = supabase.storage
    .from('property-images')
    .getPublicUrl(`${listingId}/${filename}`);
  
  return data.publicUrl;
}

/**
 * Delete photos from Supabase Storage
 */
export async function deleteListingPhotos(listingId: string): Promise<boolean> {
  try {
    const { data: files, error: listError } = await supabase.storage
      .from('property-images')
      .list(listingId);
    
    if (listError) {
      throw new Error(`Failed to list photos: ${listError.message}`);
    }
    
    if (!files || files.length === 0) {
      console.log(`📸 No photos found for listing ${listingId}`);
      return true;
    }
    
    const filePaths = files.map(file => `${listingId}/${file.name}`);
    
    const { error: deleteError } = await supabase.storage
      .from('property-images')
      .remove(filePaths);
    
    if (deleteError) {
      throw new Error(`Failed to delete photos: ${deleteError.message}`);
    }
    
    console.log(`✅ Deleted ${filePaths.length} photos for listing ${listingId}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Failed to delete listing photos:`, error);
    return false;
  }
}

/**
 * Fetch after photos for a specific listing and tier
 */
export async function fetchAfterPhotos(
  listingId: string, 
  tier: 'livable' | 'comfortable' | 'competitive'
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('after_photos')
      .select('url, index')
      .eq('listing_id', listingId)
      .eq('tier', tier)
      .order('index', { ascending: true });

    if (error) {
      console.error(`❌ Failed to fetch after photos:`, error);
      return [];
    }

    return (data || []).map(item => item.url);
    
  } catch (error) {
    console.error(`❌ Error fetching after photos:`, error);
    return [];
  }
}

/**
 * Check if after photos exist for a listing and tier
 */
export async function hasAfterPhotos(
  listingId: string, 
  tier: 'livable' | 'comfortable' | 'competitive'
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('after_photos')
      .select('id')
      .eq('listing_id', listingId)
      .eq('tier', tier)
      .limit(1);

    if (error) {
      console.error(`❌ Failed to check after photos:`, error);
      return false;
    }

    return (data || []).length > 0;
    
  } catch (error) {
    console.error(`❌ Error checking after photos:`, error);
    return false;
  }
}

/**
 * Check if a cluster is excluded (views, floorplan, certificate, etc.)
 * Checks both auto-clustering system (is_excluded flag) and cluster names
 * 
 * @param clusterName - The cluster name to check
 * @param listingId - The listing ID (string or number)
 * @param supabaseClient - Supabase client instance (optional, uses default if not provided)
 * @returns true if cluster is excluded, false otherwise
 */
export async function isClusterExcluded(
  clusterName: string,
  listingId: string | number,
  supabaseClient?: ReturnType<typeof createClient>
): Promise<boolean> {
  const client = supabaseClient || supabase;
  const listingIdStr = listingId.toString();
  const nameLower = (clusterName || '').toLowerCase();

  // Quick check: if cluster name starts with "excluded -", it's definitely excluded
  if (nameLower.startsWith('excluded -')) {
    return true;
  }

  try {
    // Check auto-clustering system for excluded clusters (identified by "excluded -" prefix)
    // Get the latest test run for this listing
    const { data: latestTestRun } = await client
      .from('auto_clustering_test_runs')
      .select('test_run_id')
      .eq('listing_id', listingIdStr)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestTestRun?.test_run_id) {
      // Check if this cluster name exists in auto-clusters and starts with "excluded -"
      const { data: autoCluster } = await client
        .from('auto_photo_clusters')
        .select('cluster_name')
        .eq('listing_id', listingIdStr)
        .eq('test_run_id', latestTestRun.test_run_id)
        .eq('cluster_name', clusterName)
        .limit(1)
        .single();

      // If found and name starts with "excluded -", it's excluded
      if (autoCluster && nameLower.startsWith('excluded -')) {
        return true;
      }
    }
  } catch (error) {
    // If auto-clustering check fails, fall through to cluster name pattern check
    // This is expected if auto-clustering hasn't been run yet or cluster doesn't exist
  }

  // Fallback: check cluster name patterns (for clusters)
  return nameLower.includes('excluded') || 
         nameLower.includes('floorplan') || 
         nameLower.includes('planos') ||
         (nameLower.includes('plan') && !nameLower.includes('plant') && !nameLower.includes('planter'));
}

/**
 * Get set of excluded photo URLs for a listing
 * Combines excluded photos from both production clusters and auto-clustering test systems
 * 
 * @param listingId - The listing ID (string or number)
 * @param supabaseClient - Supabase client instance (optional, uses default if not provided)
 * @returns Set of excluded photo URLs
 */
export async function getExcludedPhotoUrls(
  listingId: string | number,
  supabaseClient?: ReturnType<typeof createClient>
): Promise<Set<string>> {
  const client = supabaseClient || supabase;
  const listingIdStr = listingId.toString();
  const excludedUrls = new Set<string>();

  try {
    // Get excluded photos from clusters
    const { data: clusters } = await client
      .from('clusters')
      .select('cluster_name, photo_urls')
      .or(`listing_id.eq.${listingIdStr},listing_id.eq.${parseInt(listingIdStr, 10)}`);

    if (clusters) {
      for (const cluster of clusters) {
        const isExcluded = await isClusterExcluded(cluster.cluster_name, listingId, client as any);
        if (isExcluded && Array.isArray(cluster.photo_urls)) {
          for (const url of cluster.photo_urls) {
            if (typeof url === 'string' && url.trim()) {
              excludedUrls.add(url);
            }
          }
        }
      }
    }

    // Get excluded photos from auto-clustering system
    const { data: latestTestRun } = await client
      .from('auto_clustering_test_runs')
      .select('test_run_id')
      .eq('listing_id', listingIdStr)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestTestRun?.test_run_id) {
      // Get all photos from excluded auto-clusters (identified by "excluded -" prefix)
      const { data: excludedAutoClusters } = await client
        .from('auto_photo_clusters')
        .select('photo_indices')
        .eq('listing_id', listingIdStr)
        .eq('test_run_id', latestTestRun.test_run_id)
        .ilike('cluster_name', 'excluded -%');

      if (excludedAutoClusters) {
        // Get photo URLs by display_order indices
        const excludedIndices = new Set<number>();
        for (const cluster of excludedAutoClusters) {
          if (Array.isArray(cluster.photo_indices)) {
            for (const idx of cluster.photo_indices) {
              if (typeof idx === 'number') {
                excludedIndices.add(idx);
              }
            }
          }
        }

        // Fetch photo URLs for these indices
        if (excludedIndices.size > 0) {
          const { data: photos } = await client
            .from('listing_photos')
            .select('url, display_order')
            .eq('listing_id', listingIdStr)
            .in('display_order', Array.from(excludedIndices));

          if (photos) {
            for (const photo of photos) {
              if (photo.url) {
                excludedUrls.add(photo.url);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️ Error fetching excluded photo URLs:`, error);
    // Continue with what we have - partial exclusion is better than none
  }

  return excludedUrls;
}

/**
 * Fetch valid listing photos (excluding Excluded and Floorplans clusters)
 * This is the standard way to get photos for analysis endpoints.
 * Now supports both production clusters and auto-clustering test systems.
 * 
 * @param listingId - The listing ID (string or number)
 * @param supabaseClient - Supabase client instance (optional, uses default if not provided)
 * @returns Array of photo objects with url property
 */
export async function fetchValidListingPhotos(
  listingId: string | number,
  supabaseClient?: ReturnType<typeof createClient>
): Promise<Array<{ url: string }>> {
  const client = supabaseClient || supabase;
  const listingIdStr = listingId.toString();

  try {
    // Get excluded photo URLs first
    const excludedUrls = await getExcludedPhotoUrls(listingId, client as any);

    // Fetch clusters to identify valid photos
    const { data: clusters, error: clustersError } = await client
      .from('clusters')
      .select('cluster_name, photo_urls')
      .or(`listing_id.eq.${listingIdStr},listing_id.eq.${parseInt(listingIdStr, 10)}`);

    if (clustersError) {
      throw new Error(`Failed to fetch clusters: ${clustersError.message}`);
    }

    // Filter out excluded clusters using helper function
    const validClusters: typeof clusters = [];
    for (const cluster of (clusters || [])) {
      const isExcluded = await isClusterExcluded(cluster.cluster_name, listingId, client as any);
      if (!isExcluded) {
        validClusters.push(cluster);
      }
    }

    // Get all photo URLs from valid clusters
    const validPhotoUrls = new Set<string>();
    for (const cluster of validClusters) {
      if (Array.isArray(cluster.photo_urls)) {
        for (const url of cluster.photo_urls) {
          if (typeof url === 'string' && url.trim() && !excludedUrls.has(url)) {
            validPhotoUrls.add(url);
          }
        }
      }
    }

    // Also check auto-clustering system for valid photos (if available)
    const { data: latestTestRun } = await client
      .from('auto_clustering_test_runs')
      .select('test_run_id')
      .eq('listing_id', listingIdStr)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestTestRun?.test_run_id) {
      // Get all non-excluded auto-clusters (exclude those starting with "excluded -")
      const { data: autoClusters } = await client
        .from('auto_photo_clusters')
        .select('photo_indices, cluster_name')
        .eq('listing_id', listingIdStr)
        .eq('test_run_id', latestTestRun.test_run_id)
        .not('cluster_name', 'ilike', 'excluded -%');

      if (autoClusters) {
        // Collect all valid photo indices
        const validIndices = new Set<number>();
        for (const cluster of autoClusters) {
          const isExcluded = await isClusterExcluded(cluster.cluster_name, listingId, client as any);
          if (!isExcluded && Array.isArray(cluster.photo_indices)) {
            for (const idx of cluster.photo_indices) {
              if (typeof idx === 'number') {
                validIndices.add(idx);
              }
            }
          }
        }

        // Fetch photo URLs for these indices
        if (validIndices.size > 0) {
          const { data: photos } = await client
            .from('listing_photos')
            .select('url, display_order')
            .eq('listing_id', listingIdStr)
            .in('display_order', Array.from(validIndices));

          if (photos) {
            for (const photo of photos) {
              if (photo.url && !excludedUrls.has(photo.url)) {
                validPhotoUrls.add(photo.url);
              }
            }
          }
        }
      }
    }

    // Convert to array of objects with url property
    const result = Array.from(validPhotoUrls).map(url => ({ url }));

    // Fallback 1: If no clusters/valid photos found, return all raw photos from listing_photos
    if (result.length === 0) {
      const { data: allPhotos } = await client
        .from('listing_photos')
        .select('url')
        .eq('listing_id', listingIdStr)
        .order('display_order');
      
      if (allPhotos && allPhotos.length > 0) {
         console.log(`ℹ️ No clusters found, using all ${allPhotos.length} photos from listing_photos`);
         return allPhotos;
      }
    }

    // Fallback 2: If still no photos, check scraped_data (legacy/extension fallback)
    if (result.length === 0) {
      const { data: listing } = await client
        .from('listings')
        .select('scraped_data')
        .eq('id', listingIdStr)
        .single();
      
      const scrapedPhotos = listing?.scraped_data?.photos;
      if (Array.isArray(scrapedPhotos) && scrapedPhotos.length > 0) {
        console.log(`ℹ️ Using ${scrapedPhotos.length} photos from scraped_data (Extension source)`);
        // Check if they are base64 strings (data:image...)
        return scrapedPhotos.map((p: string) => ({ url: p }));
      }
    }

    return result;

  } catch (error) {
    console.error(`❌ Error fetching valid listing photos:`, error);
    throw error;
  }
}

