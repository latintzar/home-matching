import { NextRequest, NextResponse } from 'next/server';
import { clearCheckpoint } from '@/lib/checkpoints';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; step: string }> }
) {
  try {
    const { id: listingId, step } = await params;
    
    if (!listingId || !step) {
      return NextResponse.json({ error: 'Missing listing ID or step' }, { status: 400 });
    }

    await clearCheckpoint(listingId, step as any);
    
    return NextResponse.json({ 
      success: true,
      message: `Cleared checkpoint for step: ${step}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing checkpoint:', error);
    return NextResponse.json(
      { error: 'Failed to clear checkpoint' }, 
      { status: 500 }
    );
  }
}
