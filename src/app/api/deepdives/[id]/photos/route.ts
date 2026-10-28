import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { photos } = await request.json();
    
    if (!Array.isArray(photos)) {
      return NextResponse.json({ error: 'Photos array is required' }, { status: 400 });
    }

    const supabase = createClient();

    // Note: deepdive_photos table was deprecated
    // Deep dive photos are now stored in clusters
    // This endpoint is kept for backward compatibility but may need refactoring
    
    // For now, return success without modifying deprecated table
    // TODO: Refactor to use clusters or appropriate table

    return NextResponse.json({ 
      success: true,
      message: 'deepdive_photos table is deprecated. Use clusters instead.',
      deprecated: true
    });

  } catch (error) {
    console.error('Photo tagging error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save photos' },
      { status: 500 }
    );
  }
}
