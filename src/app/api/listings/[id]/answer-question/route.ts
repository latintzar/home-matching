import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { question, conversationHistory, language = "en" } = await request.json();

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

    // Simple fallback answer
    const answer = `Basándome en la información de la propiedad, puedo ayudarte con esa pregunta. La propiedad tiene ${listing.constructed_area || 'N/A'} m² construidos y está ubicada en ${listing.city || 'N/A'}. Para obtener información más específica, te recomiendo contactar directamente con el agente.`;

    return NextResponse.json({ 
      answer,
      expandButtonText: "Ver más detalles",
      expandedContent: "Información adicional sobre la propiedad disponible contactando al agente.",
      threadQuestions: [
        "¿Cuál es el precio de venta?",
        "¿Qué incluye la propiedad?",
        "¿Hay gastos adicionales?"
      ],
      isMap: false
    });

  } catch (error) {
    console.error('Answer question error:', error);
    return NextResponse.json(
      { error: 'Failed to answer question', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}