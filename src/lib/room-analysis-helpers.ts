/**
 * Helper functions for room analysis pipeline
 * Normalizes photo URLs and visibility mappings
 */

import { createClient } from '@supabase/supabase-js';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export interface PhotoWithVisibility {
  photo_url: string; // Original photo URL (analysis endpoints use original photos)
  original_url: string; // Original URL (same as photo_url for consistency)
  visible_rooms: string[]; // Names of other rooms visible in this photo
}

export interface ClusterPhotoData {
  cluster_id: number;
  cluster_name: string;
  photos: PhotoWithVisibility[];
}

/**
 * Fetch normalized clusters from database view
 * This replaces the runtime normalization - database handles it now
 * 
 * @param listingId - Listing ID
 * @returns Normalized photo data with furniture-free URLs and visibility mappings
 */
export async function getNormalizedClusters(
  listingId: string
): Promise<ClusterPhotoData[]> {
  // Query the normalized view directly
  const { data: clusters, error } = await supabase
    .from('clusters_normalized')
    .select('*')
    .eq('listing_id', listingId)
    .order('display_order');

  if (error) {
    throw new Error(`Failed to fetch normalized clusters: ${error.message}`);
  }

  if (!clusters || clusters.length === 0) {
    return [];
  }

  // Transform view data to ClusterPhotoData format
  return clusters.map(cluster => {
    const originalUrls = cluster.original_photo_urls || [];
    const furnitureFreeUrls = cluster.furniture_free_photo_urls || [];
    const visibilityMappings = cluster.visibility_mappings_normalized || {};

    // Build photos array with normalized data
    // Use original URLs (analysis endpoints use original photos, F0 runs after R1.5)
    const photos: PhotoWithVisibility[] = originalUrls.map((originalUrl: string, index: number) => {
      const mapping = visibilityMappings[originalUrl];
      const visibleRooms = mapping?.visible_rooms || [];

      return {
        photo_url: originalUrl, // Use original URL (not furniture-free)
        original_url: originalUrl,
        visible_rooms: visibleRooms
      };
    });

    return {
      cluster_id: cluster.cluster_id,
      cluster_name: cluster.cluster_name,
      photos
    };
  });
}

