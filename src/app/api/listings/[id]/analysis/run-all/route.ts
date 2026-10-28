import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { VertexAI } from '@google-cloud/vertexai';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Supabase URL and Service Key must be provided!');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Initialize Vertex AI
const GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || '';
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

const vertexAI = new VertexAI({
  project: GOOGLE_CLOUD_PROJECT_ID,
  location: GOOGLE_CLOUD_LOCATION,
});

// Helper function to assign photos to room clusters
async function assignPhotosToClusters(listingId: string) {
  console.log('📸 Assigning photos to room clusters...');
  
  // Get A1 context results
  const { data: a1Results, error: a1Error } = await supabase
    .from('text_analysis_results')
    .select('results')
    .eq('listing_id', listingId)
    .eq('phase', 'a_facts')
    .single();

  if (a1Error || !a1Results) {
    throw new Error('Failed to fetch A1 context results');
  }

  // Get valid photos (excluding Excluded and Floorplans clusters)
  const { fetchValidListingPhotos } = await import('@/lib/photo-storage');
  const validPhotos = await fetchValidListingPhotos(listingId);
  const allPhotos = validPhotos.map(photo => photo.url);
  console.log(`📸 Found ${allPhotos.length} valid photos (excluding Excluded/Floorplans)`);

  if (allPhotos.length === 0) {
    throw new Error('No valid photos found');
  }

  // Get room clusters
  const { data: roomClusters, error: clustersError } = await supabase
    .from('clusters')
    .select('*')
    .eq('listing_id', listingId);

  if (clustersError || !roomClusters) {
    throw new Error('Failed to fetch room clusters');
  }

  // Assign photos to clusters based on filename patterns
  const photoAssignments = allPhotos.map((photoUrl, index) => {
    const filename = photoUrl.split('/').pop()?.toLowerCase() || '';
    let assignedCluster = 'living_room'; // default
    
    // Enhanced filename-based assignment
    if (filename.includes('cocina') || filename.includes('kitchen')) assignedCluster = 'kitchen';
    else if (filename.includes('dormitorio') || filename.includes('bedroom')) assignedCluster = 'bedroom_1';
    else if (filename.includes('baño') || filename.includes('bathroom')) assignedCluster = 'bathroom';
    else if (filename.includes('terraza') || filename.includes('balcony')) assignedCluster = 'balcony';
    else if (filename.includes('exterior') || filename.includes('outside')) assignedCluster = 'living_room';
    else if (filename.includes('salon') || filename.includes('living')) assignedCluster = 'living_room';
    else if (filename.includes('garaje') || filename.includes('parking')) assignedCluster = 'garage';
    
    return { photoUrl, assignedCluster, index };
  });

  // Note: clusters schema doesn't include collage_url
  // Photo assignments are stored in photo_urls array instead
  let totalAssigned = 0;
  for (const cluster of roomClusters) {
    const clusterPhotos = photoAssignments
      .filter(p => p.assignedCluster === cluster.cluster_name)
      .map(p => p.photoUrl);
    
    if (clusterPhotos.length > 0) {
      // Update cluster with photo URLs (clusters uses photo_urls array)
      await supabase
        .from('clusters')
        .update({ photo_urls: clusterPhotos })
        .eq('id', cluster.id);
      
      totalAssigned += clusterPhotos.length;
      console.log(`📸 Updated ${cluster.cluster_name} with ${clusterPhotos.length} photos`);
    }
  }

  console.log(`✅ Assigned ${totalAssigned} photos to ${roomClusters.length} clusters`);
  return { totalPhotos: allPhotos.length, assignedPhotos: totalAssigned, clusters: roomClusters.length };
}

