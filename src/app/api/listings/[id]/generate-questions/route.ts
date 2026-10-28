import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { conversationHistory, language = "en" } = await request.json();
    
    const supabase = createClient();

    // Get listing data
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (listingError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Simple fallback questions
    const questions = [
      "¿Cuál es el estado actual de las instalaciones eléctricas?",
      "¿Qué reformas serían más prioritarias en esta propiedad?",
      "¿Cuánto tiempo llevaría una renovación completa?"
    ];
    
    return NextResponse.json({ questions });

  } catch (error) {
    console.error('Generate questions error:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}