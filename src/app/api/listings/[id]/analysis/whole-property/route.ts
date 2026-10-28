import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WHOLE_PROPERTY_PROMPT } from '@/lib/prompts/photo-analysis';
import { WholePropertyAnalysis, isWholePropertyAnalysis } from '@/types/integrated-analysis';
import { createStepLogger } from '@/lib/orchestrator-progress';
import { PIPELINE_VERSIONS, isCacheValid } from '@/lib/pipeline-versions';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Gemini API Configuration (Publisher Endpoint - same pattern as zeroShotGemini3.ts)
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
const API_ENDPOINT = 'aiplatform.googleapis.com';
const MODEL_ID = 'gemini-2.5-flash'; // Use Flash for F3 (good balance of speed/quality)
const GENERATE_CONTENT_API = 'streamGenerateContent';

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
  const stepName = request.headers.get('X-Step-Name') || 'F3';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  const { id: listingId } = await params; // Await params as per Next.js 15+ warning

  // Check for force_refresh parameter
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('force_refresh') === 'true';

  try {
    logger.log(`🏠 F3: Starting Whole Property Analysis for listing ${listingId}`);
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      // 1. Get current listing's URL
      const { data: currentListing, error: urlError } = await supabase
        .from('listings')
        .select('source_url')
        .eq('id', listingId)
        .single();

      if (!urlError && currentListing?.source_url) {
        // 2. Find ALL listings with this URL (handle duplicates)
        const { data: duplicateListings } = await supabase
          .from('listings')
          .select('id')
          .eq('source_url', currentListing.source_url);

        const allListingIds = duplicateListings?.map(l => l.id) || [listingId];
        
        // 3. Check if ANY of these listings have analysis
        const { data: cachedAnalysis, error: cacheError } = await supabase
          .from('whole_property_analysis')
          .select('analysis_data, created_at, listing_id')
          .in('listing_id', allListingIds)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!cacheError && cachedAnalysis && isCacheValid(cachedAnalysis.analysis_data?._version, PIPELINE_VERSIONS.F3_WHOLE_PROPERTY)) {
          logger.log(`✅ Found cached analysis v${cachedAnalysis.analysis_data?._version} from listing ${cachedAnalysis.listing_id} (created: ${cachedAnalysis.created_at})`);
          
          // If the cached analysis is from a different listing ID (duplicate),
          // we should probably save it for the current ID too so future lookups are faster
          if (String(cachedAnalysis.listing_id) !== String(listingId)) {
            logger.log(`🔄 Linking existing analysis to current listing ${listingId}...`);
            await supabase
              .from('whole_property_analysis')
              .upsert({
                listing_id: parseInt(listingId),
                analysis_data: cachedAnalysis.analysis_data,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'listing_id'
              });
          }

          return NextResponse.json({
            success: true,
            message: 'Whole property analysis (cached from URL match)',
            cached: true,
            source_listing_id: cachedAnalysis.listing_id,
            data: {
              general_impression: cachedAnalysis.analysis_data.general_impression,
              summary_ratings: cachedAnalysis.analysis_data.summary_ratings,
              top_checks_count: cachedAnalysis.analysis_data.top_checks?.length || 0,
              notes_count: cachedAnalysis.analysis_data.notes?.length || 0
            },
            created_at: cachedAnalysis.created_at
          });
        }
        
        if (!cacheError && cachedAnalysis && !isCacheValid(cachedAnalysis.analysis_data?._version, PIPELINE_VERSIONS.F3_WHOLE_PROPERTY)) {
          logger.log(`🔄 F3: Cache stale (v${cachedAnalysis.analysis_data?._version} → v${PIPELINE_VERSIONS.F3_WHOLE_PROPERTY}), regenerating...`);
        }
      }
    }

    logger.log(`🔄 ${forceRefresh ? 'Force refresh' : 'No cache found'}, generating new analysis...`);
    
    // Get text analysis data (A-facts has the claims we need)
    const { data: aFactsResult, error: aFactsError } = await supabase
      .from('text_analysis_results')
      .select('results')
      .eq('listing_id', listingId)
      .eq('phase', 'a_facts')
      .single();

    if (aFactsError || !aFactsResult) {
      throw new Error('No text analysis data found. Run Text Analysis pipeline first.');
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

    // Get all valid photos (excluding Excluded and Floorplans clusters)
    const { fetchValidListingPhotos } = await import('@/lib/photo-storage');
    const photos = await fetchValidListingPhotos(listingId);

    if (!photos || photos.length === 0) {
      throw new Error('No valid photos found for analysis.');
    }

    logger.log(`📸 Found ${photos.length} valid photos for whole-property analysis (excluding Excluded/Floorplans)`);

    // Build context for prompt using listing data
    const context = {
      property_title: listing.title || 'Property',
      price: listing.price_eur || listing.price || 0,
      size: listing.sqm || 0,
      bedrooms: listing.bedrooms || 0,
      bathrooms: listing.bathrooms ? parseInt(listing.bathrooms) : 0,
      floor_info: listing.floor_number?.toString() || listing.floor || undefined,
      year_built: listing.year_built || undefined,
      community_fee: undefined, // Not typically available
      agent_notes: listing.agent_notes || undefined,
      photo_urls: photos.map(p => p.url)
    };

    // Generate prompt
    const prompt = WHOLE_PROPERTY_PROMPT(context);

    if (!API_KEY) {
      throw new Error('Missing GEMINI_API_KEY or GOOGLE_CLOUD_API_KEY environment variable');
    }

    logger.log('🤖 Calling Gemini for whole-property analysis...');

    // Prepare multimodal content parts (text + images)
    const contentParts: any[] = [{ text: prompt }];
    let imagesAdded = 0;
    
    // Add images as base64 (all valid photos, no limit)
    for (const photo of photos) {
      try {
        const imageResponse = await fetch(photo.url);
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          const base64Image = Buffer.from(imageBuffer).toString('base64');
          
          contentParts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image
            }
          });
          imagesAdded++;
        } else {
          logger.warn(`Failed to fetch image ${photo.url}: HTTP ${imageResponse.status}`);
        }
      } catch (error) {
        logger.warn(`Failed to fetch image ${photo.url}:`, error);
      }
    }

    logger.log(`📸 Added ${imagesAdded} images to analysis`);

    if (imagesAdded === 0) {
      throw new Error('No images could be loaded for analysis');
    }

    // Build request body for Publisher API
    const requestBody = {
      contents: [{
        role: 'user',
        parts: contentParts
      }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.7,
        topK: 40,
        maxOutputTokens: 8000,
        responseMimeType: 'application/json',
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
      ],
    };

    // Call Gemini via Publisher Endpoint (same pattern as zeroShotGemini3.ts)
    const url = `https://${API_ENDPOINT}/v1/publishers/google/models/${MODEL_ID}:${GENERATE_CONTENT_API}?key=${encodeURIComponent(API_KEY)}`;

    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const rawResponse = await response.text();
    const duration = Date.now() - startTime;

    if (!response.ok) {
      logger.error(`❌ Gemini API error: ${response.status} ${response.statusText}`);
      logger.error(`Response: ${rawResponse.substring(0, 500)}`);
      throw new Error(`Gemini API error: ${response.status} - ${rawResponse.substring(0, 200)}`);
    }
    
    logger.log(`✅ Gemini response received in ${duration}ms`);
    logger.log(`📝 Raw response length: ${rawResponse.length}`);

    // Parse streaming response (JSON array format)
    let responseText = '';
    try {
      // Streaming endpoint returns a JSON array
      let responseArray: any[];
      try {
        responseArray = JSON.parse(rawResponse);
        if (!Array.isArray(responseArray)) {
          responseArray = [responseArray];
        }
      } catch (parseError) {
        logger.error(`Failed to parse response as JSON: ${parseError}`);
        logger.error(`Raw response preview: ${rawResponse.substring(0, 500)}`);
        throw new Error(`Failed to parse Gemini response: ${parseError}`);
      }

      // Concatenate all text parts from all chunks
      for (const chunk of responseArray) {
        const candidates = chunk?.candidates || [];
        for (const candidate of candidates) {
          const parts = candidate?.content?.parts || [];
          for (const part of parts) {
            if (part?.text) {
              responseText += part.text;
            }
          }
        }
      }
    } catch (parseErr) {
      logger.error('Failed to parse streaming response:', parseErr);
      throw new Error('Failed to parse Gemini streaming response');
    }

    if (!responseText) {
      logger.error('No response text from Gemini');
      logger.error(`Raw response preview: ${rawResponse.substring(0, 1000)}`);
      throw new Error('No response from Gemini');
    }

    logger.log(`📝 Response text length: ${responseText.length}`);

    // Parse JSON response
    let analysisData: WholePropertyAnalysis;
    try {
      // Clean the response (remove markdown formatting if present)
      const clean = responseText.trim().replace(/^```json\s*/,'').replace(/\s*```$/,'');
      
      // Extract JSON from response
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error('No JSON found in response');
        logger.error('Full response:', responseText);
        throw new Error('No JSON found in response');
      }
      
      analysisData = JSON.parse(jsonMatch[0]);
      
      // Validate structure
      if (!isWholePropertyAnalysis(analysisData)) {
        throw new Error('Response does not match WholePropertyAnalysis structure');
      }
      
    } catch (parseError) {
      logger.error('JSON parsing error:', parseError);
      logger.error('Raw response:', responseText);
      throw new Error(`Failed to parse Gemini response: ${parseError}`);
    }

    // Add version to analysis data
    const versionedAnalysisData = {
      ...analysisData,
      _version: PIPELINE_VERSIONS.F3_WHOLE_PROPERTY
    };

    // Save to whole_property_analysis table (Architecture Improvement)
    const { error: saveError } = await supabase
      .from('whole_property_analysis')
      .upsert({
        listing_id: parseInt(listingId),
        analysis_data: versionedAnalysisData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'listing_id'
      });

    if (saveError) {
      throw new Error(`Failed to save analysis: ${saveError.message}`);
    }

    logger.log(`✅ F3: Whole Property Analysis completed and saved`);

    return NextResponse.json({
      success: true,
      message: 'Whole property analysis completed',
      data: {
        photos_analyzed: photos.length,
        response_time_ms: duration,
        general_impression: analysisData.general_impression,
        summary_ratings: analysisData.summary_ratings,
        top_checks_count: analysisData.top_checks.length,
        notes_count: analysisData.notes.length
      },
      model: MODEL_ID
    });

  } catch (error) {
    logger.error('❌ Whole property analysis error:', error);
    
    return NextResponse.json({
        success: false, 
        error: (error as any)?.message || 'Whole property analysis failed' 
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    // 1. Try direct lookup first
    let { data: analysis, error } = await supabase
      .from('whole_property_analysis')
      .select('analysis_data, created_at, updated_at')
      .eq('listing_id', listingId)
      .single();

    // 2. If not found, try lookup by URL (handle duplicates)
    if (!analysis) {
      const { data: currentListing } = await supabase
        .from('listings')
        .select('source_url')
        .eq('id', listingId)
        .single();

      if (currentListing?.source_url) {
        const { data: duplicateListings } = await supabase
          .from('listings')
          .select('id')
          .eq('source_url', currentListing.source_url);

        const allIds = duplicateListings?.map(l => l.id) || [];
        
        if (allIds.length > 0) {
          const { data: foundAnalysis } = await supabase
            .from('whole_property_analysis')
            .select('analysis_data, created_at, updated_at')
            .in('listing_id', allIds)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
            
          if (foundAnalysis) {
            analysis = foundAnalysis;
            error = null;
          }
        }
      }
    }

    if (error || !analysis) {
      return NextResponse.json({
        success: false,
        error: 'No whole property analysis found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: analysis.analysis_data,
      created_at: analysis.created_at,
      updated_at: analysis.updated_at
    });

  } catch (error) {
    console.error('Get whole property analysis error:', error);
    return NextResponse.json({
      success: false,
      error: (error as any)?.message || 'Failed to fetch analysis'
    }, { status: 500 });
  }
}