// Helper function to generate Stage 1: Whole Property Analysis (1 Gemini call)
// Analyzes ALL photos + property data at once using Gemini multimodal
// OUTPUT: Private database record (not shown to users)
// STYLE: Can be robust, detailed, and wordy - optimized for Gemini consumption as context
async function generateWholePropertyAnalysis(listingId: string) {
  console.log('🏠 Generating whole property Photo Analysis Pipeline...');
  
  // Get listing data
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single();

  if (listingError || !listing) {
    throw new Error('Failed to fetch listing data');
  }

    // Get text analysis results
    const { data: textResults, error: textError } = await supabase
      .from('text_analysis_results')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: true });

  if (textError) {
    throw new Error('Failed to fetch text analysis results');
  }

  // Get valid photos (excluding Excluded and Floorplans clusters)
  const { fetchValidListingPhotos } = await import('@/lib/photo-storage');
  const validPhotos = await fetchValidListingPhotos(listingId);
  const allPhotos = validPhotos.map(photo => photo.url);

  if (allPhotos.length === 0) {
    throw new Error('No valid photos available for analysis');
  }

  const model = vertexAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      maxOutputTokens: 4000,
      temperature: 0.3,
    },
  });

  const prompt = `
  Analyze this property comprehensively using all photos and data:
  - Property: ${listing.bedrooms} bed, ${listing.sqm}m², €${listing.price_eur}
  - Location: ${listing.city}, ${listing.region}
  - Context: ${JSON.stringify(textResults.slice(0, 3))} // First 3 Text Analysis results for context
  
  Provide a structured analysis covering:
  1. Structural assessment and overall condition
  2. Systems overview (electrical, plumbing, finishes)
  3. Key risks and value drivers
  4. Areas requiring verification
  
  Focus on what you can actually observe from the photos. Be specific about visual cues.
  Rate these 10 systems based on what you can see: Good/Fair/Poor/Unknown
  - Envelope (building exterior, walls, roof)
  - Moisture (damp, staining, ventilation)
  - Windows/Doors (frames, glazing, seals)
  - Kitchen/Baths (fixtures, surfaces, appliances)
  - Electrical (outlets, switches, visible wiring)
  - Plumbing (pipes, fixtures, water pressure)
  - Heating/Cooling (units, radiators, vents)
  - Finishes (floors, walls, paint condition)
  - Accessibility/Safety (ramps, handrails, exits)
  - Energy/Comfort (insulation, ventilation, efficiency)
  
  Return JSON format with system_ratings and detailed observations.
  `;

  const content = [
    prompt,
    ...allPhotos.slice(0, 10).map(photo => ({ 
      inlineData: { 
        data: photo, 
        mimeType: 'image/jpeg' 
      } 
    }))
  ];

  const result = await model.generateContent(content as any);
  const analysis = await (result.response as any)?.text();
  
  console.log('✅ Whole property Photo Analysis Pipeline complete');
  return analysis;
}

// Helper function to generate Stage 2: Room-by-Room Analysis (Multiple Gemini calls, 1 per room cluster)
// Analyzes each cluster's photos individually for detailed room assessment
// OUTPUT: Private database records (not shown to users)
// STYLE: Can be robust, detailed, and wordy - optimized for Gemini consumption as context
async function generateRoomAnalysis(listingId: string) {
  console.log('🛏️ Generating room-by-room Photo Analysis Pipeline...');
  
  // Get room clusters
  const { data: roomClusters, error: clustersError } = await supabase
    .from('clusters')
    .select('*')
    .eq('listing_id', listingId);

  if (clustersError || !roomClusters) {
    throw new Error('Failed to fetch room clusters');
  }

  const roomAnalyses = await Promise.all(
    roomClusters.map(async (cluster) => {
      const model = vertexAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.3,
        },
      });

      const prompt = `
      Analyze this ${cluster.cluster_name} room in detail:
      - Focus on: fixtures, surfaces, wear patterns, functionality
      - Identify: specific issues, maintenance needs, renovation priorities
      - Note: what's visible vs what needs verification
      - Be specific about visual cues and confidence levels
      
      Return JSON with:
      - key_issues: Array of specific observations from photos
      - verify_in_person: Array of things NOT visible that need checking
      - photo_observations: Array of {element, condition, location, confidence}
      - renovation_priority: high/medium/low based on visible issues
      - condition: overall room condition assessment
      `;

      const photos = cluster.photo_urls && cluster.photo_urls.length > 0 ? cluster.photo_urls.slice(0, 5) : [];
      const content = [
        prompt,
        ...photos.map((photo: string) => ({ 
          inlineData: { 
            data: photo, 
            mimeType: 'image/jpeg' 
          } 
        }))
      ];

      const result = await model.generateContent(content as any);
      return {
        roomName: cluster.cluster_name,
        analysis: await (result.response as any)?.text()
      };
    })
  );

  console.log(`✅ Room-by-room Photo Analysis Pipeline complete for ${roomAnalyses.length} rooms`);
  return roomAnalyses;
}

