import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    console.log(`📸 Fetching photos for listing ${listingId}`);

    // Get valid photos (excluding Excluded and Floorplans clusters)
    const { fetchValidListingPhotos } = await import('@/lib/photo-storage');
    let validPhotos: Array<{ url: string }> = [];
    try {
      validPhotos = await fetchValidListingPhotos(listingId);
    } catch (error) {
      console.error('Error fetching valid photos:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to fetch valid photos: ${(error as Error).message}` 
        },
        { status: 500 }
      );
    }

    // Convert to format expected by response (matching listing_photos structure)
    const photos = validPhotos.map((p, idx) => ({
      id: idx + 1,
      url: p.url,
      listing_id: listingId,
      created_at: new Date().toISOString(),
      display_order: idx
    }));

    if (!photos || photos.length === 0) {
      console.log('No photos found in listing_photos table');
      return NextResponse.json({
        success: true,
        photos: [],
        count: 0
      });
    }

    const formattedPhotos = photos.map((photo: any, index) => ({
      id: index + 1,
      url: photo.url,
      caption: photo.tag,
      display_order: index,
      is_primary: index === 0,
      created_at: new Date().toISOString()
    }));

    console.log(`✅ Found ${photos.length} photos for listing ${listingId}`);

    return NextResponse.json({
      success: true,
      photos: formattedPhotos,
      count: formattedPhotos.length
    });

  } catch (error) {
    console.error('Photos fetch error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: (error as any)?.message || 'Failed to fetch photos' 
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    console.log(`📸 Uploading photo for listing ${listingId}`);
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const label = formData.get('label') as string; // Optional user label (e.g. "Kitchen")
    
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Convert File to ArrayBuffer
    const buffer = await file.arrayBuffer();
    
    // Store in Supabase
    const { storeFileInSupabase } = await import('@/lib/photo-storage');
    const result = await storeFileInSupabase(
      buffer,
      file.type,
      listingId
    );

    if (!result.success || !result.supabaseUrl) {
      throw new Error(result.error || 'Upload failed');
    }

    // Insert into listing_photos
    // Find the next display_order
    const { count } = await supabase
      .from('listing_photos')
      .select('*', { count: 'exact', head: true })
      .eq('listing_id', listingId);
      
    const nextOrder = count || 0;

    const { data: photoRecord, error: dbError } = await supabase
      .from('listing_photos')
      .insert({
        listing_id: listingId,
        url: result.supabaseUrl,
        display_order: nextOrder,
        photo_type: 'general',
        filename: result.filename,
        tag: label || null, // Store user label in 'tag' column
        user_label: label || null // Also explicitly in user_label if column exists (better for AI)
      })
      .select()
      .single();

    if (dbError) {
      // If user_label column doesn't exist yet, fallback to just tag
      if (dbError.message.includes('user_label')) {
         const { error: retryError } = await supabase
          .from('listing_photos')
          .insert({
            listing_id: listingId,
            url: result.supabaseUrl,
            display_order: nextOrder,
            photo_type: 'general',
            filename: result.filename,
            tag: label || null
          });
          if (retryError) throw retryError;
      } else {
        throw dbError;
      }
    }

    return NextResponse.json({
      success: true,
      photo: {
        url: result.supabaseUrl,
        label: label
      }
    });

  } catch (error: any) {
    console.error('❌ Photo Upload Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}