import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { PIPELINE_VERSIONS, isCacheValid } from '@/lib/pipeline-versions';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

/**
 * Buyer Report Endpoint (Consolidated Phase 6)
 * 
 * Synthesizes ALL available data into a final "Buyer Intelligence Report".
 * Now consumes PRE-CALCULATED Cadastral Data from DB instead of running it here.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('force_refresh') === 'true';
    
    console.log(`📋 Starting consolidated buyer report generation for listing ${listingId}`);

    // ========================================================================
    // STEP 0: Check Cache (with Version)
    // ========================================================================
    if (!forceRefresh) {
      const { data: cached, error: cacheError } = await supabase
        .from('text_analysis_results')
        .select('results, created_at')
        .eq('listing_id', listingId)
        .eq('phase', 'buyer_report')
        .single();

      if (!cacheError && cached?.results && isCacheValid(cached.results._version, PIPELINE_VERSIONS.BUYER_REPORT)) {
        console.log(`✅ Final-Scope: Using cached buyer report v${cached.results._version}`);
        return NextResponse.json({
          success: true,
          cached: true,
          data: cached.results,
          created_at: cached.created_at
        });
      }
      
      if (!cacheError && cached?.results && !isCacheValid(cached.results._version, PIPELINE_VERSIONS.BUYER_REPORT)) {
        console.log(`🔄 Final-Scope: Cache stale (v${cached.results._version} → v${PIPELINE_VERSIONS.BUYER_REPORT}), regenerating...`);
      }
    }

    console.log(`🔄 Final-Scope: ${forceRefresh ? 'Force refresh' : 'No cache found'}, generating new report...`);

    // ========================================================================
    // STEP 1: Fetch All Raw Inputs (Consolidated) - PARALLELIZED
    // ========================================================================
    console.log(`📊 Fetching all raw inputs in parallel (Text, Photos, Layouts, Research)...`);

    const listingIdNum = parseInt(listingId, 10);

    // Run all independent database queries in parallel
    const [
      textResultsResponse,
      wholePropertyResponse,
      roomAnalysesResponse,
      curatedResearchResponse,
      listingNumericResponse,
      listingStringResponse,
      clustersResponse
    ] = await Promise.allSettled([
      // 1a. Text Analysis (B3 Snippets, C Unknowns, AND CADASTRAL DATA, AND SMART M2, AND BASELINE CHECK)
      supabase
        .from('text_analysis_results')
        .select('phase, results')
        .eq('listing_id', listingId)
        .in('phase', ['b3_snippets', 'c_unknowns', 'cadastral_data', 'smart_m2', 'baseline_check']),
      
      // 1b. Photo Analysis - Whole Property
      supabase
        .from('whole_property_analysis')
        .select('analysis_data')
        .eq('listing_id', listingId)
        .limit(1).single(),
      
      // 1b. Photo Analysis - Room Analyses
      supabase
        .from('room_analyses')
        .select('analysis_data, unified_home_layout_json, room_layout_json')
        .eq('listing_id', listingId)
        .limit(1).single(),
      
      // 1c. Curated Search Results
      supabase
        .from('analysis_curated_results')
        .select('*')
        .eq('listing_id', listingId),
      
      // 1d. Listing Metadata - Numeric ID
      !isNaN(listingIdNum) 
        ? supabase
            .from('listings')
            .select('title, address, city, region, country, price_eur, source_url, agent_notes')
            .eq('id', listingIdNum)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      
      // 1d. Listing Metadata - String ID (fallback)
      supabase
        .from('listings')
        .select('title, address, city, region, country, price_eur, source_url, agent_notes')
        .eq('id', listingId)
        .maybeSingle(),
      
      // 1e. Photo Clusters
      supabase
        .from('clusters')
        .select('id, cluster_name, photo_urls')
        .eq('listing_id', listingIdNum)
        .order('display_order', { ascending: true })
    ]);

    // Extract results (handle Promise.allSettled structure)
    const textResults = textResultsResponse.status === 'fulfilled' ? textResultsResponse.value.data : null;
    const wholePropertyData = wholePropertyResponse.status === 'fulfilled' ? wholePropertyResponse.value.data : null;
    const roomAnalysesData = roomAnalysesResponse.status === 'fulfilled' ? roomAnalysesResponse.value.data : null;
    const curatedResearch = curatedResearchResponse.status === 'fulfilled' ? curatedResearchResponse.value.data : null;
    const listingNumeric = listingNumericResponse.status === 'fulfilled' ? listingNumericResponse.value.data : null;
    const listingString = listingStringResponse.status === 'fulfilled' ? listingStringResponse.value.data : null;
    const clusters = clustersResponse.status === 'fulfilled' ? clustersResponse.value.data : null;

    // Process text results
    const b3Snippets = textResults?.find((r: any) => r.phase === 'b3_snippets')?.results || {};
    const cUnknowns = textResults?.find((r: any) => r.phase === 'c_unknowns')?.results || {};
    const cadastralData = textResults?.find((r: any) => r.phase === 'cadastral_data')?.results;
    const smartM2Data = textResults?.find((r: any) => r.phase === 'smart_m2')?.results;
    const baselineCheckData = textResults?.find((r: any) => r.phase === 'baseline_check')?.results;

    const cadastralReportSummary = cadastralData?.summary_text || "Cadastral Analysis not run or failed.";
    const cadastralRawReport = cadastralData?.report || null;

    // Process photo analysis
    const wholePropertyAnalysis = wholePropertyData?.analysis_data;
    let roomByRoomAnalysis = roomAnalysesData?.analysis_data;
    const unifiedHomeLayout = roomAnalysesData?.unified_home_layout_json;
    const roomLayoutsMap = roomAnalysesData?.room_layout_json;

    // Filter excluded rooms
    if (Array.isArray(roomByRoomAnalysis)) {
      const excludedKeywords = ["zonas comunes", "exterior", "fachada", "plano", "floor_plan", "comunidad"];
      roomByRoomAnalysis = roomByRoomAnalysis.filter((room: any) => {
        const name = (room.room_name || "").toLowerCase();
        return !excludedKeywords.some(kw => name.includes(kw));
      });
    }

    // Process curated research
    const researchContext: Record<string, any> = {};
    if (curatedResearch) {
      curatedResearch.forEach((item: any) => {
        researchContext[item.category] = item;
      });
    }

    // Process listing metadata (prefer numeric, fallback to string)
    const listingData = listingNumeric || listingString;
    if (!listingData) throw new Error(`Listing not found for ID: ${listingId}`);
    const listing = listingData;
    const agentNotes = listing.agent_notes;

    const roomIdToPhotoUrls = new Map<string, string[]>();
    if (clusters) {
      clusters.forEach((cluster: any) => {
        const clusterId = cluster.id.toString();
        const photoUrls = Array.isArray(cluster.photo_urls) ? cluster.photo_urls : [];
        roomIdToPhotoUrls.set(clusterId, photoUrls);
      });
    }

    // ========================================================================
    // STEP 2: Generate Unified Buyer Report with Gemini 3 Pro
    // ========================================================================
    console.log(`🤖 Generating unified buyer report with Gemini 3 Pro...`);

    const chapter1Categories = ['structural_pathology', 'environmental_hostility', 'social_security', 'urban_legality'];
    const chapter2Categories = ['renovation_reality', 'infrastructure'];
    const chapter3Categories = ['financial_opex', 'market_context'];

    const chapter1Research = Object.fromEntries(
      Object.entries(researchContext).filter(([key]) => chapter1Categories.includes(key))
    );
    const chapter2Research = Object.fromEntries(
      Object.entries(researchContext).filter(([key]) => chapter2Categories.includes(key))
    );
    const chapter3Research = Object.fromEntries(
      Object.entries(researchContext).filter(([key]) => chapter3Categories.includes(key))
    );

    // ========================================================================
    // STEP 1.5: Fetch General Research Results (J-General)
    // ========================================================================
    // Fetch general research for verification items (permits, laws, etc.)
    const { data: generalResearchData } = await supabase
      .from('general_research_results')
      .select('category, report_data')
      .eq('listing_id', listingIdNum)
      .in('category', [
        'general_permits',
        'laws_regulations',
        'norms_standards',
        'general_costs',
        'general_timings'
      ]);

    const generalResearch: Record<string, any> = {};
    if (generalResearchData) {
      generalResearchData.forEach((item: any) => {
        generalResearch[item.category] = item.report_data;
      });
    }

    const prompt = `You are an expert real estate analyst creating a "Buyer Intelligence Report" in Spanish for Personal Shoppers Inmobiliarios.
    
    TASK:
    Synthesize all available data (text, photos, layouts, research, AND OFFICIAL GOVERNMENT CADASTRE DATA) into a comprehensive buyer report structured into 3 strategic chapters AND a pragmatic "Qué Verificar" checklist.
    Your goal is to protect buyers from "Vicios Ocultos" (Hidden Vices) and manage "HGTV Expectations" (unrealistic renovation expectations).

    INPUTS:
    1. LISTING: ${listing.title}, ${listing.city} (€${listing.price_eur?.toLocaleString()})
    2. OFFICIAL CADASTRE DATA (THE TRUTH):
       ${cadastralReportSummary}
       (Use this to contradict listing claims about size, year, or usage. If discrepancies exist, highlight them aggressively in Chapter 1).
    3. KNOWN FACTS (B3): ${JSON.stringify(b3Snippets, null, 2)}
    4. UNKNOWNS (C): ${JSON.stringify(cUnknowns, null, 2)}
    5. WHOLE PROPERTY ANALYSIS: ${JSON.stringify(wholePropertyAnalysis, null, 2)}
    6. ROOM ANALYSIS: ${JSON.stringify(roomByRoomAnalysis, null, 2)}
    7. UNIFIED LAYOUT (E2): ${JSON.stringify(unifiedHomeLayout, null, 2)}
    8. SMART M2 (Dimensions): ${JSON.stringify(smartM2Data, null, 2)}
    9. BASELINE RENOVATION COST (Habitissimo RAG): ${JSON.stringify(baselineCheckData, null, 2)}
    10. RESEARCH CONTEXT (8 Mega-Categories):
       - Chapter 1 Research: ${JSON.stringify(chapter1Research, null, 2)}
       - Chapter 2 Research: ${JSON.stringify(chapter2Research, null, 2)}
       - Chapter 3 Research: ${JSON.stringify(chapter3Research, null, 2)}
    11. GENERAL RESEARCH (Permits/Laws/Norms): ${JSON.stringify(generalResearch, null, 2)}
    12. BUYER AGENT NOTES (Context): "${agentNotes || 'None'}"
    
    STRUCTURE REQUIREMENTS:
    Follow this structure:
    1. Property Info (Cover & Snapshot)
    2. House as a Whole (Narrative Synthesis only)
    3. 🛡️ CHAPTER 1: FORENSIC RISK AUDIT
       - Structural Pathology & Building Health (from structural_pathology research)
       - Environmental Hostility & Sensory Risk (from environmental_hostility research)
       - Social, Security & Neighborhood Context (from social_security research)
       - Urban Legality, Planning & "Ghosts" (from urban_legality research AND Cadastre Analysis)
       * NOTE: For Chapter 1 subsections, DO NOT output 'summary', 'key_findings', and 'red_flags'. Instead, output:
         - 'synthesis': A concise prose summary (max 2 sentences) of the risk status.
         - 'risk_level': One of 'High', 'Medium', 'Low', 'Critical'.
         - 'alerts': A list of 3-5 critical bullet points mixing key findings and red flags. Use bold for emphasis.
    4. 🛠️ CHAPTER 2: EXECUTION & REALITY CHECK
       - The "Charm Tax" & Renovation Reality (from renovation_reality research)
       - Infrastructure & Connectivity (from infrastructure research)
       - Room-by-Room Analysis (MUST include ALL rooms from the input 'ROOM ANALYSIS'. Deduplicate rooms if they appear with similar names like "Bedroom" and "Dormitorio 1". Merge their analysis into one robust entry. EXCLUDE 'Zonas Comunes' or exterior communal areas.)
    5. 💰 CHAPTER 3: FINANCIAL INTELLIGENCE
       - Financials, Hidden OpEx & Incentives (from financial_opex research)
       - Market Context & Comps (from market_context research)
    6. ✅ QUÉ VERIFICAR (Verification Checklist)
       - A prioritized checklist of exactly 5 items to verify during a visit.
       - Based on risks, uncertainties, and reality checks identified in Chapters 1-3.
       - TONE: Close, professional, pragmatic. Not alarmist. "Good, but worth checking."
    7. Citations & References
    
    CRITICAL INSTRUCTIONS:
    - **Use Cadastre Data**: If the "OFFICIAL CADASTRE DATA" shows a discrepancy (e.g., Listing says 90m2, Cadastre says 75m2), this MUST be the #1 Alert in "Urban Legality". If the year is different (e.g. Pre-1980), flag the infrastructure risk.
    - **Use Agent Notes**: If provided, the "BUYER AGENT NOTES" are extremely high-priority context. If the agent mentions a specific concern (e.g. "humidity in ceiling"), YOU MUST ADDRESS IT in the relevant chapter. If they mention a goal (e.g. "buy to rent"), frame the risks accordingly.
    - **Chapter 1 Focus (Forensic Risk)**: STRICTLY focus on risks, red flags, and hidden problems. Do NOT describe the rooms aesthetically or functionally here (that belongs in Chapter 2). Avoid "fluff" or generic room descriptions. If a room has a specific risk (e.g. "damp in bedroom wall"), mention the risk, not the bedroom's decor.
      - **Presentation**: Use the new 'synthesis' and 'alerts' structure. The synthesis should be journalistic and objective. The alerts should be punchy and actionable (e.g., "Risk of X due to Y").
    - **Chapter 2 Focus (Execution Reality)**: Set realistic expectations - true renovation costs, permit timelines, contractor availability.
      - **Room-by-Room**: This is where you describe the condition and specific renovation needs of each room. Include the "one_liner" summary HERE for each room. Consolidate "Bedroom" generic clusters into specific ones if possible, or output them clearly. DO NOT include "Zonas Comunes".
      - **COST ESTIMATION**: Use the 'BASELINE RENOVATION COST' data. It contains RAG-verified pricing per m².
        - If 'BASELINE RENOVATION COST' provides a specific cost for a room (e.g., "Cocina: €12,000-15,000"), USE IT.
        - Cite the cost source if available (e.g., "Source: Habitissimo RAG").
        - If specific room cost is missing, fallback to 'SMART M2' dimensions x standard rates (€600-800/m² for cosmetic, €1000-1500/m² for full).
        - Be specific and show your math or source.
    - **Qué Verificar (Checklist)**:
       - Generate EXACTLY 5 points.
       - Structure per item:
         - headline: 2-3 words (e.g. "Humedades Salón", "Licencia Turística").
         - brief: 2 sentences. First: what to check. Second: why it matters but is solvable.
         - priority: 1-5 (1 = highest).
         - expansion: Details on steps, questions for agent, acceptance criteria, etc.
       - Mapea cada item al capítulo relevante (1, 2, o 3).
    - **References**: ONLY use URLs provided in the input data. Do NOT hallucinate URLs. If a URL is broken or malformed (e.g. has non-standard characters), do NOT include it. Validate that URLs start with http/https.
    - **Synthesize Research**: Don't just list research findings - synthesize them into coherent narratives that answer "Is it safe?", "Can I live here?", "Is it a good deal?"
    - **Language**: Professional Spanish.
    - **Tone**: Objective, professional, but accessible. Highlights risks but offers solutions. Empowers buyers with actionable intelligence.

    OUTPUT JSON SCHEMA:
    Returns a structured JSON object with the 3-Chapter structure AND verification checklist (see schema below).
    `;

    const responseSchema = {
      type: 'object',
      properties: {
        listing_id: { type: 'string' },
        generated_at: { type: 'string' },
        property_info: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            location: { type: 'string' },
            price_eur: { type: 'number' },
            last_updated: { type: 'string' }
          },
          required: ['title', 'location']
        },
        house_as_a_whole: {
          type: 'object',
          properties: {
            narrative_synthesis: { type: 'string' },
            cross_room_themes: { type: 'array', items: { type: 'string' } },
            room_one_liners: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  room_id: { type: 'string' },
                  room_name: { type: 'string' },
                  one_liner: { type: 'string' },
                  anchor: { type: 'string' }
                },
                required: ['room_id', 'room_name', 'one_liner', 'anchor']
              }
            }
          },
          required: ['narrative_synthesis', 'cross_room_themes', 'room_one_liners']
        },
        forensic_risk_audit: {
          type: 'object',
          properties: {
            structural_pathology: {
              type: 'object',
              properties: {
                synthesis: { type: 'string', minLength: 50 },
                risk_level: { type: 'string', enum: ['High', 'Medium', 'Low', 'Critical'] },
                alerts: { type: 'array', items: { type: 'string' }, minItems: 1 },
                evidence: { type: 'array', items: { type: 'object' } }
              },
              required: ['synthesis', 'risk_level', 'alerts']
            },
            environmental_hostility: {
              type: 'object',
              properties: {
                synthesis: { type: 'string', minLength: 50 },
                risk_level: { type: 'string', enum: ['High', 'Medium', 'Low', 'Critical'] },
                alerts: { type: 'array', items: { type: 'string' }, minItems: 1 },
                evidence: { type: 'array', items: { type: 'object' } }
              },
              required: ['synthesis', 'risk_level', 'alerts']
            },
            social_security: {
              type: 'object',
              properties: {
                synthesis: { type: 'string', minLength: 50 },
                risk_level: { type: 'string', enum: ['High', 'Medium', 'Low', 'Critical'] },
                alerts: { type: 'array', items: { type: 'string' }, minItems: 1 },
                evidence: { type: 'array', items: { type: 'object' } }
              },
              required: ['synthesis', 'risk_level', 'alerts']
            },
            urban_legality: {
              type: 'object',
              properties: {
                synthesis: { type: 'string', minLength: 50 },
                risk_level: { type: 'string', enum: ['High', 'Medium', 'Low', 'Critical'] },
                alerts: { type: 'array', items: { type: 'string' }, minItems: 1 },
                evidence: { type: 'array', items: { type: 'object' } }
          },
              required: ['synthesis', 'risk_level', 'alerts']
            }
          },
          required: ['structural_pathology', 'environmental_hostility', 'social_security', 'urban_legality']
        },
        execution_reality_check: {
          type: 'object',
          properties: {
            renovation_reality: {
              type: 'object',
              properties: {
                summary: { type: 'string', minLength: 50 },
                key_findings: { type: 'array', items: { type: 'string' }, minItems: 1 },
                cost_estimates: { type: 'array', items: { type: 'string' } },
                timeline_expectations: { type: 'array', items: { type: 'string' } },
                evidence: { type: 'array', items: { type: 'object' } }
          },
              required: ['summary', 'key_findings']
            },
            infrastructure: {
              type: 'object',
              properties: {
                summary: { type: 'string', minLength: 50 },
                key_findings: { type: 'array', items: { type: 'string' }, minItems: 1 },
                evidence: { type: 'array', items: { type: 'object' } }
              },
              required: ['summary', 'key_findings']
            },
            room_by_room: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              room_id: { type: 'string' },
              room_name: { type: 'string' },
                  one_liner: { type: 'string' },
              findings: { type: 'array', items: { type: 'string' } },
                  renovation_costs: { type: 'array', items: { type: 'string' } },
              uncertainties: { type: 'array', items: { type: 'string' } },
              anchor: { type: 'string' }
            },
            required: ['room_id', 'room_name', 'findings', 'anchor']
          }
            }
          },
          required: ['renovation_reality', 'infrastructure', 'room_by_room']
        },
        financial_intelligence: {
          type: 'object',
          properties: {
            hidden_opex_incentives: {
              type: 'object',
              properties: {
                summary: { type: 'string', minLength: 50 },
                hidden_costs: { type: 'array', items: { type: 'string' }, minItems: 1 },
                incentives: { type: 'array', items: { type: 'string' } },
                evidence: { type: 'array', items: { type: 'object' } }
              },
              required: ['summary', 'hidden_costs']
            },
            market_context: {
              type: 'object',
              properties: {
                summary: { type: 'string', minLength: 50 },
                key_findings: { type: 'array', items: { type: 'string' }, minItems: 1 },
                price_trends: { type: 'array', items: { type: 'string' } },
                negotiation_leverage: { type: 'array', items: { type: 'string' } },
                evidence: { type: 'array', items: { type: 'object' } }
              },
              required: ['summary', 'key_findings']
            }
          },
          required: ['hidden_opex_incentives', 'market_context']
        },
        citations_references: {
          type: 'object',
          properties: {
            diagnostic: { type: 'array' },
            contextual: { type: 'array' },
            all_sources: { type: 'array' }
          },
          required: ['diagnostic', 'contextual', 'all_sources']
        },
        verification_checklist: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  headline: { type: 'string', minLength: 2, maxLength: 50 },
                  brief: { type: 'string', minLength: 10 },
                  priority: { type: 'number', minimum: 1, maximum: 5 },
                  chapter_map: { type: 'string', enum: ['Chapter 1', 'Chapter 2', 'Chapter 3'] },
                  expansion: {
                    type: 'object',
                    properties: {
                      steps: { type: 'array', items: { type: 'string' } },
                      room_ids: { type: 'array', items: { type: 'string' } }, // Just IDs, we fill URLs in code
                      questions_for_agent: { type: 'array', items: { type: 'string' } },
                      context: { type: 'string' },
                      acceptance: { type: 'array', items: { type: 'string' } },
                      oom: {
                        type: 'object',
                        properties: {
                          cost: { type: 'string' }, // Simplified string for OOM
                          time: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                required: ['headline', 'brief', 'priority', 'chapter_map']
              },
              minItems: 5,
              maxItems: 5
            }
          },
          required: ['items']
        }
      },
      required: ['listing_id', 'generated_at', 'property_info', 'house_as_a_whole', 'forensic_risk_audit', 'execution_reality_check', 'financial_intelligence', 'citations_references', 'verification_checklist']
    };

    const result = await callGeminiRest(prompt, {
      model: 'gemini-3-pro-preview', // UPGRADE
      temperature: 0.2,
      topP: 0.8,
      topK: 40,
      thinkingConfig: { thinkingLevel: 'HIGH' }, // HIGH THINKING (like zero-shot clustering)
      maxOutputTokens: 65535,
      responseMimeType: 'application/json',
      responseSchema
    });

    if (!result.success || !result.text) {
      console.error('❌ Gemini call failed:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: 'buyer_report_generation_failed',
          details: result.error
        },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      const cleaned = result.text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      parsed = JSON.parse(cleaned);
      console.log(`✅ Parsed buyer report structure:`, Object.keys(parsed || {}));

      // Post-process Verification Checklist to add real photo URLs
      if (parsed.verification_checklist && parsed.verification_checklist.items) {
        parsed.verification_checklist.items.forEach((item: any) => {
          if (item.expansion && item.expansion.room_ids && roomIdToPhotoUrls) {
            const photos: any[] = [];
            item.expansion.room_ids.forEach((roomId: string) => {
              const urls = roomIdToPhotoUrls.get(roomId);
              if (urls && urls.length > 0) {
                 photos.push({
                   room_id: roomId,
                   url: urls[0], // Use first photo
                   note: `Evidence for ${item.headline}`
                 });
              } else {
                 // Try to find by room name if ID fails
                  const room = roomByRoomAnalysis?.find((r: any) => r.room_id === roomId);
                  if (room) {
                     const clusterByName = clusters?.find((c: any) => 
                       c.cluster_name === room.room_name || 
                       c.cluster_name?.toLowerCase().includes(room.room_name?.toLowerCase() || '')
                     );
                     if (clusterByName?.photo_urls?.[0]) {
                        photos.push({
                          room_id: roomId,
                          url: clusterByName.photo_urls[0],
                          note: `Evidence for ${item.headline}`
                        });
                     }
                  }
              }
            });
            // Assign real photo objects
            if (photos.length > 0) {
              item.expansion.photos = photos;
            }
            // Clean up temp IDs
            delete item.expansion.room_ids; 
          }
        });
      }

    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      console.error('Raw response (first 500 chars):', result.text.substring(0, 500));
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_json',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
        },
        { status: 422 }
      );
    }

    // ========================================================================
    // STEP 3: Persist Report (with version)
    // ========================================================================
    const buyerReport = {
      ...parsed,
      _version: PIPELINE_VERSIONS.BUYER_REPORT,
      source_data: {
        research_context: researchContext,
        whole_property_analysis: wholePropertyAnalysis,
        room_by_room_analysis: roomByRoomAnalysis,
        unified_home_layout: unifiedHomeLayout,
        room_layouts_map: roomLayoutsMap,
        cadastral_data: cadastralRawReport // SAVE THE RAW CADASTRE DATA FOR UI
      }
    };

    const { error: upsertError } = await supabase
      .from('text_analysis_results')
      .upsert({
        listing_id: listingId,
        phase: 'buyer_report',
        results: buyerReport,
      }, { onConflict: 'listing_id,phase' });

    if (upsertError) {
      console.error('❌ Failed to persist buyer report:', upsertError);
      return NextResponse.json(
        {
          success: false,
          error: 'persist_failed',
          details: upsertError.message
        },
        { status: 500 }
      );
    }

    console.log(`✅ Buyer report completed for listing ${listingId}`);
    return NextResponse.json({ success: true, data: buyerReport });

  } catch (e: any) {
    console.error(`❌ Buyer report error:`, e);
    console.error('Error stack:', e?.stack);
    return NextResponse.json(
      {
        success: false,
        error: e?.message || 'unknown_error',
        details: process.env.NODE_ENV === 'development' ? e?.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to retrieve existing buyer report
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    console.log(`📋 Fetching buyer report for listing ${listingId}`);

    const { data, error } = await supabase
      .from('text_analysis_results')
      .select('results, created_at, updated_at')
      .eq('listing_id', listingId)
      .eq('phase', 'buyer_report')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          success: false,
          error: 'buyer_report_not_found',
          message: 'Buyer report not found. Run POST to generate.',
          details: error?.message
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data.results,
      metadata: {
        created_at: data.created_at,
        updated_at: data.updated_at
      }
    });
  } catch (e: any) {
    console.error(`❌ Error fetching buyer report:`, e);
    return NextResponse.json(
      {
        success: false,
        error: e?.message || 'unknown_error',
        details: process.env.NODE_ENV === 'development' ? e?.stack : undefined
      },
      { status: 500 }
    );
  }
}
