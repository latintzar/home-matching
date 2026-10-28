import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing required environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, undefined, requireRecipientConfiguration);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    // Get valid photos from the listing (excluding Excluded and Floorplans clusters)
    const { fetchValidListingPhotos } = await import('@/lib/photo-storage');
    const validPhotos = await fetchValidListingPhotos(listingId);

    if (validPhotos.length === 0) {
      throw new Error('No valid photos found for clustering');
    }

    // Convert to format expected by clustering logic
    const photos = validPhotos.map((p, idx) => ({
      url: p.url,
      display_order: idx,
      id: idx + 1
    }));

    // Create simple room clusters for testing
    const roomTypes = [
      'Salón',
      'Cocina', 
      'Dormitorio 1',
      'Dormitorio 2',
      'Baño',
      'Terraza',
      'Balcón',
      'Garaje'
    ];

    // Distribute photos evenly across room types
    const photosPerRoom = Math.ceil(photos.length / roomTypes.length);
    const clusters = [];

    for (let i = 0; i < roomTypes.length; i++) {
      const startIndex = i * photosPerRoom;
      const endIndex = Math.min(startIndex + photosPerRoom, photos.length);
      const roomPhotos = photos.slice(startIndex, endIndex);

      if (roomPhotos.length > 0) {
        clusters.push({
          room_name: roomTypes[i],
          photos: roomPhotos.map(photo => ({
            id: photo.id,
            url: photo.url,
            display_order: photo.display_order
          })),
          created_at: new Date().toISOString()
        });
      }
    }

    // Save clusters to clusters
    const clusterInserts = clusters.map((cluster, index) => ({
      listing_id: parseInt(listingId),
      cluster_name: cluster.room_name,
      photo_urls: cluster.photos.map(p => p.url),
      display_order: index
    }));

    const { error: clusterError } = await supabase
      .from('clusters')
      .insert(clusterInserts);

    if (clusterError) {
      throw new Error(`Failed to save clusters: ${clusterError.message}`);
    }

    // Skip photo assignments for now - just create clusters

    return NextResponse.json({
      success: true,
      clusters: clusters.length,
      photos: photos.length,
      message: `Created ${clusters.length} room clusters with ${photos.length} photos`
    });

  } catch (error) {
    console.error('Auto-clustering error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: (error as any)?.message || 'Auto-clustering failed' 
      },
      { status: 500 }
    );
  }
}
