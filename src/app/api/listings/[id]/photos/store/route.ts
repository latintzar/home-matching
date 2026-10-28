import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { storeListingPhotos } from '@/lib/photo-storage';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = lazySupabaseClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    
    console.log(`📸 Storing photos for listing: ${listingId}`);

    // Get photos from listing_photos table
    const { data: photos, error: photosError } = await supabase
      .from('listing_photos')
      .select('url, photo_type, display_order')
      .eq('listing_id', listingId)
      .order('display_order');

    if (photosError) {
      throw new Error(`Failed to fetch photos: ${photosError.message}`);
    }

    if (!photos || photos.length === 0) {
      return NextResponse.json({
        success: true,
        storedCount: 0,
        message: 'No photos found to store'
      });
    }

    console.log(`📸 Found ${photos.length} photos to store`);

    // Store photos in Supabase Storage
    const storageResults = await storeListingPhotos(
      photos.map((photo, index) => ({
        url: photo.url,
        filename: `${photo.photo_type}_${index + 1}.jpg`
      })),
      listingId
    );

    // Filter successful uploads
    const successfulUploads = storageResults.filter(result => result.success);
    
    // Update database with Supabase Storage URLs
    if (successfulUploads.length > 0) {
      for (const result of successfulUploads) {
        await supabase
          .from('listing_photos')
          .update({
            url: result.supabaseUrl,
            original_url: result.originalUrl,
            filename: result.filename
          })
          .eq('listing_id', listingId)
          .eq('url', result.originalUrl);
      }
    }

    console.log(`✅ Successfully stored ${successfulUploads.length}/${photos.length} photos`);

    return NextResponse.json({
      success: true,
      storedCount: successfulUploads.length,
      totalPhotos: photos.length,
      message: `Stored ${successfulUploads.length}/${photos.length} photos in Supabase Storage`
    });

  } catch (error) {
    console.error('❌ Photo storage failed:', error);
    return NextResponse.json({
      success: false,
      error: (error as any)?.message || 'Photo storage failed'
    }, { status: 500 });
  }
}
