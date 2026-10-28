import { NextRequest, NextResponse } from 'next/server';
import { LifestyleProfile } from '@/types/lifestyle';
import { generateLifestylePolygon } from '@/lib/lifestyle/engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { profile } = body as { profile: LifestyleProfile };

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Profile required' }, { status: 400 });
    }

    const hexes = await generateLifestylePolygon(profile);
    return NextResponse.json({ success: true, hexes });

  } catch (error: any) {
    console.error('Error generating polygon:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

