import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get all deepdives with their listing info
    const { data: deepdives, error: deepdivesError } = await supabase
      .from('deepdives')
      .select(`
        *,
        listings (
          id,
          title,
          address,
          city,
          price_eur
        )
      `)
      .order('created_at', { ascending: false });

    if (deepdivesError) {
      throw new Error(`Failed to fetch deepdives: ${deepdivesError.message}`);
    }

    // Get all requests
    const { data: requests, error: requestsError } = await supabase
      .from('deepdive_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (requestsError) {
      throw new Error(`Failed to fetch requests: ${requestsError.message}`);
    }

    return NextResponse.json({
      deepdives: deepdives || [],
      requests: requests || []
    });

  } catch (error) {
    console.error('Dashboard data error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
