import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const supabase = lazySupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get('tier');

    let query = supabase
      .from('after_photos')
      .select('url, index, photo_url, room_id, has_furniture')
      .eq('listing_id', listingId.toString())
      .eq('has_furniture', false) // Only R3 images (without furniture)
      .order('index', { ascending: true });

    if (tier) {
      query = query.eq('tier', tier);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: `Failed to fetch after photos: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      photos: data || [],
      listingId: String(listingId),
      tier: tier || 'all',
    });

  } catch (error) {
    return NextResponse.json(
      { error: `Server error: ${error}` },
      { status: 500 }
    );
  }
}
