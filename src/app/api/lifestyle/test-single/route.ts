import { NextRequest, NextResponse } from 'next/server';
import { generateLifestylePolygon } from '@/lib/lifestyle/engine';
import { extractProfileFromText } from '@/lib/lifestyle/extractor';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const text = searchParams.get('text');
  
  if (!text) {
    return NextResponse.json({ error: 'Missing text param' }, { status: 400 });
  }

  try {
    const profile = await extractProfileFromText(text);
    const hexes = await generateLifestylePolygon(profile);
    
    return NextResponse.json({
      profile,
      hexes,
      stats: {
        top_score: hexes.length > 0 ? hexes[0].scores.total : 0,
        count: hexes.length
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

