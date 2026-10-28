import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { agencyName, agencyLogoUrl, agencyWhatsapp } = await request.json();
    
    const supabase = createClient();

    // Generate a public slug
    const publicSlug = `deepdive-${id.slice(0, 8)}`;

    // Update deepdive with agency info and publish
    const { data: deepdive, error } = await supabase
      .from('deepdives')
      .update({
        status: 'published',
        public_slug: publicSlug,
        agency_name: agencyName,
        agency_logo_url: agencyLogoUrl,
        agency_whatsapp: agencyWhatsapp,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to publish DeepDive: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      publicUrl: `/deepdive/${publicSlug}`,
      deepdive
    });

  } catch (error) {
    console.error('Publish error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish' },
      { status: 500 }
    );
  }
}
