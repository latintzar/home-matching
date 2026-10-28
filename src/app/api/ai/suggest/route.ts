import { NextRequest, NextResponse } from 'next/server';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors when env vars aren't available
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase environment variables not configured');
  }
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseClient();
  try {
    const body = await req.json().catch(() => ({}));
    const listingId = body?.listingId ?? null;

    if (!listingId) {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    // Convert listingId to integer for tables that use INTEGER/BIGINT (most tables)
    const listingIdInt = parseInt(listingId, 10);
    if (isNaN(listingIdInt)) {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    // Build context from all available data sources (same as chat endpoint)
    let contextParts: string[] = [];

    // 1. Property Details (basic listing + text analysis integrated)
    const { data: listing } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    const { data: textAnalysis } = await supabase
      .from('text_analysis_results')
      .select('*')
      .eq('listing_id', listingIdInt)
      .eq('phase', 'listing_diagnostic')
      .single();

    if (listing || textAnalysis) {
      contextParts.push('=== PROPERTY DETAILS ===');
      if (listing) {
        contextParts.push(`Title: ${listing.title || 'N/A'}`);
        contextParts.push(`Price: €${(listing.price_eur || listing.price || 0).toLocaleString()}`);
        contextParts.push(`Area: ${listing.sqm || listing.constructed_area || 'N/A'} m²`);
        contextParts.push(`Bedrooms: ${listing.bedrooms || 'N/A'}`);
        contextParts.push(`Bathrooms: ${listing.bathrooms || 'N/A'}`);
        contextParts.push(`Location: ${listing.address || listing.location || 'N/A'}`);
        if (listing.year_built) contextParts.push(`Year built: ${listing.year_built}`);
      }
      if (textAnalysis?.results) {
        const results = typeof textAnalysis.results === 'string' ? JSON.parse(textAnalysis.results) : textAnalysis.results;
        if (results.conclusions) contextParts.push(`Summary: ${JSON.stringify(results.conclusions)}`);
        if (results.strengths) contextParts.push(`Strengths: ${JSON.stringify(results.strengths)}`);
        if (results.verify) contextParts.push(`To verify: ${JSON.stringify(results.verify)}`);
      }
      contextParts.push('');
    }

    // 2. Text Analysis (all phases)
    const { data: allTextAnalysis } = await supabase
      .from('text_analysis_results')
      .select('*')
      .eq('listing_id', listingIdInt)
      .order('created_at', { ascending: true });

    if (allTextAnalysis && allTextAnalysis.length > 0) {
      contextParts.push('=== TEXT ANALYSIS ===');
      for (const ta of allTextAnalysis) {
        const phaseName = ta.phase?.toUpperCase().replace(/_/g, ' ') || 'UNKNOWN';
        const results = typeof ta.results === 'string' ? JSON.parse(ta.results) : ta.results;
        contextParts.push(`${phaseName}: ${JSON.stringify(results, null, 2)}`);
      }
      contextParts.push('');
    }

    // 3. Whole Property Analysis
    const { data: wholeProperty } = await supabase
      .from('whole_property_analysis')
      .select('analysis_data')
      .eq('listing_id', listingIdInt)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (wholeProperty?.analysis_data) {
      contextParts.push('=== WHOLE PROPERTY ANALYSIS ===');
      contextParts.push(JSON.stringify(wholeProperty.analysis_data, null, 2));
      contextParts.push('');
    }

    // 4. Room-by-Room Analysis
    const { data: roomAnalyses } = await supabase
      .from('room_analyses')
      .select('analysis_data')
      .eq('listing_id', listingIdInt)
      .order('created_at', { ascending: false });

    if (roomAnalyses && roomAnalyses.length > 0) {
      contextParts.push('=== ROOM-BY-ROOM ANALYSIS ===');
      for (const ra of roomAnalyses) {
        if (ra.analysis_data) {
          contextParts.push(JSON.stringify(ra.analysis_data, null, 2));
        }
      }
      contextParts.push('');
    }

    // 5. Analysis Google Search Curated Results
    const { data: analysisCurated } = await supabase
      .from('analysis_curated_results')
      .select('*')
      .eq('listing_id', listingId)
      .order('category');

    if (analysisCurated && analysisCurated.length > 0) {
      contextParts.push('=== GOOGLE SEARCH: ANALYSIS RESEARCH (CURATED) ===');
      for (const ac of analysisCurated) {
        contextParts.push(`Category: ${ac.category}`);
        contextParts.push(`Summary: ${ac.summary || 'N/A'}`);
        contextParts.push(`Key Points: ${JSON.stringify(ac.key_points || [])}`);
        contextParts.push('');
      }
    }

    // 6. Renovation Google Search Curated Results
    const { data: renovationCurated } = await supabase
      .from('renovation_research_results')
      .select('*')
      .eq('listing_id', listingIdInt)
      .order('category');

    if (renovationCurated && renovationCurated.length > 0) {
      contextParts.push('=== GOOGLE SEARCH: RENOVATION RESEARCH (CURATED) ===');
      for (const rc of renovationCurated) {
        contextParts.push(`Category: ${rc.category}`);
        if (rc.report_data) {
          const reportData = typeof rc.report_data === 'string' ? JSON.parse(rc.report_data) : rc.report_data;
          contextParts.push(`Report Data: ${JSON.stringify(reportData, null, 2)}`);
        }
        contextParts.push('');
      }
    }

    // 7. Final Renovation Scope Data
    const { data: renovationScope } = await supabase
      .from('final_renovation_scope')
      .select('scope_data')
      .eq('listing_id', listingIdInt)
      .single();

    if (renovationScope?.scope_data) {
      contextParts.push('=== FINAL RENOVATION SCOPE ===');
      const scopeData = typeof renovationScope.scope_data === 'string' 
        ? JSON.parse(renovationScope.scope_data) 
        : renovationScope.scope_data;
      contextParts.push(JSON.stringify(scopeData, null, 2));
      contextParts.push('');
    }

    // Build prompt for question generation
    const contextStr = contextParts.length > 0 
      ? `\n\n=== PROPERTY CONTEXT ===\n${contextParts.join('\n')}\n=== END CONTEXT ===\n\n` 
      : '\n(No property context available yet.)\n\n';

    // Get conversation history from body if provided
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = Array.isArray(body?.messages) ? body.messages : [];

    // Build conversation history string
    const conversationHistory = messages.length > 0
      ? `\n\n=== PREVIOUS CONVERSATION ===\n${messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')}\n=== END CONVERSATION ===\n`
      : '';

    const system = `You are generating helpful, specific questions for a property buyer. Based on the property context${messages.length > 0 ? ' and the conversation history' : ''}, generate EXACTLY 3 buyer-friendly questions that would be valuable to ask the agent. Focus on things mentioned in the analysis that need verification, unknowns, or important details. ${messages.length > 0 ? 'Avoid repeating questions already asked in the conversation. Generate new, different questions that haven\'t been covered yet.' : ''} Avoid generic questions. Make them specific to THIS property based on the context.

CRITICAL: Each question must be 140 characters or less (including spaces and punctuation).`;

    const prompt = `${system}${contextStr}${conversationHistory}Generate exactly 3 questions:`;

    // Define structured output schema
    const responseSchema = {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'string',
            maxLength: 140
          },
          minItems: 3,
          maxItems: 3
        }
      },
      required: ['questions']
    };

    const res = await callGeminiRest(prompt, {
      model: 'gemini-2.5-flash-lite',
      temperature: 0.4,
      maxOutputTokens: 512,
      responseMimeType: 'application/json',
      responseSchema
    });

    if (!res.success || !res.text) {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    // Parse JSON response - schema already enforces length and count
    let suggestions: string[] = [];
    try {
      const parsed = JSON.parse(res.text.trim());
      suggestions = Array.isArray(parsed.questions) ? parsed.questions : [];
    } catch (e) {
      console.error('Failed to parse structured output:', e);
      return NextResponse.json({ success: true, suggestions: [] });
    }

    return NextResponse.json({ success: true, suggestions, listingId });
  } catch (e: any) {
    console.error('Suggest API error:', e);
    return NextResponse.json({ success: false, suggestions: [], error: e?.message || 'unknown_error' }, { status: 200 });
  }
}


