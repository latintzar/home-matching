import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { loadAllCheckpoints } from '@/lib/checkpoints';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    
    if (!listingId) {
      return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 });
    }

    const checkpoints = await loadAllCheckpoints(listingId);
    
    return NextResponse.json({ 
      checkpoints,
      listingId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error loading checkpoints:', error);
    return NextResponse.json(
      { error: 'Failed to load checkpoints' }, 
      { status: 500 }
    );
  }
}
