import { NextRequest, NextResponse } from 'next/server';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { getModelForTask } from '@/lib/model-registry';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ amenities: [] });
    }

    // If simple comma separated, split locally to save tokens/latency
    if (text.includes(',') && text.length < 100) {
      const simple = text.split(',').map(s => s.trim()).filter(s => s.length > 0);
      return NextResponse.json({ amenities: simple });
    }

    const prompt = `Extract a list of individual property amenities/features from the following text.
    Return ONLY a JSON array of strings.
    Translate to English if they are in another language.
    
    TEXT: "${text}"
    
    OUTPUT JSON:`;

    const result = await callGeminiRest(prompt, {
      model: getModelForTask('text_analysis'), // Flash Lite
      temperature: 0.1,
      responseMimeType: 'application/json'
    });

    if (!result.success || !result.text) {
      // Fallback to basic split
      return NextResponse.json({ amenities: [text] });
    }

    const amenities = JSON.parse(result.text);
    return NextResponse.json({ amenities });

  } catch (error) {
    console.error('Amenities parsing error:', error);
    return NextResponse.json({ amenities: [] }, { status: 500 });
  }
}

