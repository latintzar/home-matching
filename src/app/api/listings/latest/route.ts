/**
 * Get Latest Listing ID
 * 
 * Helper endpoint to get the most recently created listing ID for testing.
 */

import { NextResponse } from 'next/server';
import { getListings, getDataSource } from '@/lib/data-adapter';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Use data adapter (switches between Supabase/DynamoDB based on USE_DYNAMODB env)
    const listings = await getListings({ limit: 1 });

    if (!listings || listings.length === 0) {
      return NextResponse.json(
        { success: false, error: 'no_listings', details: 'No listings found' },
        { status: 404 }
      );
    }

    const listing = listings[0];

    return NextResponse.json({
      success: true,
      listing: {
        id: listing.id,
        title: listing.title,
        created_at: listing.created_at,
        price_eur: listing.price_eur,
      },
      _source: getDataSource(), // For debugging
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'fetch_failed',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

