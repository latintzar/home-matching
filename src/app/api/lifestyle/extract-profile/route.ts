import { NextRequest, NextResponse } from 'next/server';
import { extractProfileFromText } from '@/lib/lifestyle/extractor';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ success: false, error: 'Text is required' }, { status: 400 });
    }

    const profile = await extractProfileFromText(text);
    
    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    console.error('Error extracting profile:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