// Helper function to generate Stage 3: Integrated Analysis (1 Gemini call combining previous outputs)
// Combines Stage 1 and Stage 2 outputs into final integrated report
// OUTPUT: Public analysis displayed in AnalysisModal popup when clicking Analysis button
// STYLE: Must be human-readable, concise, and professional - optimized for end-user display
async function generateIntegratedReport(listingId: string, wholePropertyAnalysis: string, roomAnalyses: any[]) {
  console.log('📋 Generating integrated report...');
  
  // Get listing data
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single();

  if (listingError || !listing) {
    throw new Error('Failed to fetch listing data');
  }

  const model = vertexAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      maxOutputTokens: 8000,
      temperature: 0.3,
    },
  });

  const prompt = `
  Generate a professional property assessment report using:
  
  WHOLE PROPERTY ANALYSIS:
  ${wholePropertyAnalysis}
  
  ROOM-BY-ROOM ANALYSIS:
  ${roomAnalyses.map(r => `${r.roomName}: ${r.analysis}`).join('\n\n')}
  
  PROPERTY DATA:
  ${JSON.stringify({ listing })}
  
  Format as a structured JSON with these exact sections:
  {
    "executive_summary": "string",
    "property_profile": {
      "property_type": "string",
      "condition": "string", 
      "key_features": ["string"],
      "unique_selling_points": ["string"]
    },
    "system_ratings": {
      "envelope": "Good|Fair|Poor|Unknown",
      "moisture": "Good|Fair|Poor|Unknown",
      "windows_doors": "Good|Fair|Poor|Unknown",
      "kitchen_baths": "Good|Fair|Poor|Unknown",
      "electrical": "Good|Fair|Poor|Unknown",
      "plumbing": "Good|Fair|Poor|Unknown",
      "heating_cooling": "Good|Fair|Poor|Unknown",
      "finishes": "Good|Fair|Poor|Unknown",
      "accessibility_safety": "Good|Fair|Poor|Unknown",
      "energy_comfort": "Good|Fair|Poor|Unknown"
    },
    "must_verify": [
      {
        "room": "string",
        "element": "string", 
        "why": "string",
        "type": "viewing|paperwork|contractor"
      }
    ],
    "room_analysis": {
      "[room_name]": {
        "condition": "string",
        "key_issues": ["string"],
        "renovation_priority": "high|medium|low",
        "estimated_cost": "string",
        "recommendations": ["string"],
        "potential_value_add": "string",
        "verify_in_person": ["string"],
        "photo_observations": [
          {
            "element": "string",
            "condition": "string",
            "location": "string",
            "confidence": "high|medium|low"
          }
        ],
        "cluster_photos": ["string"]
      }
    },
    "strategic_recommendations": {
      "immediate_actions": ["string"],
      "medium_term_goals": ["string"],
      "long_term_vision": ["string"],
      "priority_level": "high|medium|low"
    },
    "risk_factors": {
      "high_risk": ["string"],
      "medium_risk": ["string"],
      "low_risk": ["string"],
      "mitigation_strategies": ["string"]
    }
  }
  
  Use professional, credible language. Focus on what photos actually show.
  Be specific about visual observations and confidence levels.
  Generate must-verify checklist based on what's NOT visible in photos.
  Include system ratings based on photo observations.
  `;

  const result = await model.generateContent(prompt);
  const integratedReport = await (result.response as any)?.text();
  
  console.log('✅ Integrated report generation complete');
  return integratedReport;
}

// Helper function to save analysis results
async function saveAnalysisResults(listingId: string, integratedReport: string) {
  console.log('💾 Saving Photo Analysis Pipeline results...');
  
  try {
    // Parse the JSON response
    const analysisData = JSON.parse(integratedReport);
    
    // Save to database
    const { error: insertError } = await supabase
      .from('photo_analysis_results')
      .insert({
        listing_id: listingId,
        analysis_type: 'integrated',
        analysis_data: analysisData,
      });

    if (insertError) {
      throw new Error(`Failed to save analysis results: ${insertError.message}`);
    }

    console.log('✅ Analysis results saved to database');
    return true;
  } catch (parseError) {
    console.error('Failed to parse integrated report JSON:', parseError);
    throw new Error('Failed to parse integrated report JSON');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    console.log(`🚀 Starting Photo Analysis Pipeline (3-stage process) for listing ${listingId}`);
    console.log('📋 Stage 1: Whole Property Analysis (1 Gemini call)');
    console.log('📋 Stage 2: Room-by-Room Analysis (Multiple Gemini calls, 1 per room cluster)');
    console.log('📋 Stage 3: Integrated Analysis (1 Gemini call combining previous outputs)');
    
    // Step 1: Assign photos to clusters
    console.log('📸 Step 1: Assigning photos to room clusters...');
    const photoAssignment = await assignPhotosToClusters(listingId);
    
    // Stage 1: Generate whole property analysis (1 Gemini call)
    console.log('🏠 Stage 1: Generating whole property analysis (1 Gemini call)...');
    const wholePropertyAnalysis = await generateWholePropertyAnalysis(listingId);
    
    // Stage 2: Generate room-by-room analysis (Multiple Gemini calls, 1 per room cluster)
    console.log('🛏️ Stage 2: Generating room-by-room analysis (Multiple Gemini calls, 1 per room cluster)...');
    const roomAnalyses = await generateRoomAnalysis(listingId);
    
    // Stage 3: Generate integrated report (1 Gemini call combining previous outputs)
    console.log('📋 Stage 3: Generating integrated report (1 Gemini call combining previous outputs)...');
    const integratedReport = await generateIntegratedReport(listingId, wholePropertyAnalysis, roomAnalyses);
    
    // Step 5: Save final analysis
    console.log('💾 Step 5: Saving Photo Analysis Pipeline results...');
    await saveAnalysisResults(listingId, integratedReport);
    
    console.log('🎉 Photo Analysis Pipeline (3-stage process) completed successfully!');
    
    return NextResponse.json({
      success: true,
      message: 'Full analysis pipeline completed successfully',
      results: {
        photosAssigned: photoAssignment,
        wholePropertyAnalysis: true,
        roomAnalyses: roomAnalyses.length,
        integratedReport: true,
        saved: true
      }
    });
    
  } catch (error) {
    console.error('Analysis pipeline failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: `Analysis pipeline failed: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
}
