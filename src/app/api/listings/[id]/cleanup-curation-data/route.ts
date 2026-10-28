import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    console.log(`🧹 Cleaning curation data for listing ${listingId}`);

    // Delete all renovation_research_results for this listing
    const { error: deleteError, count } = await supabase
      .from('renovation_research_results')
      .delete()
      .eq('listing_id', listingId);

    if (deleteError) {
      console.error('Error deleting curation data:', deleteError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to delete curation data',
          details: deleteError.message 
        },
        { status: 500 }
      );
    }

    console.log(`✅ Cleaned curation data for listing ${listingId}`);

    return NextResponse.json({
      success: true,
      message: `Curation data cleaned for listing ${listingId}`
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

