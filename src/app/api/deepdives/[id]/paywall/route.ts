import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createClient();

    // Try to find by public_slug first, then by id
    const { data: deepdive, error } = await supabase
      .from('deepdives')
      .select('total_views, max_free_views, price, paywall_enabled, stripe_payment_id')
      .or(`id.eq.${id},public_slug.eq.${id}`)
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch paywall settings' },
        { status: 500 }
      );
    }

    if (!deepdive) {
      return NextResponse.json(
        { error: 'DeepDive not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      totalViews: deepdive.total_views || 0,
      maxFreeViews: deepdive.max_free_views || 3,
      price: deepdive.price || 250,
      enabled: deepdive.paywall_enabled !== false, // Default to true
      isUnlocked: !!deepdive.stripe_payment_id // If payment exists, it's unlocked
    });

  } catch (error) {
    console.error('Paywall fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
