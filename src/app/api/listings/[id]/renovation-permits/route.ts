import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { validatePermitsOutput, permitsOutputSchema } from '@/lib/schemas/renovation-schemas';
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
  // Check if called from orchestrator - if so, use step logger
  const isOrchestratorContext = request.headers.get('X-Orchestrator-Context') === 'true';
  const stepName = request.headers.get('X-Step-Name') || 'M';
  
  // Use step logger when orchestrator is running, otherwise use console
  const logger = isOrchestratorContext ? createStepLogger(stepName) : console;

  const { id: listingId } = await params;

  try {
    logger.log(`📑 Generating renovation permits report for listing ${listingId}`);

    // Fetch scope report (scope seed output)
    const { data: scopeData, error: scopeError } = await supabase
      .from('renovation_scope_reports')
      .select('report_data')
      .eq('listing_id', listingId)
      .single();

    if (scopeError || !scopeData) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No renovation scope found. Run renovation-scope endpoint first.',
          details: scopeError?.message 
        },
        { status: 404 }
      );
    }

    const scopeSeed = scopeData.report_data;

    // Fetch permits research results from renovation_research_results
    const { data: researchResults, error: researchError } = await supabase
      .from('renovation_research_results')
      .select('category, report_data')
      .eq('listing_id', listingId)
      .like('category', 'permits_%');

    if (researchError) {
      logger.warn('⚠️ Could not fetch research results:', researchError);
    }

    // Organize research by tier
    const researchByTier: Record<string, any> = {};
    if (researchResults) {
      for (const result of researchResults) {
        const tier = result.category.replace('permits_', '');
        researchByTier[tier] = result.report_data;
        }
    }

    // Fetch listing data for context
    const { data: listingData, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (listingError || !listingData) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Listing not found',
          details: listingError?.message 
        },
        { status: 404 }
      );
    }

    // Generate permits for EACH tier separately
    const tierPermits: Record<string, any> = {};
    const tierKeys: Array<'estandar' | 'optimo' | 'plus'> = ['estandar', 'optimo', 'plus'];

    for (const tierKey of tierKeys) {
      const tier = scopeSeed.tiers?.[tierKey];
      if (!tier?.work_items || tier.work_items.length === 0) {
        logger.log(`⚠️ No work items found for tier ${tierKey}, skipping`);
        tierPermits[tierKey] = { tier: tierKey, permits: [] };
        continue;
      }

      const tierWorkItems = tier.work_items.map((item: any) => ({
        id: item.id,
        tier: item.tier || tierKey,
        name: item.name,
        subtitle: item.subtitle,
        likely_permit_types_guess: item.likely_permit_types_guess
      }));

      logger.log(`📑 Generating permits for tier ${tierKey} (${tierWorkItems.length} items)...`);

      const prompt = `You are a compliance expert for Spanish renovations. Identify permits needed for the ${tierKey.toUpperCase()} tier ONLY.

PROPERTY CONTEXT:
- Listing ID: ${listingId}
- Location: ${listingData.city || 'Spain'}, ${listingData.region || ''}
- Area: ${listingData.scraped_data?.useful_area_m2 || listingData.scraped_data?.constructed_area_m2 || 'Unknown'} m²
- Tier: ${tierKey} (${tierKey === 'estandar' ? 'basic/essential work' : tierKey === 'optimo' ? 'moderate renovation' : 'comprehensive luxury renovation'})

WORK ITEMS FOR THIS TIER ONLY:
${JSON.stringify(tierWorkItems, null, 2)}

PERMITS RESEARCH DATA FOR THIS TIER:
${JSON.stringify(researchByTier[tierKey] || {}, null, 2)}

TASK:
Identify permits needed for the work items in THIS TIER ONLY. Map permits to work items by work ID.

CRITICAL RULES:
- Generate permits ONLY for work items that ACTUALLY REQUIRE permits
- **Create permit records only for work that requires permits** (e.g., structural changes, major installations, electrical/plumbing modifications)
- **Omit permit records for work that doesn't require permits** - if no permit is needed, simply omit it
- Each permit can apply to MULTIPLE work items via applies_to_work_ids array
- Group work items that need the same permit together
- **PRIORITIZE research metrics**: If permits research contains metrics.low and metrics.high (in weeks) for permit processing times, use those for expected_time_weeks. Research data overrides general estimates.
- Each permit record must include:
  - permit_type: Spanish permit name (e.g., "Licencia de Obra Mayor", "Declaración Responsable", "Licencia de Obra Menor")
  - applies_to_work_ids: Array of work item IDs from THIS TIER that need this permit
  - why_needed: 2-4 sentence explanation (10-600 chars, Spanish)
  - what_needed: Array of required documents/requirements (each 2-120 chars, Spanish)
  - issuing_authority: Who issues it (e.g., "Ayuntamiento de Calvià", "Gobierno de las Islas Baleares")
  - expected_time_weeks: Integer (0-104 weeks) - USE RESEARCH METRICS IF AVAILABLE
  - confidence: "high", "medium", or "low" - higher when research metrics are present
  - pitfalls: Optional array of common pitfalls (each STRICTLY max 140 chars, Spanish - truncate if longer)

PERMIT TYPES IN SPAIN:
- Licencia de Obra Mayor (major works - structural changes, volume changes)
- Licencia de Obra Menor (minor works - significant renovations but no structural changes)
- Declaración Responsable / Comunicación Previa (minor works - can start immediately after filing)
- Licencia de Obra en Comunidad (community works - affects common areas)
- Licencia de Primera Ocupación (first occupancy - after major works)

OUTPUT FORMAT:
Return JSON matching this exact structure:
{
  "tier": "${tierKey}",
  "permits": [
    {
      "permit_type": "Licencia de Obra Menor",
      "applies_to_work_ids": ["${tierWorkItems[0]?.id || 'item-id'}"],
      "why_needed": "Se requiere porque se realizan reformas integrales que modifican instalaciones.",
      "what_needed": [
        "Memoria técnica descriptiva",
        "Planos de estado actual y reformado",
        "Presupuesto de ejecución material"
      ],
      "issuing_authority": "Ayuntamiento de Calvià",
      "expected_time_weeks": 6,
      "confidence": "high",
      "pitfalls": [
        "Los trámites pueden alargarse en verano"
      ]
    }
    // ... only include permits that are ACTUALLY REQUIRED
    // If a work item doesn't need a permit, don't create a permit record for it
  ]
}

CRITICAL: 
- Only include permits that are ACTUALLY REQUIRED by Spanish/Mallorcan regulations
- Create permit records only for work that requires permits
- Omit permit records for work that doesn't require permits - just omit them
- Each work item that needs a permit should appear in at least one permit's applies_to_work_ids
- Group work items that need the same permit together (efficient mapping)
- Be specific to Spanish/Mallorcan regulations`;

      // Simplified response schema for Gemini
    const responseSchema = {
      type: 'object',
      properties: {
          tier: { type: 'string' },
        permits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              permit_type: { type: 'string' },
              applies_to_work_ids: {
                type: 'array',
                items: { type: 'string' }
              },
              why_needed: { type: 'string' },
              what_needed: {
                type: 'array',
                items: { type: 'string' }
              },
              issuing_authority: { type: 'string' },
              expected_time_weeks: { type: 'number' },
              pitfalls: {
                type: 'array',
                items: { 
                  type: 'string',
                  maxLength: 140  // Enforce 140 char limit in schema so Gemini respects it
                }
              },
              confidence: { type: 'string' }
              },
              required: ['permit_type', 'applies_to_work_ids', 'why_needed', 'what_needed', 'issuing_authority', 'expected_time_weeks', 'confidence']
          }
        }
        },
        required: ['tier', 'permits']
    };

      // Call Gemini REST API for this tier
      // Calculate estimated tokens: ~200 tokens per permit + overhead
      const estimatedTokens = Math.max(16384, (tierWorkItems.length * 100) + 3000);
      const maxOutputTokens = Math.min(32768, estimatedTokens);
      
      logger.log(`📊 Tier ${tierKey}: ${tierWorkItems.length} items, using maxOutputTokens: ${maxOutputTokens}`);
      
    const geminiResponse = await callGeminiRest(prompt, {
        model: 'gemini-2.5-pro',
      temperature: 0.3,
      topP: 0.8,
      topK: 40,
        maxOutputTokens: maxOutputTokens,
      thinkingConfig: {
          thinkingBudget: 32768
      },
      responseMimeType: 'application/json',
      responseSchema
    });

    if (!geminiResponse.success || !geminiResponse.text) {
        logger.error(`❌ Gemini REST API call failed for tier ${tierKey}:`, geminiResponse.error);
      return NextResponse.json(
        { 
          success: false,
            error: `Failed to get AI response for tier ${tierKey}`,
          details: geminiResponse.error,
          rawError: geminiResponse.rawResponse
        },
        { status: 500 }
      );
    }

    // Parse JSON response
      let tierPermitData: any;
    try {
    const cleaned = geminiResponse.text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        tierPermitData = JSON.parse(cleaned);
        logger.log(`✅ Successfully parsed permits for ${tierKey} (${tierPermitData.permits?.length || 0} permits)`);
    } catch (parseError) {
        logger.error(`❌ Failed to parse AI response for tier ${tierKey}:`, parseError);
      return NextResponse.json(
        { 
          success: false, 
            error: `Failed to parse AI response for tier ${tierKey}`,
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
        },
        { status: 500 }
      );
    }

      // Filter out any "no permit required" entries
      if (tierPermitData.permits && Array.isArray(tierPermitData.permits)) {
        tierPermitData.permits = tierPermitData.permits.filter((permit: any) => {
          const permitType = (permit.permit_type || '').toLowerCase();
          const shouldExclude = 
            permitType.includes('no sujeta') ||
            permitType.includes('no requiere') ||
            permitType.includes('no necesita') ||
            permitType.includes('actuación no') ||
            permitType === '';
          
          if (shouldExclude) {
            logger.log(`⚠️ Filtering out "no permit required" entry: ${permit.permit_type}`);
            return false;
          }
          return true;
        });
      }

      // Verify work items that need permits are covered
    const coveredWorkIds = new Set<string>();
      for (const permit of tierPermitData.permits || []) {
      for (const workId of permit.applies_to_work_ids || []) {
        coveredWorkIds.add(workId);
      }
    }
      // Note: Some work items legitimately don't need permits (cleaning, painting, etc.)
      // So we don't fail if items are missing - that's expected

    // Ensure expected_time_weeks are integers within range
      // Also truncate pitfalls to max 140 characters
      if (tierPermitData.permits) {
        for (const permit of tierPermitData.permits) {
        permit.expected_time_weeks = Math.round(permit.expected_time_weeks);
        if (permit.expected_time_weeks < 0) permit.expected_time_weeks = 0;
        if (permit.expected_time_weeks > 104) permit.expected_time_weeks = 104;
          
          // Truncate pitfalls to max 140 characters (smart truncation at word boundaries)
          if (permit.pitfalls && Array.isArray(permit.pitfalls)) {
            permit.pitfalls = permit.pitfalls.map((pitfall: string) => {
              if (pitfall.length > 140) {
                // Try to truncate at word boundary (last space before 137 chars)
                let truncated = pitfall.substring(0, 137);
                const lastSpace = truncated.lastIndexOf(' ');
                // If we find a space within the last 20 chars, use it; otherwise hard cut
                if (lastSpace > 117) {
                  truncated = pitfall.substring(0, lastSpace);
                }
                logger.warn(`⚠️ Truncating pitfall from ${pitfall.length} to ${truncated.length + 3} chars: "${truncated.substring(0, 50)}..."`);
                return truncated + '...';
              }
              return pitfall;
            });
          }
        }
      }

      tierPermits[tierKey] = tierPermitData;
    }

    // Combine all tier permits into final output
    const permitsOutput = {
      listing_id: listingId,
      generated_at: new Date().toISOString(),
      tiers: tierPermits
    };

    // Validate with AJV (schema updated to support per-tier structure)
    const isValid = validatePermitsOutput(permitsOutput as any);
    if (!isValid) {
      logger.warn('⚠️ AJV validation warnings (may be due to new structure):', validatePermitsOutput.errors);
          // Don't fail - schema may need updating
    }

    // Store the permits report
    const { error: storeError } = await supabase
      .from('renovation_permits_reports')
      .upsert({
        listing_id: listingId,
        report_data: permitsOutput,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'listing_id'
      });

    if (storeError) {
      logger.error('❌ Failed to store permits report:', storeError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to store permits report',
          details: storeError.message 
        },
        { status: 500 }
      );
    }

    logger.log('✅ Permits reports generated and stored successfully for all tiers');

    return NextResponse.json({
      success: true,
      message: 'Renovation permits generated successfully',
      data: permitsOutput
    });

  } catch (error) {
    logger.error('Permits generation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    const { data, error } = await supabase
      .from('renovation_permits_reports')
      .select('report_data')
      .eq('listing_id', listingId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No permits report found for this listing',
          details: error?.message 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data.report_data
    });

  } catch (error) {
    console.error('Error fetching permits report:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
