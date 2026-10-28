import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiJSON } from '../../../../../lib/text-analysis-helpers';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

const WHATSAPP_MESSAGE_PROMPT = (propertyData: any, categoryUnknowns: any) => `You are composing a WhatsApp message for a potential property buyer to send to a real estate agent.

PROPERTY INFORMATION:
- Title: ${propertyData.title || 'Property'}
- Price: ${propertyData.price ? `${propertyData.price.toLocaleString('es-ES')} EUR` : 'Price not specified'}
- Area: ${propertyData.constructedArea ? `${propertyData.constructedArea} m²` : 'Area not specified'}
- Bedrooms: ${propertyData.bedrooms || 'Not specified'}
- Bathrooms: ${propertyData.bathrooms || 'Not specified'}

UNKNOWNS BY CATEGORY:
${JSON.stringify(categoryUnknowns, null, 2)}

TASK: Create a professional, friendly WhatsApp message that:
1. Introduces the buyer politely
2. Mentions the specific property with key details
3. Lists the unknowns in a clear, organized way
4. Asks for help in a respectful manner
5. Uses Spanish language
6. Keeps it concise but comprehensive
7. Uses WhatsApp formatting (bold with *text*, bullet points with •)

Return ONLY the message text, no additional formatting or explanations.`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    console.log(`📱 Generating WhatsApp message for listing ${listingId}`);

    // Get listing data
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return Response.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Get text analysis results
    const { data: textResults, error: textError } = await supabase
      .from('text_analysis_results')
      .select('*')
      .eq('listing_id', listingId)
      .eq('phase', 'c_unknowns')
      .single();

    if (textError || !textResults) {
      return Response.json({ error: 'Unknowns not found. Run text analysis first.' }, { status: 404 });
    }

    const { categoryUnknowns } = textResults.results;
    
    if (!categoryUnknowns || Object.keys(categoryUnknowns).length === 0) {
      return Response.json({ error: 'No unknowns found for this property' }, { status: 400 });
    }

    // Prepare property data
    const scrapedData = listing.scraped_data || {};
    const propertyData = {
      title: listing.title,
      price: scrapedData.price_eur,
      constructedArea: scrapedData.areas?.constructed,
      usefulArea: scrapedData.areas?.useful,
      bedrooms: scrapedData.bedrooms,
      bathrooms: scrapedData.bathrooms,
    };

    // Generate WhatsApp message using Gemini
    const message = await callGeminiJSON(WHATSAPP_MESSAGE_PROMPT(propertyData, categoryUnknowns), false, true); // Use Flash Lite for simple message generation
    
    if (!message || typeof message !== 'string') {
      return Response.json({ error: 'Failed to generate message' }, { status: 500 });
    }

    console.log('✅ WhatsApp message generated successfully');

    return Response.json({
      success: true,
      message,
      whatsappUrl: `https://wa.me/?text=${encodeURIComponent(message)}`
    });

  } catch (error) {
    console.error('WhatsApp message generation error:', error);
    return Response.json({
      error: `Failed to generate WhatsApp message: ${(error as any)?.message || 'unknown error'}`
    }, { status: 500 });
  }
}
