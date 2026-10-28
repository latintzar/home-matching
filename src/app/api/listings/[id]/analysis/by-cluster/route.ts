import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { VertexAI } from '@google-cloud/vertexai';
import { ROOM_ANALYSIS_PROMPT } from '@/lib/prompts/photo-analysis';
import { RoomByRoomAnalysis, isRoomByRoomAnalysis } from '@/types/integrated-analysis';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || '';
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    console.log(`🛏️ Starting Stage 2: Room-by-Room Analysis for listing ${listingId}`);
    
    // Get manual photo clusters
    const { data: clusters, error: clustersError } = await supabase
      .from('clusters')
      .select('*')
      .eq('listing_id', listingId)
      .order('display_order');

    if (clustersError || !clusters || clusters.length === 0) {
      throw new Error('No manual photo clusters found. Run clustering step first.');
    }

    console.log(`📸 Found ${clusters.length} clusters for room-by-room analysis`);

    // Initialize Vertex AI
    const vertexAI = new VertexAI({
      project: GOOGLE_CLOUD_PROJECT_ID,
      location: GOOGLE_CLOUD_LOCATION,
    });

    const model = vertexAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2,
        topP: 0.7,
        topK: 40,
        maxOutputTokens: 2000,
      }
    });

    const roomAnalyses: any[] = [];
    const systemsFound: any[] = [];
    let totalPhotosAnalyzed = 0;
    let totalResponseTime = 0;

    // Analyze each cluster
    for (const cluster of clusters) {
      console.log(`🔍 Analyzing cluster: ${cluster.cluster_name} (${cluster.photo_urls.length} photos)`);
      
      // Skip excluded clusters using helper function
      const { isClusterExcluded } = await import('@/lib/photo-storage');
      const isExcluded = await isClusterExcluded(cluster.cluster_name, listingId);
      if (isExcluded) {
        console.log(`⏭️ Skipping excluded cluster: ${cluster.cluster_name}`);
        continue;
      }

      try {
        // Generate prompt for this room
        const prompt = ROOM_ANALYSIS_PROMPT({
          room_name: cluster.cluster_name,
          photo_urls: cluster.photo_urls
        });

        // Prepare multimodal content
        const contentParts: any[] = [{ text: prompt }];
        
        // Add images as base64
        for (const photoUrl of cluster.photo_urls.slice(0, 5)) { // Limit to 5 photos per room
          try {
            const imageResponse = await fetch(photoUrl);
            if (imageResponse.ok) {
              const imageBuffer = await imageResponse.arrayBuffer();
              const base64Image = Buffer.from(imageBuffer).toString('base64');
              
              contentParts.push({
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Image
                }
              });
            }
          } catch (error) {
            console.warn(`Failed to fetch image ${photoUrl}:`, error);
          }
        }

        // Format for Vertex AI API (requires contents array with parts)
        const vertexContent = {
          contents: [{
            role: 'user',
            parts: contentParts
          }]
        };

        const startTime = Date.now();
        const result = await model.generateContent(vertexContent);
        const duration = Date.now() - startTime;
        totalResponseTime += duration;
        
        console.log(`✅ ${cluster.cluster_name} analyzed in ${duration}ms`);

        const responseText = (result.response as any)?.text || 
                             result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) {
          console.error('No response from Gemini');
          console.error('Result:', JSON.stringify(result, null, 2));
          throw new Error(`No response from Gemini for ${cluster.cluster_name}`);
        }

        // Parse JSON response
        let roomAnalysis: any;
        try {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('No JSON found in response');
          }
          
          roomAnalysis = JSON.parse(jsonMatch[0]);
          
          // Validate required fields
          if (!roomAnalysis.name || !roomAnalysis.condition || !Array.isArray(roomAnalysis.observations)) {
            throw new Error('Invalid room analysis structure');
          }
          
        } catch (parseError) {
          console.error(`JSON parsing error for ${cluster.cluster_name}:`, parseError);
          console.error('Raw response:', responseText);
          throw new Error(`Failed to parse Gemini response for ${cluster.cluster_name}: ${parseError}`);
        }

        roomAnalyses.push(roomAnalysis);
        totalPhotosAnalyzed += cluster.photo_urls.length;

        // Extract systems from room analysis if any
        if (roomAnalysis.systems && Array.isArray(roomAnalysis.systems)) {
          systemsFound.push(...roomAnalysis.systems);
        }

        } catch (error) {
        console.error(`❌ Error analyzing cluster ${cluster.cluster_name}:`, error);
        // Continue with other clusters instead of failing completely
        continue;
      }
    }

    if (roomAnalyses.length === 0) {
      throw new Error('No room analyses generated');
    }

    // Create final RoomByRoomAnalysis structure
    const analysisData: RoomByRoomAnalysis = {
      rooms: roomAnalyses,
      systems: systemsFound
    };

    // Validate structure
    if (!isRoomByRoomAnalysis(analysisData)) {
      throw new Error('Generated analysis does not match RoomByRoomAnalysis structure');
    }

    // Save to photo_analysis_results table
    const { error: saveError } = await supabase
      .from('photo_analysis_results')
      .insert({
        listing_id: parseInt(listingId),
        analysis_type: 'by_cluster',
        analysis_data: analysisData
      });

    if (saveError) {
      throw new Error(`Failed to save analysis: ${saveError.message}`);
    }

    console.log(`✅ Stage 2 completed: Room-by-Room Analysis saved`);

    return NextResponse.json({
      success: true,
      message: 'Room-by-room analysis completed',
      data: {
        clusters_analyzed: roomAnalyses.length,
        total_clusters: clusters.length,
        photos_analyzed: totalPhotosAnalyzed,
        total_response_time_ms: totalResponseTime,
        avg_response_time_ms: Math.round(totalResponseTime / roomAnalyses.length),
        systems_found: systemsFound.length,
        rooms: roomAnalyses.map(r => ({
          name: r.name,
          condition: r.condition,
          observations_count: r.observations.length,
          risks_count: r.risks.length,
          verify_count: r.verify.length,
          likely_work: r.likely_work
        }))
      }
    });

  } catch (error) {
    console.error('❌ Room-by-room analysis error:', error);
    
    return NextResponse.json({
      success: false, 
      error: (error as any)?.message || 'Room-by-room analysis failed'
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
      .from('photo_analysis_results')
      .select('*')
      .eq('listing_id', listingId)
      .eq('analysis_type', 'by_cluster')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !analysis) {
      return NextResponse.json({
        success: false,
        error: 'No room-by-room analysis found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: analysis.analysis_data
    });

  } catch (error) {
    console.error('Get room-by-room analysis error:', error);
    return NextResponse.json({
      success: false,
      error: (error as any)?.message || 'Failed to fetch analysis'
    }, { status: 500 });
  }
}