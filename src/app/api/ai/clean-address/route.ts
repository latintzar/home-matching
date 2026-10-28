
import { NextResponse } from 'next/server';
import { callGeminiRest } from '@/lib/gemini-rest-client';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { address } = await req.json();

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const prompt = `You are an address cleaner. Extract ONLY the physical location.

REMOVE completely:
- Property types: Piso, Ático, Casa, Chalet, Apartamento, Dúplex, Estudio, Loft, Villa, Finca, Flat, Apartment, House
- Sale/rent words: en venta, en alquiler, for sale, for rent, a la venta
- Prepositions before address: en, in, at, a
- Prices: €, EUR, anything with numbers and currency
- References: Ref, referencia, reference
- Marketing words: exclusivo, luxury, nuevo, new, reformado, renovated
- Descriptions: habitaciones, dormitorios, m², sqm, baños, bathrooms

KEEP only:
- Street name (Calle, Carrer, Avenida, Paseo, Plaza, etc.)
- Street number if present
- Neighborhood name
- City name
      
      Examples:
"Piso en venta en Calle de Serrano, 45, Madrid" → "Calle de Serrano 45, Madrid"
"Ático en Carrer de Balmes, Eixample, Barcelona" → "Carrer de Balmes, Eixample, Barcelona"
"Chalet adosado en venta en Calle del Vicari Joaquim Fuster, Portixol-Molinar, Palma de Mallorca" → "Calle del Vicari Joaquim Fuster, Palma de Mallorca"
"Piso en Salamanca, Madrid" → "Salamanca, Madrid"
"Casa en La Moraleja" → "La Moraleja"
"Flat for sale in Calle Mayor 15, Centro, Madrid - 3 bedrooms" → "Calle Mayor 15, Madrid"

Input: "${address}"

Output (ONLY the cleaned address, nothing else):`;

    const response = await callGeminiRest(prompt, {
      model: 'gemini-2.5-flash-lite-preview-02-05', // Use Flash Lite for speed
      temperature: 0.1,
      maxOutputTokens: 50,
    });

    if (!response.success || !response.text) {
      console.error('Gemini cleaning failed:', response.error);
      return NextResponse.json({ cleaned: address }); // Fallback to original
    }

    const cleaned = response.text.trim();
    console.log(`🧹 Cleaned address: "${address}" -> "${cleaned}"`);

    return NextResponse.json({ cleaned });
  } catch (error: any) {
    console.error('Address cleaning API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

