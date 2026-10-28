import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createClient();

    // Get deepdive info
    const { data: deepdive, error: deepdiveError } = await supabase
      .from('deepdives')
      .select('*')
      .eq('id', id)
      .single();

    if (deepdiveError || !deepdive) {
      return NextResponse.json({ error: 'DeepDive not found' }, { status: 404 });
    }

    // Update status to generating
    await supabase
      .from('deepdives')
      .update({ status: 'generating' })
      .eq('id', id);

    // Start the DeepDive generation process
    // This will use the existing DeepDive generation endpoint
    const deepdiveUrl = `/api/listings/${deepdive.listing_id}/deepdive/generate-stream`;
    
    try {
      const deepdiveResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000'}${deepdiveUrl}`, {
        method: 'GET'
      });

      if (!deepdiveResponse.ok) {
        throw new Error('DeepDive generation failed');
      }

      // Update deepdive status to ready
      await supabase
        .from('deepdives')
        .update({ status: 'ready' })
        .eq('id', id);

      return NextResponse.json({ success: true });

    } catch (deepdiveError) {
      // Update status back to draft on error
      await supabase
        .from('deepdives')
        .update({ status: 'draft' })
        .eq('id', id);

      throw deepdiveError;
    }

  } catch (error) {
    console.error('DeepDive generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'DeepDive generation failed' },
      { status: 500 }
    );
  }
}
