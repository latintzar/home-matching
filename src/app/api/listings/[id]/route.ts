import { NextRequest, NextResponse } from 'next/server';
import { getListingById, getDataSource } from '@/lib/data-adapter';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Use data adapter (switches between Supabase/DynamoDB based on USE_DYNAMODB env)
    const listing = await getListingById(id);

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Return in consistent format
    return NextResponse.json({
      ...listing,
      // Map adapter format back to API format
      price_eur: listing.price_eur,
      _source: getDataSource(), // For debugging
    });
  } catch (error) {
    console.error('Error in listings API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}