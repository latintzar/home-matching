import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest, GeminiImageInput } from '@/lib/gemini-rest-client';
import { WHOLE_PROPERTY_ANALYSIS_PROMPT } from '@/lib/prompts/architecture-improvement-prompts';
import { WholePropertyAnalysis } from '@/types/renovation-intelligence';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

/**
 * E3: Whole-Property Analysis
 * 
 * POST /api/listings/[id]/photo-analysis/whole-property
 * 
 * Input: listing_id, photos[] (all non-plan images), minimal listing metadata, E2 unified layout
 * Model: Gemini 2.5 Pro, max-thinking, low temp
 * Output: WholePropertyAnalysis
 * 
 * Uses E2 unified layout to understand spatial relationships and room connections
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    console.log(`🏠 E3: Whole Property Analysis for listing ${listingId}`);

    // Fetch E2 unified layout (required input)
    const { data: roomAnalyses, error: layoutError } = await supabase
      .from('room_analyses')
      .select('unified_home_layout_json')
      .eq('listing_id', listingId)
      .single();

    if (layoutError || !roomAnalyses?.unified_home_layout_json) {
      return NextResponse.json(
        {
          success: false,
          error: 'e2_layout_required',
          details: 'E2 unified layout not found. Run E2 (unified home layout fusion) first.'
        },
        { status: 404 }
      );
    }

    const unifiedLayout = roomAnalyses.unified_home_layout_json;
    console.log(`✅ Found E2 unified layout: ${unifiedLayout.rooms?.length || 0} rooms, ${unifiedLayout.connections?.length || 0} connections`);

    // Get listing data
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      throw new Error('No listing data found.');
    }

    // Get all valid photos (excluding Excluded and Floorplans clusters)
    const { fetchValidListingPhotos } = await import('@/lib/photo-storage');
    const filteredPhotos = await fetchValidListingPhotos(listingId);

    if (!filteredPhotos || filteredPhotos.length === 0) {
      throw new Error('No valid photos found for analysis.');
    }

    console.log(`📸 Found ${filteredPhotos.length} valid photos for whole-property analysis (excluding Excluded/Floorplans)`);

    // Build context for prompt (includes E2 unified layout)
    const context = {
      listing_id: listingId,
      property_title: listing.title || listing.scraped_data?.title || 'Property',
      price: listing.price_eur || listing.price || listing.scraped_data?.price || 0,
      size: listing.sqm || listing.scraped_data?.areas?.constructed || listing.scraped_data?.areas?.useful || 0,
      bedrooms: listing.bedrooms || listing.scraped_data?.bedrooms || 0,
      bathrooms: listing.bathrooms ? parseInt(listing.bathrooms) : listing.scraped_data?.bathrooms || 0,
      floor: listing.floor_number?.toString() || listing.floor || listing.scraped_data?.floor || undefined,
      year_built: listing.year_built || listing.scraped_data?.year || undefined,
      photo_urls: filteredPhotos.map(p => p.url),
      unified_layout: unifiedLayout // E2 unified layout
    };

    // Generate prompt (now includes E2 layout) - combine system and user parts like E1
    const promptText = WHOLE_PROPERTY_ANALYSIS_PROMPT(context);

    // Fetch and encode photos as base64 (same pattern as E1)
    console.log('📸 Fetching images and converting to base64...');
    const images: GeminiImageInput[] = [];
    
    for (const photo of filteredPhotos) { // All valid photos, no limit
      try {
        const response = await fetch(photo.url, {
          redirect: 'follow',
          headers: { 'User-Agent': 'PuedoCasa-E3/1.0' }
        });
        
        if (!response.ok) {
          console.warn(`⚠️ Failed to fetch photo ${photo.url}: HTTP ${response.status}`);
          continue;
        }

        const contentType = response.headers.get('content-type') || '';
        let mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg';
        
        if (contentType.includes('image/webp')) mimeType = 'image/webp';
        else if (contentType.includes('image/png')) mimeType = 'image/png';
        else if (contentType.includes('image/gif')) mimeType = 'image/gif';

        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        
        if (base64 && base64.length > 64) {
          images.push({ mimeType, data: base64 });
        }
      } catch (err) {
        console.warn(`⚠️ Error fetching photo ${photo.url}:`, err);
      }
    }

    if (images.length === 0) {
      return NextResponse.json(
        { success: false, error: 'no_valid_photos', details: 'Could not fetch any valid photos' },
        { status: 400 }
      );
    }

    console.log(`✅ Successfully encoded ${images.length} images`);
    console.log('🤖 Calling Gemini REST API for whole-property analysis...');

    // Define response schema for structured output (matching WholePropertyAnalysis interface)
    const responseSchema = {
      type: 'object',
      properties: {
        listing_id: { type: 'string' },
        lenses: {
          type: 'object',
          properties: {
            structural_envelope: { type: 'string' },
            finishes_surfaces: { type: 'string' },
            lighting_ventilation: { type: 'string' },
            fittings_fixtures: { type: 'string' },
            energy_insulation: { type: 'string' },
            accessibility_safety: { type: 'string' },
            spatial_coherence_flow: { type: 'string' },
            potential_limitations: { type: 'string' }
          },
          required: ['structural_envelope', 'finishes_surfaces', 'lighting_ventilation', 'fittings_fixtures', 'energy_insulation', 'accessibility_safety', 'spatial_coherence_flow', 'potential_limitations']
        },
        overall_condition_summary: { type: 'string' },
        confidence_notes: { type: 'string' },
        photo_coverage_summary: { type: 'string' }
      },
      required: ['listing_id', 'lenses', 'overall_condition_summary', 'confidence_notes', 'photo_coverage_summary']
    };

    // Call Gemini with structured output (same pattern as E1)
    const geminiResponse = await callGeminiRest(promptText, {
      model: 'gemini-2.5-flash',
      temperature: 0.1,
      topP: 0.6,
      topK: 20,
      maxOutputTokens: 15000,
      responseMimeType: 'application/json',
      responseSchema,
      images
    });

    if (!geminiResponse.success || !geminiResponse.text) {
      console.error('❌ Gemini API error:', geminiResponse.error);
      return NextResponse.json(
        {
          success: false,
          error: 'gemini_api_failed',
          details: geminiResponse.error || 'No response text'
        },
        { status: 500 }
      );
    }

    // Parse response (same robust pattern as E1)
    let analysisData: WholePropertyAnalysis;
    try {
      let cleaned = geminiResponse.text.trim();
      // Remove markdown code blocks if present
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      
      // Try to fix common JSON issues
      // Remove any trailing commas before closing braces/brackets
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
      
      analysisData = JSON.parse(cleaned);
      console.log('✅ Successfully parsed whole property analysis');
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      console.error('Raw response length:', geminiResponse.text?.length);
      console.error('Raw response preview:', geminiResponse.text?.substring(0, 1000));
      
      // Try to extract JSON from the response if it's embedded in text (same recovery as E1)
      const jsonMatch = geminiResponse.text?.match(/\{[\s\S]*/);
      if (jsonMatch) {
        try {
          let fixed = jsonMatch[0];
          
          // Handle incomplete strings - find the last unclosed string and close it
          let inString = false;
          let escapeNext = false;
          let lastQuotePos = -1;
          for (let i = 0; i < fixed.length; i++) {
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            if (fixed[i] === '\\') {
              escapeNext = true;
              continue;
            }
            if (fixed[i] === '"') {
              inString = !inString;
              if (inString) lastQuotePos = i;
            }
          }
          
          // If we're still in a string, close it
          if (inString && lastQuotePos >= 0) {
            const afterQuote = fixed.substring(lastQuotePos + 1);
            const nextColon = afterQuote.indexOf(':');
            const nextComma = afterQuote.indexOf(',');
            const nextBrace = afterQuote.indexOf('}');
            
            if (nextColon > 0 && (nextComma < 0 || nextColon < nextComma) && (nextBrace < 0 || nextColon < nextBrace)) {
              const beforeValue = fixed.substring(0, lastQuotePos + 1);
              const valuePart = afterQuote.substring(0, Math.min(nextColon, afterQuote.length));
              fixed = beforeValue + valuePart + '"' + fixed.substring(lastQuotePos + 1 + valuePart.length);
            } else {
              fixed = fixed.substring(0, lastQuotePos + 1) + '"' + fixed.substring(lastQuotePos + 1);
            }
          }
          
          // Remove trailing commas
          fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
          
          // Balance braces/brackets
          const openBraces = (fixed.match(/\{/g) || []).length;
          const closeBraces = (fixed.match(/\}/g) || []).length;
          const openBrackets = (fixed.match(/\[/g) || []).length;
          const closeBrackets = (fixed.match(/\]/g) || []).length;
          
          fixed += '}'.repeat(Math.max(0, openBraces - closeBraces));
          fixed += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
          
          analysisData = JSON.parse(fixed);
          console.log('✅ Recovered JSON after parsing error');
        } catch (recoveryError) {
          console.error('❌ JSON recovery failed:', recoveryError);
          return NextResponse.json(
            {
              success: false,
              error: 'json_parse_failed',
              details: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
              raw_response_preview: geminiResponse.text?.substring(0, 500) + '...'
            },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'json_parse_failed',
            details: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
            raw_response_preview: geminiResponse.text?.substring(0, 500) + '...'
          },
          { status: 500 }
        );
      }
    }

    // Validate required fields
    if (!analysisData.listing_id || !analysisData.lenses || !analysisData.overall_condition_summary) {
      throw new Error('Response does not match WholePropertyAnalysis structure');
    }

    // Save to whole_property_analysis table (listing_id is BIGINT, same as E1/E2)
    const { error: saveError } = await supabase
      .from('whole_property_analysis')
      .upsert({
        listing_id: Number(listingId), // Convert to number like E1/E2
        analysis_data: analysisData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'listing_id'
      });

    if (saveError) {
      throw new Error(`Failed to save analysis: ${saveError.message}`);
    }

    console.log(`✅ Whole Property Analysis completed and saved`);

    return NextResponse.json({
      success: true,
      message: 'Whole property analysis completed',
      data: analysisData
    });

  } catch (error) {
    console.error('❌ Whole property analysis error:', error);
    
    return NextResponse.json({
      success: false, 
      error: (error as any)?.message || 'Whole property analysis failed' 
    }, { status: 500 });
  }
}

/**
 * GET /api/listings/[id]/photo-analysis/whole-property
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    const { data: analysis, error } = await supabase
      .from('whole_property_analysis')
      .select('analysis_data, created_at, updated_at')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !analysis) {
      return NextResponse.json({
        success: false,
        error: 'No whole property analysis found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: analysis.analysis_data
    });

  } catch (error) {
    console.error('Get whole property analysis error:', error);
    return NextResponse.json({
      success: false,
      error: (error as any)?.message || 'Failed to fetch analysis'
    }, { status: 500 });
  }
}


