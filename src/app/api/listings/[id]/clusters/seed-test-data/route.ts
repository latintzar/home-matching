import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;

    console.log(`🌱 Seeding test clusters for listing ${listingId}`);

    // Get valid photos from the listing (excluding Excluded and Floorplans clusters)
    const { fetchValidListingPhotos } = await import('@/lib/photo-storage');
    let validPhotos: Array<{ url: string }> = [];
    try {
      validPhotos = await fetchValidListingPhotos(listingId);
    } catch (error) {
      throw new Error(`Failed to fetch valid photos: ${(error as Error).message}`);
    }

    if (validPhotos.length === 0) {
      return NextResponse.json({ 
        error: 'No valid photos found for this listing' 
      }, { status: 404 });
    }

    // Convert to format expected by seeding logic
    const photos = validPhotos.map(p => ({ url: p.url }));

    console.log(`📸 Found ${photos.length} photos, creating test clusters`);

    // Analyze filenames to guess room types
    const clusters = createTestClusters(photos);

    // Clear existing clusters
    const { error: deleteError } = await supabase
      .from('clusters')
      .delete()
      .eq('listing_id', listingId);

    if (deleteError) {
      throw new Error(`Failed to clear existing clusters: ${deleteError.message}`);
    }

    // Insert test clusters
    const clusterInserts = clusters.map((cluster, index) => ({
      listing_id: parseInt(listingId),
      cluster_name: cluster.name,
      room_type: cluster.room_type,
      photo_urls: cluster.urls,
      display_order: index
    }));

    const { error: insertError } = await supabase
      .from('clusters')
      .insert(clusterInserts);

    if (insertError) {
      throw new Error(`Failed to save test clusters: ${insertError.message}`);
    }

    console.log(`✅ Created ${clusters.length} test clusters`);

    return NextResponse.json({ 
      success: true, 
      clusters_created: clusters.length,
      total_photos: photos.length,
      clusters: clusters.map(c => ({
        name: c.name,
        room_type: c.room_type,
        photo_count: c.urls.length
      }))
    });

  } catch (error) {
    console.error('Seed test clusters error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to seed test clusters' },
      { status: 500 }
    );
  }
}

function createTestClusters(photos: { url: string }[]) {
  const clusters: Array<{ name: string; room_type: string; urls: string[] }> = [];
  
  // Room type patterns (Spanish and English)
  const roomPatterns = {
    'Cocina': /cocina|kitchen|cuisine/i,
    'Salón': /salon|salón|living|sala|hall/i,
    'Dormitorio Principal': /dormitorio|bedroom|habitacion|habitación|master/i,
    'Dormitorio 2': /dormitorio|bedroom|habitacion|habitación/i,
    'Baño': /bano|baño|bathroom|wc|toilet/i,
    'Terraza': /terraza|terrace|balcon|balcón/i,
    'Garaje': /garaje|garage|parking/i,
    'Trastero': /trastero|storage|almacen|almacén/i
  };

  // Initialize clusters
  Object.entries(roomPatterns).forEach(([name, pattern]) => {
    clusters.push({
      name,
      room_type: normalizeRoomType(name),
      urls: []
    });
  });

  // Distribute photos to clusters based on filename patterns
  photos.forEach(photo => {
    const url = photo.url.toLowerCase();
    let assigned = false;

    // Try to match to existing patterns
    for (const cluster of clusters) {
      const pattern = roomPatterns[cluster.name as keyof typeof roomPatterns];
      if (pattern && pattern.test(url)) {
        cluster.urls.push(photo.url);
        assigned = true;
        break;
      }
    }

    // If no pattern matches, assign to first available cluster
    if (!assigned) {
      const firstCluster = clusters.find(c => c.urls.length === 0) || clusters[0];
      firstCluster.urls.push(photo.url);
    }
  });

  // Remove empty clusters and add "General" cluster for remaining photos
  const nonEmptyClusters = clusters.filter(c => c.urls.length > 0);
  
  // If we have photos that didn't fit patterns, create a "General" cluster
  const totalAssigned = nonEmptyClusters.reduce((sum, c) => sum + c.urls.length, 0);
  if (totalAssigned < photos.length) {
    const remainingPhotos = photos.slice(totalAssigned);
    nonEmptyClusters.push({
      name: 'General',
      room_type: 'General',
      urls: remainingPhotos.map(p => p.url)
    });
  }

  return nonEmptyClusters;
}

function normalizeRoomType(clusterName: string): string {
  const mappings: Record<string, string> = {
    'Cocina': 'Kitchen',
    'Salón': 'Living Room',
    'Dormitorio Principal': 'Bedroom',
    'Dormitorio 2': 'Bedroom',
    'Baño': 'Bathroom',
    'Terraza': 'Terrace',
    'Garaje': 'Garage',
    'Trastero': 'Storage',
    'General': 'General'
  };

  return mappings[clusterName] || clusterName;
}
