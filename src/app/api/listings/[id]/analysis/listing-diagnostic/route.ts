import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { DIAGNOSTIC_ANALYSIS_PROMPT } from '@/lib/prompts/diagnostic-analysis';
import { 
  DiagnosticAnalysisReport,
  ListingDiagnosticInputs,
  isDiagnosticAnalysisReport
} from '@/types/diagnostic-analysis';
import { createStepLogger } from '@/lib/orchestrator-progress';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if called from orchestrator - if so, use step logger to stream logs
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'H';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  const { id: listingId } = await params;

  try {
    logger.log(`📋 Starting Listing Diagnostic Analysis for listing ${listingId}`);
    
    // Fetch Text Analysis results (B3-snippets: "What we know", C-unknowns: "What's missing")
    const { data: textResults, error: textError } = await supabase
      .from('text_analysis_results')
      .select('*')
      .eq('listing_id', listingId)
      .in('phase', ['b3_snippets', 'c_unknowns'])
      .order('created_at', { ascending: true });

    if (textError || !textResults || textResults.length === 0) {
      throw new Error('Text Analysis results not found. Run Text Analysis pipeline first.');
    }

    // Fetch Photo Analysis results from NEW tables (Architecture Improvement)
    // Handle both string and numeric listing_id formats
    const listingIdNum = parseInt(listingId, 10);
    const { data: wholePropertyData, error: wholePropertyError } = await supabase
      .from('whole_property_analysis')
      .select('analysis_data')
      .or(`listing_id.eq.${listingIdNum},listing_id.eq.${listingId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const { data: roomAnalysesData, error: roomAnalysesError } = await supabase
      .from('room_analyses') // Room-by-room analysis table
      .select('analysis_data, room_layout_json, unified_home_layout_json')
      .or(`listing_id.eq.${listingIdNum},listing_id.eq.${listingId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (wholePropertyError || !wholePropertyData) {
      throw new Error('Whole property analysis not found. Run /photo-analysis/whole-property first.');
    }

    if (roomAnalysesError || !roomAnalysesData) {
      throw new Error('Room-by-room analysis not found. Run /photo-analysis/room-by-room first.');
    }

    // Get listing data
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      throw new Error('No listing data found.');
    }

    // Count total valid photos analyzed (excluding Excluded and Floorplans clusters)
    const { fetchValidListingPhotos } = await import('@/lib/photo-storage');
    const validPhotos = await fetchValidListingPhotos(listingId);
    const photosCount = validPhotos.length;

    logger.log(`✅ Retrieved Text Analysis (${textResults.length} phases) and Photo Analysis data`);

    // Build inputs for diagnostic analysis
    // B3: "What we know" - Categorized snippets
    const b3Snippets = textResults.find(r => r.phase === 'b3_snippets')?.results || {};
    // C: "What's missing" - Unknowns checklist
    const cUnknowns = textResults.find(r => r.phase === 'c_unknowns')?.results || {};
    
    // Use new photo analysis data structure
    const wholePropertyAnalysis = wholePropertyData.analysis_data;
    const roomByRoomAnalysis = roomAnalysesData.analysis_data; // This is an array of RoomAnalysis
    
    // Fetch E1/E2 layout data
    const roomLayoutsMap = roomAnalysesData.room_layout_json || {}; // JSONB object: roomId -> RoomLayoutJSON
    const unifiedLayout = roomAnalysesData.unified_home_layout_json || null; // JSONB object: UnifiedHomeLayoutJSON
    
    // Convert roomLayoutsMap to array format for easier processing
    const roomLayouts = Object.entries(roomLayoutsMap).map(([roomId, layout]) => ({
      room_id: roomId,
      ...(layout as any)
    }));
    
    // Add layout_reference blocks to each room in roomByRoomAnalysis
    const roomByRoomWithLayouts = Array.isArray(roomByRoomAnalysis) ? roomByRoomAnalysis.map((room: any) => {
      // Try to match room by cluster_id or room_id
      const roomId = room.cluster_id || room.room_id || room.id;
      const matchingLayout = roomLayouts.find((layout: any) => 
        layout.room_id === roomId || 
        layout.room_id === `cluster_${roomId}` ||
        String(layout.room_id) === String(roomId)
      );
      
      if (matchingLayout) {
        return {
          ...room,
          layout_reference: {
            room_id: matchingLayout.room_id,
            surfaces: matchingLayout.surfaces || {},
            objects: matchingLayout.objects?.map((obj: any) => ({
              id: obj.id,
              type: obj.type,
              room_ref: obj.room_ref
            })) || [],
            openings: matchingLayout.openings || []
          }
        };
      }
      return room;
    }) : roomByRoomAnalysis;

    const inputs: ListingDiagnosticInputs = {
      listingId: listingId, // Add listing ID
      textAnalysis: {
        // B3: Categorized snippets - "What we know"
        categorySnippets: b3Snippets.categorySnippets || {},
        // C: Unknowns checklist - "What's missing"
        unknowns: cUnknowns.unknownsChecklist || []
      },
      photoAnalysis: {
        wholeProperty: wholePropertyAnalysis,
        roomByRoom: roomByRoomWithLayouts,
        photosCount: photosCount
      },
      roomLayouts: roomLayouts,
      unifiedLayout: unifiedLayout,
      listingMetadata: {
        title: listing.scraped_data?.title || listing.title || 'Property',
        price: listing.scraped_data?.price || listing.price_eur || 0,
        size: listing.scraped_data?.areas?.constructed || listing.scraped_data?.areas?.useful || 0,
        bedrooms: listing.scraped_data?.bedrooms || 0,
        bathrooms: listing.scraped_data?.bathrooms || 0,
        floor: listing.floor_number?.toString() || listing.floor || listing.scraped_data?.floor || undefined,
        yearBuilt: listing.year_built || listing.scraped_data?.year || undefined,
        location: listing.scraped_data?.city || listing.city || listing.address
      }
    };

    // Fetch curated research results (Google Search summaries)
    const { data: curatedResearch, error: researchError } = await supabase
      .from('analysis_curated_results')
      .select('*')
      .eq('listing_id', listingId);

    let researchSummaries: Record<string, {
      summary: string;
      key_points: string[];
      confidence_level: 'high' | 'medium' | 'low';
      sources_used: string[];
    }> = {};
    if (!researchError && curatedResearch && curatedResearch.length > 0) {
      // Group by category
      curatedResearch.forEach((item: any) => {
        researchSummaries[item.category] = {
          summary: item.summary,
          key_points: item.key_points || [],
          confidence_level: item.confidence_level,
          sources_used: item.sources_used || []
        };
      });
      logger.log(`✅ Retrieved ${curatedResearch.length} curated research categories`);
    } else {
      logger.log('⚠️ No curated research found - analysis will proceed without research context');
    }

    // Add curated research to inputs
    inputs.researchContext = researchSummaries;

    // Generate diagnostic analysis prompt
    const prompt = DIAGNOSTIC_ANALYSIS_PROMPT(inputs);

    // Define response schema for structured output (matching DiagnosticAnalysisReport interface)
    const responseSchema = {
      type: 'object',
      properties: {
        listing_id: { type: 'string' },
        analysis_date: { type: 'string' },
        findings_by_category: {
          type: 'object',
          properties: {
            estado_materiales: { type: 'string' },
            espacios_distribucion: { type: 'string' },
            entorno_vistas: { type: 'string' },
            servicios_instalaciones: { type: 'string' },
            legal_economico: { type: 'string' },
            seguridad_accesibilidad: { type: 'string' },
            caracter_arquitectonico: { type: 'string' }
          },
          required: ['estado_materiales', 'espacios_distribucion', 'entorno_vistas', 'servicios_instalaciones', 'legal_economico', 'seguridad_accesibilidad', 'caracter_arquitectonico']
        },
        visible_strengths: {
          type: 'array',
          items: { type: 'string' }
        },
        verification_focus: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              aspect: { type: 'string' },
              why_uncertain: { type: 'string' },
              suggested_action: { type: 'string' },
              severity: { type: 'string', enum: ['low', 'medium', 'high'] }
            },
            required: ['aspect', 'why_uncertain', 'suggested_action', 'severity']
          }
        },
        effort_impact: { type: 'string' },
        key_takeaways: {
          type: 'array',
          items: { type: 'string' }
        },
        disclaimer: { type: 'string' }
      },
      required: ['listing_id', 'analysis_date', 'findings_by_category', 'visible_strengths', 'verification_focus', 'effort_impact', 'key_takeaways', 'disclaimer']
    };

    logger.log('🤖 Calling Gemini REST API for diagnostic analysis with curated research...');

    const startTime = Date.now();
    const response = await callGeminiRest(prompt, {
      model: 'gemini-2.5-pro', // Use Pro for diagnostic analysis
        temperature: 0.1, // Low temperature for factual, consistent output
        topP: 0.8,
        topK: 40,
      maxOutputTokens: 8192,
      thinkingConfig: {
        thinkingBudget: 32768 // Max thinking tokens as requested
      },
      responseMimeType: 'application/json',
      responseSchema
    });
    const duration = Date.now() - startTime;

    if (!response.success || !response.text) {
      logger.error('❌ Gemini REST API call failed:', response.error);
      throw new Error(`Failed to get AI response: ${response.error}`);
    }
    
    // Extract citations from curated research
    let citations: Array<{ index: number; url: string; title: string; domain: string }> = [];
    
    if (curatedResearch && curatedResearch.length > 0) {
      // Get top representative snippets as citations
      curatedResearch.forEach((item: any) => {
        const snippets = item.representative_snippets || [];
        snippets.forEach((snippet: any) => {
          if (snippet.url && !citations.find(c => c.url === snippet.url)) {
            citations.push({
              index: citations.length + 1,
              url: snippet.url,
              title: snippet.text?.substring(0, 100) || `Source ${citations.length + 1}`,
              domain: snippet.source_domain || ''
            });
          }
        });
      });
      
      logger.log(`📚 Extracted ${citations.length} citations from curated research`);
    }
    
    logger.log(`✅ Gemini response received in ${duration}ms`);

    const responseText = response.text;
    logger.log('📊 Raw Gemini response length:', responseText.length);

    // Parse JSON response (structured output guarantees valid JSON)
    let diagnosticReport: DiagnosticAnalysisReport;
    try {
      // Structured output should provide clean JSON, but strip markdown code blocks if present
      const cleaned = responseText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const parsedReport = JSON.parse(cleaned) as any;
      
      // Validate structure
      if (!isDiagnosticAnalysisReport(parsedReport)) {
        logger.warn('Response structure validation failed, checking fields...');
        // Still throw if required fields are missing
        if (!parsedReport.visible_strengths || !parsedReport.effort_impact || !parsedReport.verification_focus || !parsedReport.disclaimer) {
          throw new Error('Response missing required fields: visible_strengths, verification_focus, effort_impact, or disclaimer');
        }
      }
      
      // Type assertion after validation
      diagnosticReport = parsedReport as unknown as DiagnosticAnalysisReport;
      
      // Add citations to the report (optional metadata)
      (diagnosticReport as any).citations = citations;
      
    } catch (parseError) {
      logger.error('JSON parsing error:', parseError);
      logger.error('Raw response:', responseText);
      throw new Error(`Failed to parse diagnostic analysis: ${parseError}`);
    }

    // Save to text_analysis_results table with new phase
    const { error: saveError } = await supabase
      .from('text_analysis_results')
      .upsert({
        listing_id: listingId,
        phase: 'listing_diagnostic',
        results: diagnosticReport,
        status: 'completed',
        created_at: new Date().toISOString()
      }, {
        onConflict: 'listing_id,phase'
      });

    if (saveError) {
      throw new Error(`Failed to save diagnostic analysis: ${saveError.message}`);
    }

    logger.log(`✅ Listing Diagnostic Analysis completed`);

    return NextResponse.json({
      success: true,
      message: 'Listing diagnostic analysis completed',
      data: diagnosticReport, // Return full report
      metadata: {
        photos_reviewed: photosCount,
        response_time_ms: duration,
        categories_analyzed: Object.keys(diagnosticReport.findings_by_category).length,
        verification_focus_count: diagnosticReport.verification_focus.length,
        visible_strengths_count: diagnosticReport.visible_strengths.length,
        key_takeaways_count: diagnosticReport.key_takeaways.length,
        citations_count: citations.length
      }
    });

  } catch (error) {
    logger.error('❌ Listing diagnostic analysis error:', error);
    
    return NextResponse.json({
      success: false,
      error: (error as any)?.message || 'Listing diagnostic analysis failed'
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    const { data: analysis, error } = await supabase
      .from('text_analysis_results')
      .select('*')
      .eq('listing_id', listingId)
      .eq('phase', 'listing_diagnostic')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !analysis) {
      return NextResponse.json({ 
        success: false, 
        error: 'No listing diagnostic analysis found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: analysis.results
    });

  } catch (error) {
    console.error('Get listing diagnostic analysis error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as any)?.message || 'Failed to fetch listing diagnostic analysis'
    }, { status: 500 });
  }
}

