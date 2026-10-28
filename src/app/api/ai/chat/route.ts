import { NextRequest, NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';

// Lazy initialization to avoid build-time errors
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase environment variables');
  return createClient(url, key);
}

// Note: Grounding citations are extracted but not used for URL replacement
// We only trust URLs from our curated search results stored in the database

// Helper function to detect if text is primarily Spanish
function isSpanish(text: string): boolean {
  const spanishWords = /\b(es|la|el|de|en|un|una|con|por|para|que|del|las|los|está|son|tiene|tiene|habita|baño|dormitorio|salón|terraza|vista|construido|reformado)\b/gi;
  return spanishWords.test(text);
}

// Helper function to detect if text is primarily English
function isEnglish(text: string): boolean {
  const englishWords = /\b(the|is|are|was|were|has|have|been|built|constructed|renovated|bedroom|bathroom|living|terrace|view|property|apartment)\b/gi;
  return englishWords.test(text);
}

// Helper function to detect language of user question (simple heuristic)
function detectQuestionLanguage(messages: Array<{ role: 'user' | 'assistant'; content: string }>): 'es' | 'en' {
  if (messages.length === 0) return 'en';
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  if (!lastUserMessage) return 'en';
  
  // Check for common Spanish words
  const spanishIndicators = /\b(cómo|qué|cuál|dónde|cuándo|por qué|hay|tiene|está|son|era|eran|fueron|realizaron|hizo|hicieron|renovación|reforma)\b/gi;
  if (spanishIndicators.test(lastUserMessage.content)) {
    return 'es';
  }
  return 'en';
}

// Helper function to detect if text should be a blockquote (distinctive/emotional)
function shouldBeBlockquote(text: string): boolean {
  const textLower = text.toLowerCase();
  
  // Check for emotional/distinctive indicators
  const emotionalMarkers = [
    /[!?]{2,}/, // Multiple exclamation/question marks
    /\b(wow|amazing|incredible|unbelievable|remarkable|stunning|shocking)\b/i,
    /\b(perfect|excellent|outstanding|exceptional|extraordinary)\b/i,
    /["']{2,}/, // Multiple quotes (emphasis)
  ];
  
  // Check if text is unusually short and punchy (distinctive)
  const isShortPunchy = text.length < 50 && (text.includes('!') || text.includes('?'));
  
  // Check if text has emotional markers
  const hasEmotionalMarkers = emotionalMarkers.some(pattern => pattern.test(text));
  
  // Check if text is a distinctive phrase (capitalized, exclamatory, etc.)
  const isDistinctive = /^[A-Z]/.test(text.trim()) && (text.includes('!') || text.includes('?')) && text.length < 100;
  
  return isShortPunchy || hasEmotionalMarkers || isDistinctive;
}

// Helper function to replace claim ID citations with inline quotes (default) or blockquotes (for distinctive/emotional text)
function replaceClaimIdsWithQuotes(
  content: string, 
  claimIdToSourceMap: Record<string, string>
): string {
  // Pattern to match claim IDs on their own line or inline: [F1-39], [F1-39, F1-40], etc.
  const claimIdPattern = /\[(F\d+-\d+(?:\s*,\s*F\d+-\d+)*)\]/g;
  
  // Collect all matches with their source texts and context
  const matches: Array<{ match: string; sourceTexts: string[]; beforeMatch: string; afterMatch: string }> = [];
  let match;
  let lastIndex = 0;
  
  // Find all matches and collect them with context
  while ((match = claimIdPattern.exec(content)) !== null) {
    const claimIdsStr = match[1];
    const claimIds = claimIdsStr.split(',').map((id: string) => id.trim());
    
    // Collect source texts for all claim IDs
    const sourceTexts: string[] = [];
    for (const claimId of claimIds) {
      const sourceText = claimIdToSourceMap[claimId];
      if (sourceText) {
        sourceTexts.push(sourceText);
      }
    }
    
    if (sourceTexts.length > 0) {
      // Get context before and after the match (100 chars each)
      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;
      const beforeMatch = content.substring(Math.max(0, matchStart - 100), matchStart).trim();
      const afterMatch = content.substring(matchEnd, Math.min(content.length, matchEnd + 100)).trim();
      
      matches.push({
        match: match[0],
        sourceTexts,
        beforeMatch,
        afterMatch
      });
    }
  }
  
  let result = content;
  
  if (matches.length === 0) {
    // No matches, just remove any remaining citations
    return content.replace(/\[F\d+-\d+(?:\s*,\s*F\d+-\d+)*\]/g, '');
  }
  
  // Process each match - use inline quotes by default, blockquotes only for distinctive text
  for (const m of matches) {
    const uniqueSources = [...new Set(m.sourceTexts)];
    let combinedSource = uniqueSources.join(', ');
    
    // Truncate if too long (for inline quotes, keep it shorter)
    const maxInlineLength = 80;
    const maxBlockquoteLength = 150;
    
    // Determine if this should be a blockquote
    const shouldUseBlockquote = shouldBeBlockquote(combinedSource);
    const maxLength = shouldUseBlockquote ? maxBlockquoteLength : maxInlineLength;
    
    if (combinedSource.length > maxLength) {
      combinedSource = combinedSource.substring(0, maxLength - 3) + '...';
    }
    
    // Escape special regex characters
    const escapedMatch = m.match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Replace based on whether it should be blockquote or inline
    if (shouldUseBlockquote) {
      // Use blockquote for distinctive/emotional text
      result = result.replace(new RegExp(`${escapedMatch}`, 'g'), `\n\n> ${combinedSource}\n\n`);
    } else {
      // Use inline quotes by default - integrate into the sentence naturally
      // Check if citation is on its own line (followed by newline) or inline
      const isOnOwnLine = m.afterMatch.startsWith('\n') || content.indexOf(m.match) === content.lastIndexOf('\n' + m.match);
      
      // Check if citation is followed by punctuation (comma, period, etc.)
      const afterMatchTrimmed = m.afterMatch.trim();
      const isFollowedByPunctuation = /^[,.;:!?]/.test(afterMatchTrimmed);
      const followingPunctuation = isFollowedByPunctuation ? afterMatchTrimmed[0] : '';
      
      if (isOnOwnLine) {
        // Citation was on its own line - find the preceding sentence and integrate quote
        const sentenceEnd = m.beforeMatch.lastIndexOf('.');
        const lastSentence = sentenceEnd > 0 ? m.beforeMatch.substring(sentenceEnd + 1).trim() : m.beforeMatch.trim();
        
        // Check for natural quote intro phrases
        const quoteIntros = ['says', 'mentions', 'notes', 'states', 'indicates', 'shows', 'describes', 'specifies'];
        const hasIntro = quoteIntros.some(intro => {
          const lowerLast = lastSentence.toLowerCase();
          return lowerLast.endsWith(intro) || lowerLast.includes(intro + ' ') || lowerLast.includes(intro + ' that');
        });
        
        if (hasIntro) {
          // Replace citation with inline quote after the intro, handle following punctuation
          const replacement = isFollowedByPunctuation 
            ? ` "${combinedSource}"${followingPunctuation}`
            : ` "${combinedSource}"`;
          result = result.replace(new RegExp(`\\s*${escapedMatch}(\\s*)${followingPunctuation ? `\\s*\\${followingPunctuation}` : ''}`, 'g'), replacement);
        } else if (lastSentence.length > 0) {
          // Add quote naturally after the sentence, handle following punctuation
          const replacement = isFollowedByPunctuation
            ? `, "${combinedSource}"${followingPunctuation}`
            : `, "${combinedSource}"`;
          result = result.replace(new RegExp(`\\s*${escapedMatch}(\\s*)${followingPunctuation ? `\\s*\\${followingPunctuation}` : ''}`, 'g'), replacement);
        } else {
          // Fallback: add with natural intro, handle following punctuation
          const replacement = isFollowedByPunctuation
            ? `The listing notes "${combinedSource}"${followingPunctuation}`
            : `The listing notes "${combinedSource}"`;
          result = result.replace(new RegExp(`\\s*${escapedMatch}(\\s*)${followingPunctuation ? `\\s*\\${followingPunctuation}` : ''}`, 'g'), replacement);
        }
      } else {
        // Citation is inline - replace directly with quote, handling following punctuation
        const punctuationEscaped = followingPunctuation ? followingPunctuation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
        if (isFollowedByPunctuation) {
          // Replace citation with quote, preserving the punctuation but removing extra space
          // Pattern: citation + optional whitespace + punctuation
          result = result.replace(new RegExp(`${escapedMatch}\\s*${punctuationEscaped}`, 'g'), `"${combinedSource}"${followingPunctuation}`);
        } else {
          // No punctuation after, just replace citation (remove any trailing space)
          result = result.replace(new RegExp(`${escapedMatch}\\s*`, 'g'), `"${combinedSource}"`);
        }
      }
    }
  }
  
  // Remove any remaining claim ID citations that weren't processed
  result = result.replace(/\[F\d+-\d+(?:\s*,\s*F\d+-\d+)*\]/g, '');
  
  // Remove citation patterns with underscores (internal references): [legal_administrative], [text_analysis], etc.
  // Pattern requires at least one underscore: [a-z]+_[a-z_]+
  result = result.replace(/\[[a-z]+_[a-z_]+\]/g, '');
  
  // Clean up any double spaces that might result from removals
  result = result.replace(/  +/g, ' ');
  
  // Clean up awkward inline quote placements
  result = result.replace(/ \s*"/g, ' "'); // Fix space before quote
  result = result.replace(/"\s+/g, '" '); // Fix space after quote
  
  // Remove extra spaces before punctuation after quotes
  result = result.replace(/"\s+([,.;:!?])/g, '"$1'); // "text" . -> "text".
  result = result.replace(/"\s+([,.;:!?])/g, '"$1'); // Double-check to catch any remaining
  
  return result;
}

// Function to decide on CTA after response is generated
async function decideCTA(
  responseText: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  listing: any,
  hasShownAnyTier: boolean,
  hasShownBlockquote: boolean
): Promise<{ type: 'whatsapp' | 'analysis' | 'viewing-checklist' | 'renovation-ideas' | 'tier' | 'none'; tier?: 'livable' | 'comfortable' | 'competitive'; whatsappMessage?: string } | null> {
  try {
    const lastUserMessage = conversationHistory.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
    const lastAssistantResponse = responseText;
    
    const prompt = `You are analyzing a real estate assistant's response to determine if it merits a call-to-action (CTA) button below the response.

RESPONSE TO ANALYZE:
"${lastAssistantResponse}"

USER'S QUESTION:
"${lastUserMessage}"

${listing ? `PROPERTY: ${listing.title || 'N/A'} - €${(listing.price_eur || listing.price || 0).toLocaleString()}` : ''}

${hasShownAnyTier ? 'NOTE: Renovation tier cards have already been shown - do NOT recommend tier CTAs' : ''}
${hasShownBlockquote ? 'NOTE: Blockquotes have already been shown' : ''}

DECIDE IF A CTA IS MERITED:
- Most responses do NOT need a CTA - only add one if there's clear value
- CTA should be for actions that are directly relevant to the user's question
- Avoid CTAs for simple factual answers
- Avoid CTAs if the response already has inline links that cover the action

AVAILABLE CTA OPTIONS:
1. "whatsapp" - If user should ask the agent something specific (with a pre-written message)
2. "analysis" - If user should see the full analysis report (opens modal)
3. "viewing-checklist" - If user should see the "what to verify" checklist (opens modal to that section)
4. "renovation-ideas" - If user should browse all renovation ideas OR if multiple renovation tiers are relevant (scrolls to section)
5. "tier" - If ONLY ONE specific renovation tier is highly relevant (shows tier card, opens modal). IMPORTANT: If multiple tiers are relevant, use "renovation-ideas" instead.
6. "none" - Most common - no CTA needed

IMPORTANT RULES:
- Only ONE CTA per response - choose the most relevant single action
- If the response mentions multiple renovation tiers (e.g., "estándar, óptimo, and plus" or compares tiers), use "renovation-ideas" NOT "tier"
- Use "tier" ONLY when ONE specific tier is the clear focus
- If uncertain between multiple options, choose "none" to avoid clutter

RETURN structured JSON:
- type: one of the options above (ONLY ONE CTA PER RESPONSE)
- If type is "whatsapp": include whatsappMessage (brief, relevant question in Spanish or English based on conversation)
- If type is "tier": include tier ("livable", "comfortable", or "competitive") - ONLY if ONE tier is clearly relevant
- If type is "none": return { type: "none" }`;

    const responseSchema = {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['whatsapp', 'analysis', 'viewing-checklist', 'renovation-ideas', 'tier', 'none']
        },
        tier: {
          type: 'string',
          enum: ['livable', 'comfortable', 'competitive'],
          description: 'Required only if type is "tier"'
        },
        whatsappMessage: {
          type: 'string',
          description: 'Required only if type is "whatsapp" - brief relevant question in Spanish or English'
        }
      },
      required: ['type']
    };

    const result = await callGeminiRest(prompt, {
      model: 'gemini-2.5-flash-lite',
      temperature: 0.3,
      maxOutputTokens: 256,
      responseMimeType: 'application/json',
      responseSchema
    });

    if (!result.success || !result.text) {
      console.warn('⚠️ CTA decision failed, defaulting to no CTA');
      return null;
    }

    const parsed = JSON.parse(result.text.trim());
    
    if (parsed.type === 'none') {
      return null;
    }

    // Validate tier CTA if type is tier
    if (parsed.type === 'tier') {
      if (!parsed.tier || !['livable', 'comfortable', 'competitive'].includes(parsed.tier)) {
        console.warn('⚠️ Invalid tier in CTA decision, defaulting to renovation-ideas');
        // If invalid tier, fall back to renovation-ideas instead of none
        return { type: 'renovation-ideas' };
      }
      if (hasShownAnyTier) {
        console.warn('⚠️ Tier CTA requested but tiers already shown, defaulting to renovation-ideas');
        // If tiers already shown, fall back to renovation-ideas
        return { type: 'renovation-ideas' };
      }
      
      // Check if response mentions multiple tiers - if so, use renovation-ideas instead
      const tierMentions = [
        (lastAssistantResponse.match(/est[aá]ndar|livable/gi) || []).length,
        (lastAssistantResponse.match(/[oó]ptimo|comfortable/gi) || []).length,
        (lastAssistantResponse.match(/plus|competitive/gi) || []).length
      ].filter(count => count > 0).length;
      
      if (tierMentions > 1) {
        console.warn(`⚠️ Multiple tiers mentioned (${tierMentions}), converting tier CTA to renovation-ideas`);
        return { type: 'renovation-ideas' };
      }
    }

    return {
      type: parsed.type,
      ...(parsed.tier && { tier: parsed.tier }),
      ...(parsed.whatsappMessage && { whatsappMessage: parsed.whatsappMessage })
    };
  } catch (error) {
    console.error('CTA decision error:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json().catch(() => ({}));
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = Array.isArray(body?.messages) ? body.messages : [];
    const listingId = body?.listingId ?? null;
    const shownTiers: Array<'livable' | 'comfortable' | 'competitive'> = Array.isArray(body?.shownTiers) ? body.shownTiers : [];
    const shownCTAs: Array<'analysis' | 'renovation'> = Array.isArray(body?.shownCTAs) ? body.shownCTAs : [];
    const hasShownAnyTier: boolean = body?.hasShownAnyTier === true;
    const hasShownBlockquote: boolean = body?.hasShownBlockquote === true;

    if (!listingId) {
      return NextResponse.json({ success: false, error: 'listingId required' }, { status: 400 });
    }

    // Convert listingId to integer for tables that use INTEGER/BIGINT (most tables)
    const listingIdInt = parseInt(listingId, 10);
    if (isNaN(listingIdInt)) {
      return NextResponse.json({ success: false, error: 'Invalid listingId' }, { status: 400 });
    }

    // Build context from all available data sources
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
        const scrapedData = listing.scraped_data || {};
        
        contextParts.push(`Title: ${listing.title || 'N/A'}`);
        contextParts.push(`Price: €${(listing.price_eur || listing.price || 0).toLocaleString()}`);
        
        // Area (m2) - from scraped_data
        const area = scrapedData.areas?.constructed || scrapedData.areas?.useful || scrapedData.sqm || scrapedData.constructed_area || null;
        if (area) {
          contextParts.push(`Area: ${area} m²`);
          if (scrapedData.areas?.useful && scrapedData.areas?.constructed && scrapedData.areas.useful !== scrapedData.areas.constructed) {
            contextParts.push(`Useful area: ${scrapedData.areas.useful} m²`);
          }
        }
        
        // Bedrooms (habitaciones) - from scraped_data
        const bedrooms = scrapedData.bedrooms || null;
        if (bedrooms !== null) {
          contextParts.push(`Bedrooms: ${bedrooms}`);
        }
        
        // Bathrooms - from scraped_data
        const bathrooms = scrapedData.bathrooms || null;
        if (bathrooms !== null) {
          contextParts.push(`Bathrooms: ${bathrooms}`);
        }
        
        // Full location details
        const locationParts: string[] = [];
        if (listing.address) locationParts.push(listing.address);
        if (listing.city) locationParts.push(listing.city);
        if (listing.region) locationParts.push(listing.region);
        if (listing.postal_code) locationParts.push(listing.postal_code);
        if (listing.country) locationParts.push(listing.country);
        if (locationParts.length > 0) {
          contextParts.push(`Full location: ${locationParts.join(', ')}`);
        } else if (scrapedData.location?.address || scrapedData.address) {
          contextParts.push(`Location: ${scrapedData.location?.address || scrapedData.address}`);
        }
        
        // Characteristics (características) - roomsAndAmenities and additional features
        const characteristics: string[] = [];
        if (scrapedData.roomsAndAmenities) {
          characteristics.push(`Rooms & Amenities: ${scrapedData.roomsAndAmenities}`);
        }
        if (scrapedData.additionalFeatures && Array.isArray(scrapedData.additionalFeatures) && scrapedData.additionalFeatures.length > 0) {
          characteristics.push(`Additional features: ${scrapedData.additionalFeatures.join(', ')}`);
        }
        if (characteristics.length > 0) {
          contextParts.push(characteristics.join('\n'));
        }
        
        // Property type
        if (scrapedData.property_type) {
          contextParts.push(`Property type: ${scrapedData.property_type}`);
        }
        
        // Year built - from scraped_data
        if (scrapedData.year_built || scrapedData.year) {
          contextParts.push(`Year built: ${scrapedData.year_built || scrapedData.year}`);
        }
        
        // Floor number
        if (scrapedData.floor || scrapedData.floor_number) {
          contextParts.push(`Floor: ${scrapedData.floor || scrapedData.floor_number}`);
        }
        
        // Energy rating
        if (scrapedData.energy_rating) {
          contextParts.push(`Energy rating: ${scrapedData.energy_rating}`);
        }
      }
      if (textAnalysis?.results) {
        const results = typeof textAnalysis.results === 'string' ? JSON.parse(textAnalysis.results) : textAnalysis.results;
        if (results.conclusions) contextParts.push(`Summary: ${JSON.stringify(results.conclusions)}`);
        if (results.strengths) contextParts.push(`Strengths: ${JSON.stringify(results.strengths)}`);
        if (results.verify) contextParts.push(`To verify: ${JSON.stringify(results.verify)}`);
      }
      contextParts.push('');
    }

    // 2. Text Analysis (all phases for comprehensive context) - uses INTEGER listing_id
    const { data: allTextAnalysis } = await supabase
      .from('text_analysis_results')
      .select('*')
      .eq('listing_id', listingIdInt)
      .order('created_at', { ascending: true });

    // Build claim ID to source_span mapping for quote display
    const claimIdToSourceMap: Record<string, string> = {};
    if (allTextAnalysis && allTextAnalysis.length > 0) {
      const aFactsResult = allTextAnalysis.find(ta => ta.phase === 'a_facts');
      if (aFactsResult) {
        const results = typeof aFactsResult.results === 'string' 
          ? JSON.parse(aFactsResult.results) 
          : aFactsResult.results;
        if (results.claims && Array.isArray(results.claims)) {
          for (const claim of results.claims) {
            if (claim.id && claim.source_span) {
              claimIdToSourceMap[claim.id] = claim.source_span;
            }
          }
        }
      }
    }

    if (allTextAnalysis && allTextAnalysis.length > 0) {
      contextParts.push('=== TEXT ANALYSIS ===');
      for (const ta of allTextAnalysis) {
        const phaseName = ta.phase?.toUpperCase().replace(/_/g, ' ') || 'UNKNOWN';
        const results = typeof ta.results === 'string' ? JSON.parse(ta.results) : ta.results;
        contextParts.push(`${phaseName}: ${JSON.stringify(results, null, 2)}`);
      }
      contextParts.push('');
    }

    // 3. Whole Property Analysis (uses BIGINT listing_id)
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

    // 4. Room-by-Room Analysis + E1/E2 Layouts (uses BIGINT listing_id)
    const { data: roomAnalyses } = await supabase
      .from('room_analyses')
      .select('analysis_data, room_layout_json, unified_home_layout_json')
      .eq('listing_id', listingIdInt)
      .order('created_at', { ascending: false });

    if (roomAnalyses && roomAnalyses.length > 0) {
      // E2: Unified Home Layout (single unified layout for entire property)
      const e2Layout = roomAnalyses[0]?.unified_home_layout_json;
      if (e2Layout) {
        contextParts.push('=== E2: UNIFIED HOME LAYOUT ===');
        const e2Data = typeof e2Layout === 'string' ? JSON.parse(e2Layout) : e2Layout;
        contextParts.push(JSON.stringify(e2Data, null, 2));
        contextParts.push('');
      }

      // E1: Per-Room Layouts (individual room layouts)
      const e1Layouts: any[] = [];
      for (const ra of roomAnalyses) {
        if (ra.room_layout_json) {
          const layout = typeof ra.room_layout_json === 'string' 
            ? JSON.parse(ra.room_layout_json) 
            : ra.room_layout_json;
          if (layout && Array.isArray(layout)) {
            e1Layouts.push(...layout);
          } else if (layout) {
            e1Layouts.push(layout);
          }
        }
      }
      if (e1Layouts.length > 0) {
        contextParts.push('=== E1: PER-ROOM LAYOUTS ===');
        contextParts.push(JSON.stringify(e1Layouts, null, 2));
        contextParts.push('');
      }

      // Room-by-Room Analysis (findings, materials, conditions)
      contextParts.push('=== ROOM-BY-ROOM ANALYSIS ===');
      for (const ra of roomAnalyses) {
        if (ra.analysis_data) {
          const analysisData = typeof ra.analysis_data === 'string' 
            ? JSON.parse(ra.analysis_data) 
            : ra.analysis_data;
          contextParts.push(JSON.stringify(analysisData, null, 2));
        }
      }
      contextParts.push('');
    }

    // 5. Integrated Analysis (already fetched above as textAnalysis)
    if (textAnalysis?.results) {
      const results = typeof textAnalysis.results === 'string' ? JSON.parse(textAnalysis.results) : textAnalysis.results;
      // Only add if not already included in allTextAnalysis section
      if (!allTextAnalysis?.find(ta => ta.phase === 'listing_diagnostic')) {
        contextParts.push('=== LISTING DIAGNOSTIC ANALYSIS ===');
        contextParts.push(JSON.stringify(results, null, 2));
        contextParts.push('');
      }
    }

    // 6. Analysis Google Search Curated Results (detailed, not summarized)
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
        contextParts.push(`Confidence: ${ac.confidence_level || 'N/A'}`);
        if (ac.representative_snippets) {
          contextParts.push(`Snippets: ${JSON.stringify(ac.representative_snippets)}`);
        }
        if (ac.sources_used) {
          contextParts.push(`Sources: ${JSON.stringify(ac.sources_used)}`);
        }
        contextParts.push('');
      }
    }

    // 7. Renovation Google Search Curated Results (uses BIGINT listing_id)
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

    // 8. Final Renovation Scope Data (uses BIGINT listing_id)
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
      // Summarize tiers instead of dumping full JSON
      if (scopeData.tiers && Array.isArray(scopeData.tiers)) {
        const tierSummary: any = {};
        for (const tier of scopeData.tiers) {
          tierSummary[tier.tier_id] = {
            name: tier.name,
            total_cost: tier.total_cost,
            timeline_weeks: tier.timeline_weeks,
            key_work_items: tier.work_items?.slice(0, 5).map((w: any) => w.description) || [],
            summary: tier.summary
          };
        }
        contextParts.push(JSON.stringify(tierSummary, null, 2));
      } else {
      contextParts.push(JSON.stringify(scopeData, null, 2));
      }
      contextParts.push('');
    }

    // 9. Buyer Report (text_analysis_results phase 'buyer_report')
    const { data: buyerReportData } = await supabase
      .from('text_analysis_results')
      .select('results')
      .eq('listing_id', listingIdInt)
      .eq('phase', 'buyer_report')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (buyerReportData?.results) {
      contextParts.push('=== BUYER REPORT ===');
      const buyerReport = typeof buyerReportData.results === 'string' 
        ? JSON.parse(buyerReportData.results) 
        : buyerReportData.results;
      
      // Summarize key sections instead of full dump
      const buyerReportSummary: any = {
        property_info: buyerReport.property_info,
        house_as_a_whole: {
          narrative_synthesis: buyerReport.house_as_a_whole?.narrative_synthesis?.substring(0, 500),
          cross_room_themes: buyerReport.house_as_a_whole?.cross_room_themes?.slice(0, 5)
        },
        house_diagnostics: {
          key_takeaways: buyerReport.house_diagnostics?.key_takeaways,
          visible_strengths: buyerReport.house_diagnostics?.visible_strengths?.slice(0, 5),
          findings_by_category: Object.fromEntries(
            Object.entries(buyerReport.house_diagnostics?.findings_by_category || {}).map(([k, v]: [string, any]) => [
              k, 
              typeof v === 'string' ? v.substring(0, 300) : v
            ])
          )
        },
        contextual_analysis: {
          summary: buyerReport.contextual_analysis?.summary?.substring(0, 500),
          categories: buyerReport.contextual_analysis?.categories?.map((cat: any) => ({
            category: cat.category,
            stance: cat.stance?.substring(0, 200),
            signals: cat.signals?.slice(0, 3)
          }))
        },
        room_findings: buyerReport.room_findings?.slice(0, 5).map((room: any) => ({
          room_name: room.room_name,
          findings: room.findings?.slice(0, 3),
          uncertainties: room.uncertainties?.slice(0, 2)
        }))
      };
      contextParts.push(JSON.stringify(buyerReportSummary, null, 2));
      contextParts.push('');
    }

    // 10. Verify Recommendations (qué verificar)
    const { data: verifyRecs } = await supabase
      .from('verify_recommendations')
      .select('recommendations')
      .eq('listing_id', listingId)
      .single();

    if (verifyRecs?.recommendations) {
      contextParts.push('=== VERIFY RECOMMENDATIONS (QUÉ VERIFICAR) ===');
      const recs = typeof verifyRecs.recommendations === 'string' 
        ? JSON.parse(verifyRecs.recommendations) 
        : verifyRecs.recommendations;
      
      // Include prioritized items
      if (recs.items && Array.isArray(recs.items)) {
        const recsSummary = recs.items.map((item: any) => ({
          headline: item.headline,
          brief: item.brief,
          priority: item.priority,
          expansion: item.expansion ? {
            steps: item.expansion.steps?.slice(0, 3),
            questions_for_agent: item.expansion.questions_for_agent?.slice(0, 2)
          } : undefined
        }));
        contextParts.push(JSON.stringify(recsSummary, null, 2));
      }
      contextParts.push('');
    }

    // 11. After Images Metadata (after_photos)
    const { data: afterPhotos } = await supabase
      .from('after_photos')
      .select('tier, room_id, photo_url, is_anchor, harmonized')
      .eq('listing_id', listingIdInt)
      .order('tier, room_id');

    if (afterPhotos && afterPhotos.length > 0) {
      contextParts.push('=== AFTER RENOVATION IMAGES ===');
      // Group by tier and room
      const imagesByTier: Record<string, any> = {};
      for (const photo of afterPhotos) {
        if (!imagesByTier[photo.tier]) {
          imagesByTier[photo.tier] = {};
        }
        if (!imagesByTier[photo.tier][photo.room_id]) {
          imagesByTier[photo.tier][photo.room_id] = [];
        }
        imagesByTier[photo.tier][photo.room_id].push({
          url: photo.photo_url,
          is_anchor: photo.is_anchor,
          harmonized: photo.harmonized
        });
      }
      contextParts.push(JSON.stringify(imagesByTier, null, 2));
      contextParts.push('');
    }

    // Build conversation history
    const history = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');

    // Build link map for hyperlinks
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000';
    const pagePath = `/property/${listingId}`;
    const linkMap: Record<string, string> = {};

    // 1. Renovation tiers
    linkMap['renovation-tier-estandar'] = `${baseUrl}${pagePath}?listingId=${listingId}#tier=livable`;
    linkMap['renovation-tier-optimo'] = `${baseUrl}${pagePath}?listingId=${listingId}#tier=comfortable`;
    linkMap['renovation-tier-plus'] = `${baseUrl}${pagePath}?listingId=${listingId}#tier=competitive`;
    linkMap['renovation-tier-livable'] = `${baseUrl}${pagePath}?listingId=${listingId}#tier=livable`;
    linkMap['renovation-tier-comfortable'] = `${baseUrl}${pagePath}?listingId=${listingId}#tier=comfortable`;
    linkMap['renovation-tier-competitive'] = `${baseUrl}${pagePath}?listingId=${listingId}#tier=competitive`;

    // 2. Buyer report sections (use hash navigation)
    linkMap['buyer-report'] = `#buyer-report-modal`;
    linkMap['buyer-report-property'] = `#buyer-report-modal#property-info`;
    linkMap['buyer-report-whole'] = `#buyer-report-modal#house-as-a-whole`;
    linkMap['buyer-report-diagnostics'] = `#buyer-report-modal#house-diagnostics`;
    linkMap['buyer-report-contextual'] = `#buyer-report-modal#contextual-analysis`;
    linkMap['buyer-report-rooms'] = `#buyer-report-modal#room-findings`;
    linkMap['buyer-report-citations'] = `#buyer-report-modal#citations`;

    // 3. Analysis report sections (use hash navigation like tier links) - legacy support
    linkMap['analysis-report'] = `#analysis-modal`;
    linkMap['analysis-section-key'] = `#analysis-modal#toc-key`;
    linkMap['analysis-section-strengths'] = `#analysis-modal#toc-strengths`;
    linkMap['analysis-section-verify'] = `#analysis-modal#toc-verify`;
    linkMap['analysis-section-details'] = `#analysis-modal#toc-details`;
    linkMap['analysis-section-categories'] = `#analysis-modal#toc-categories`;
    linkMap['analysis-section-rooms'] = `#analysis-modal#toc-rooms`;

    // 4. Verify recommendations (qué verificar)
    linkMap['verify-checklist'] = `#verify-checklist`;
    linkMap['que-verificar'] = `#verify-checklist`;

    // 5. Original listing URL
    if (listing?.source_url) {
      linkMap['original-listing'] = listing.source_url;
      linkMap['idealista-listing'] = listing.source_url;
    }

    // 6. Extract external URLs from Google Search results
    const externalUrls: Array<{ url: string; domain: string; category?: string }> = [];
    
    // From analysis_search_results (raw search results)
    const { data: analysisSearchRaw } = await supabase
      .from('analysis_search_results')
      .select('url, display_link, metadata')
      .eq('listing_id', listingId)
      .limit(50);
    
    if (analysisSearchRaw) {
      for (const result of analysisSearchRaw) {
        if (result.url && !externalUrls.find(u => u.url === result.url)) {
          const domain = result.display_link || new URL(result.url).hostname.replace('www.', '');
          externalUrls.push({
            url: result.url,
            domain: domain,
            category: (result.metadata as any)?.category
          });
        }
      }
    }

    // From renovation_search_results
    const { data: renovationSearchRaw } = await supabase
      .from('renovation_search_results')
      .select('url, display_link, metadata')
      .eq('listing_id', listingIdInt)
      .limit(50);
    
    if (renovationSearchRaw) {
      for (const result of renovationSearchRaw) {
        if (result.url && !externalUrls.find(u => u.url === result.url)) {
          const domain = result.display_link || new URL(result.url).hostname.replace('www.', '');
          externalUrls.push({
            url: result.url,
            domain: domain,
            category: (result.metadata as any)?.category
          });
        }
      }
    }

    // From analysis_curated_results (representative snippets)
    if (analysisCurated && analysisCurated.length > 0) {
      for (const ac of analysisCurated) {
        if (ac.representative_snippets) {
          const snippets = Array.isArray(ac.representative_snippets) 
            ? ac.representative_snippets 
            : typeof ac.representative_snippets === 'string'
            ? JSON.parse(ac.representative_snippets)
            : [];
          for (const snippet of snippets) {
            if (snippet.url && !externalUrls.find(u => u.url === snippet.url)) {
              const domain = snippet.source_domain || new URL(snippet.url).hostname.replace('www.', '');
              externalUrls.push({
                url: snippet.url,
                domain: domain,
                category: ac.category
              });
            }
          }
        }
      }
    }

    // From renovation_research_results
    if (renovationCurated && renovationCurated.length > 0) {
      for (const rc of renovationCurated) {
        if (rc.report_data) {
          const reportData = typeof rc.report_data === 'string' ? JSON.parse(rc.report_data) : rc.report_data;
          if (reportData.summaries && Array.isArray(reportData.summaries)) {
            for (const summary of reportData.summaries) {
              if (summary.sources && Array.isArray(summary.sources)) {
                for (const sourceUrl of summary.sources) {
                  if (typeof sourceUrl === 'string' && sourceUrl.startsWith('http') && !externalUrls.find(u => u.url === sourceUrl)) {
                    const domain = new URL(sourceUrl).hostname.replace('www.', '');
                    externalUrls.push({
                      url: sourceUrl,
                      domain: domain,
                      category: rc.category
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    // Add external URLs to link map with domain as key
    for (const extUrl of externalUrls) {
      // Use domain as key for lookup
      if (!linkMap[extUrl.domain]) {
        linkMap[extUrl.domain] = extUrl.url;
      }
    }

    // Build link reference string for prompt
    const linkReferences: string[] = [];
    linkReferences.push('\n=== HIPERVÍNCULOS DISPONIBLES ===');
    linkReferences.push('Usa estos enlaces markdown al referenciar:');
    linkReferences.push('\n**Tiers de Renovación:**');
    linkReferences.push('- [tier Estándar](#tier=livable) → Enlaza al tier de renovación Estándar/Livable');
    linkReferences.push('- [tier Óptimo](#tier=comfortable) → Enlaza al tier de renovación Óptimo/Comfortable');
    linkReferences.push('- [tier Plus](#tier=competitive) → Enlaza al tier de renovación Plus/Competitive');
    linkReferences.push('\n**Informe del Comprador (Buyer Report):**');
    linkReferences.push('- [Informe del Comprador](#buyer-report-modal) → Abre el informe completo del comprador');
    linkReferences.push('- [Información de la Propiedad](#buyer-report-modal#property-info) → Sección de información básica');
    linkReferences.push('- [La Casa como un Todo](#buyer-report-modal#house-as-a-whole) → Síntesis narrativa y temas transversales');
    linkReferences.push('- [Diagnóstico de la Casa](#buyer-report-modal#house-diagnostics) → Hallazgos por categoría técnica');
    linkReferences.push('- [Contexto y Ejecución](#buyer-report-modal#contextual-analysis) → Análisis contextual (permisos, contratistas, etc.)');
    linkReferences.push('- [Hallazgos por Habitación](#buyer-report-modal#room-findings) → Análisis detallado por habitación');
    linkReferences.push('- [Referencias](#buyer-report-modal#citations) → Fuentes y citaciones');
    
    linkReferences.push('\n**Qué Verificar (Verify Checklist):**');
    linkReferences.push('- [Qué Verificar](#verify-checklist) → Lista de verificación priorizada para la visita');
    
    linkReferences.push('\n**Secciones del Informe de Análisis (Legacy):**');
    linkReferences.push('- [Informe de Análisis](#analysis-modal) → Abre el informe de análisis completo');
    linkReferences.push('- [Puntos Clave](#analysis-modal#toc-key) → Abre el informe a la sección clave');
    linkReferences.push('- [Fortalezas](#analysis-modal#toc-strengths) → Abre el informe a la sección de fortalezas');
    linkReferences.push('- [Qué Verificar](#analysis-modal#toc-verify) → Abre el informe a la sección de verificación');
    linkReferences.push('- [Detalles](#analysis-modal#toc-details) → Abre el informe a la sección de detalles');
    linkReferences.push('- [Por Categoría](#analysis-modal#toc-categories) → Abre el informe a los hallazgos por categoría');
    linkReferences.push('- [Por Habitación](#analysis-modal#toc-rooms) → Abre el informe a la sección por habitación');
    if (listing?.source_url) {
      linkReferences.push(`\n**Anuncio Original:**`);
      linkReferences.push(`- [anuncio de Idealista](${listing.source_url}) o [anuncio original en Idealista](${listing.source_url})`);
    }
    if (externalUrls.length > 0) {
      linkReferences.push('\n**Fuentes Externas de Investigación (USA SOLO ESTAS):**');
      linkReferences.push(`Se encontraron ${externalUrls.length} fuentes externas curadas de nuestra búsqueda.`);
      linkReferences.push('\n**CRÍTICO: Reglas de cita de fuentes externas:**');
      linkReferences.push('- SIEMPRE hipervincula dominios externos usando URLs de la lista a continuación - NUNCA solo los listes entre corchetes');
      linkReferences.push('- INCORRECTO: "problemas comunes [isotec.de, murprotec.es]"');
      linkReferences.push('- CORRECTO: "problemas comunes ([isotec.de](url-completa-de-la-lista) y [murprotec.es](url-completa-de-la-lista))"');
      linkReferences.push('- Cuando menciones múltiples fuentes, formatea como: ([domain1.com](url1) y [domain2.com](url2))');
      linkReferences.push('- Muestra SOLO el nombre del dominio en el texto del enlace, pero enlaza a la URL completa de la lista a continuación');
      linkReferences.push('- IMPORTANTE: Solo usa URLs de esta lista curada - NO uses URLs de Google Search grounding');
      linkReferences.push('- Dominios disponibles con URLs (USA ESTOS):');
      // List first 15 domains with their URLs for easy lookup
      for (const extUrl of externalUrls.slice(0, 15)) {
        linkReferences.push(`  - ${extUrl.domain} → ${extUrl.url}`);
      }
    }
    linkReferences.push('\n**Instrucciones:**');
    linkReferences.push('- SIEMPRE usa enlaces markdown: [texto](url) - NUNCA citas en texto plano entre corchetes');
    linkReferences.push('- TODOS los enlaces deben ser inline e integrados naturalmente en las oraciones - NO CTAs explícitos');
    linkReferences.push('- Para tiers de renovación: Usa enlaces inline como "nuestra [renovación Estándar](#tier=livable)" dentro de las oraciones');
    linkReferences.push('- Para secciones de análisis: Usa enlaces inline como "como se nota en nuestro [análisis](#analysis-modal)" o "ver nuestro [informe de análisis](#analysis-modal#toc-verify)"');
    linkReferences.push('- Para fuentes externas: SIEMPRE hipervincula - formato: "información ([domain.com](url-completa))", NUNCA solo [domain.com]');
    linkReferences.push('- Para Idealista: Usa "el [anuncio de Idealista](listing-url)" o "como se muestra en el [anuncio original](listing-url)"');
    linkReferences.push('- NUNCA uses CTAs explícitos como "Ver Análisis Completo →", "Ver Idea de Renovación →", o "Explorar todas las ideas de renovación"');
    linkReferences.push('- Formato: Usa doble hash para secciones: #analysis-modal#toc-verify');
    linkReferences.push('=== FIN HIPERVÍNCULOS ===\n');

    // Build system prompt with all context
    const system = `Eres un asistente de inteligencia inmobiliaria para la plataforma Puedo Casa. Usa el contexto detallado proporcionado para responder preguntas con precisión. Sé CONCISO y accionable - mantén las respuestas breves y al grano. Usa viñetas o párrafos cortos. Si la información no está en el contexto, dilo claramente. Evita siempre consejos legales o financieros. Enfócate en lo que los compradores necesitan saber para evaluar la propiedad.

TONO Y PERSONALIDAD (MUY IMPORTANTE):
Eres un asesor senior, cercano y pragmático. Tu voz es:
- Equilibrada: reconoces lo bueno que destaca el agente (sin sarcasmo), y añades con calma lo que conviene mirar
- Tranquilizadora: "normal para la edad", "con un buen plan se hace", "si no se confirma ahora, lo pedimos y seguimos"
- Cercana: hablas claro, útil y con serenidad. Evitas sonar arisco o jurídico
- Pragmática: lo técnico en lenguaje llano. Nada de alarmismo
- Generadora de confianza: "bueno hay que averiguarlo que puede ser un problema pero tampoco tanto"
- Orientada a soluciones: "se puede hacer, con un buen plan y detalle todo se puede"

Ejemplos de tono:
- "Bueno claro, el agente hablará de lo bueno para vender la casa, pero tampoco está mintiendo... es una casa buena, y claro, con la edad necesita unos toques pero se puede hacer"
- "Normal en casas de esta época, si toca actualizar se programa y listo"
- "Nada grave si se pilla a tiempo; con buen oficio y detalle queda perfecto"
- "Échale un ojo a [X]: mira [señal]. Es normal en casas de esta edad; si toca actuar, con [acción] se resuelve bien"

IMPORTANTE: Usa este tono equilibrado y cercano en todas tus respuestas. Reconoce aspectos positivos mientras añades verificaciones pragmáticas sin alarmismo.

REGLAS CRÍTICAS DE ENLACES:
1. SIEMPRE usa hipervínculos markdown: [texto](url) - NUNCA citas en texto plano entre corchetes
2. Fuentes externas: SIEMPRE hipervincula dominios usando URLs de la lista curada en la sección HYPERLINKS - NUNCA solo los listes como [domain.com] o [isotec.de, murprotec.es]
3. Formato CORRECTO para fuentes externas: "información ([domain.com](url-completa-de-la-lista) y [domain2.com](url-completa-de-la-lista))"
4. INCORRECTO: "problemas [isotec.de, murprotec.es]" 
5. CORRECTO: "problemas ([isotec.de](url-completa-de-la-lista-curada) y [murprotec.es](url-completa-de-la-lista-curada))"
6. NO uses marcadores de cita como [WHOLE PROPERTY ANALYSIS] o [C1] - estos son IDs internos de seguimiento
7. Para IDs de afirmaciones como [F1-39, F1-41]: Colócalos en su propia línea - el sistema los convertirá automáticamente en blockquotes con el texto original del anuncio
8. Enlaces internos: TODOS los enlaces deben ser inline e integrados naturalmente en las oraciones - NO CTAs explícitos como "Ver Análisis Completo →" o "Ver Idea de Renovación →"
   - Informe del comprador: "como se detalla en nuestro [informe del comprador](#buyer-report-modal)" o "ver nuestro [informe](#buyer-report-modal#house-diagnostics)"
   - Qué verificar: "consulta nuestra lista de [qué verificar](#verify-checklist)" o "ver [qué verificar](#verify-checklist)"
   - Análisis (legacy): "como se detalla en nuestro [informe de análisis](#analysis-modal)" o "ver nuestro [análisis](#analysis-modal#toc-verify)"
   - Tiers de renovación: "nuestra [renovación Estándar](#tier=livable)" o "el enfoque [Óptimo](#tier=comfortable)"
   - Idealista: "el [anuncio original](listing-url)" o "como se muestra en el [anuncio de Idealista](listing-url)"
9. NUNCA uses CTAs explícitos en el texto de tu respuesta - todos los enlaces deben estar perfectamente integrados en las oraciones
10. IMPORTANTE: Solo usa URLs de la lista de fuentes externas curadas - NO crees enlaces desde citas de Google Search grounding`;

    const STRATEGIC_COMMUNICATION_FRAMEWORK = `
MARCO DE COMUNICACIÓN ESTRATÉGICA:

**Definición de Tarea:**
- Tu tarea principal es responder preguntas de compradores potenciales de propiedades, actuando como una guía útil y neutral.

**Tu Rol y Tono:**
- Eres un asistente que ayuda a los compradores a evaluar propiedades
- OFRECES ideas e insights voluntariamente, nunca vendes agresivamente ni presionas
- Tu objetivo es ayudar a los compradores a tomar decisiones informadas, no cerrar ventas
- Sé diferente de los agentes típicos: informativo y útil, no insistente
- Presenta las renovaciones como "buenas ideas" o "opciones a considerar", no como "deberías hacer esto"

**Definiciones:**
- **Tier Estándar (livable):** Se enfoca en actualizaciones esenciales para hacer una propiedad segura y funcional (ej: eléctrico básico, fontanería, pintura).
- **Tier Óptimo (comfortable):** Una renovación de rango medio para modernizar áreas clave como cocinas y baños con acabados y comodidades contemporáneas.
- **Tier Plus (premium):** Una renovación integral de alta gama que involucra cambios estructurales significativos, materiales premium y características avanzadas.

**Cuándo Sugerir Renovaciones (SELECTIVO - NO AUTOMÁTICO):**
- SOLO sugiere renovaciones cuando:
  * El comprador pregunta explícitamente sobre costes, mejoras, "qué podría hacer", opciones de renovación
  * El comprador expresa preocupaciones sobre características obsoletas, actualizaciones necesarias o problemas de condición
  * El comprador pregunta sobre "potencial", "valor", "modernización" o "mejoras"
  * La conversación fluye naturalmente hacia mejoras de la propiedad
- NO sugieras renovaciones:
  * En el primer saludo o preguntas no relacionadas
  * Cuando el comprador pregunta información básica de la propiedad (precio, ubicación, tamaño)
  * Cuando el comprador pregunta sobre temas legales, financieros o del vecindario
  * Muy temprano en la conversación (deja que el comprador lidere)

**Cómo Referenciar Renovaciones (SOLO ENLACES INLINE):**
- Referencia renovaciones naturalmente dentro de las oraciones usando enlaces inline
- Ejemplo: "Nuestra [renovación Estándar](#tier=livable) se enfoca en actualizaciones esenciales como eléctrico y fontanería"
- Ejemplo: "El enfoque [Óptimo](#tier=comfortable) modernizaría la cocina y los baños"
- NUNCA uses CTAs explícitos: "Ver Idea de Renovación →", "Explorar todas las ideas de renovación", etc.
- Los enlaces deben sentirse como continuaciones naturales del pensamiento, no como promociones

**Enlaces al Informe del Comprador (BUYER REPORT) - PRINCIPAL:**
- El informe del comprador es el documento principal y más completo. Contiene diagnóstico, análisis contextual, hallazgos por habitación, y referencias.
- Usa enlaces inline cuando el comprador necesita más detalle o verificación
- Formato: "como se detalla en nuestro [informe del comprador](#buyer-report-modal)" o "ver nuestro [informe](#buyer-report-modal#house-diagnostics)"
- Para secciones específicas: "ver el [diagnóstico](#buyer-report-modal#house-diagnostics)" o "consulta el [análisis contextual](#buyer-report-modal#contextual-analysis)"
- NUNCA uses CTAs explícitos: "Ver Informe Completo →", "Ver Análisis →"
- Los enlaces deben fluir naturalmente en las oraciones

**Enlaces a Qué Verificar (VERIFY CHECKLIST):**
- La lista de "qué verificar" es una lista priorizada de items para verificar en la visita
- Úsala cuando el comprador pregunta sobre qué revisar, qué preguntar al agente, o qué verificar en la visita
- Formato: "consulta nuestra lista de [qué verificar](#verify-checklist)" o "ver [qué verificar](#verify-checklist)"
- NUNCA uses CTAs explícitos

**Enlaces al Informe de Análisis (LEGACY - COMPLEMENTARIO):**
- El informe de análisis legacy existe para compatibilidad. El informe del comprador es preferido.
- Usa enlaces inline cuando sea relevante
- Formato: "Para más sobre esto, ver nuestro [análisis](#analysis-modal)" o "como se nota en nuestro [informe de análisis](#analysis-modal#toc-verify)"
- NUNCA uses CTAs explícitos: "Ver Análisis Completo →", "Ver Informe →"
- Los enlaces deben fluir naturalmente en las oraciones, no ser llamados a la acción independientes

**Flujo de Conversación:**
1. Responde la pregunta directamente y concisamente primero
2. Si es relevante, ofrece UNA sugerencia estratégica (renovación O informe del comprador O qué verificar, no múltiples)
3. Prioriza: Informe del comprador > Qué verificar > Renovaciones (solo cuando se pregunta explícitamente)
4. Deja que el comprador guíe la conversación - no fuerces temas
5. Construye momentum naturalmente, no disperses sugerencias por todas partes

**Conciencia de Contexto - Contenido Previamente Mostrado (CRÍTICO):**
${hasShownAnyTier ? `- **LAS TARJETAS DE TIER YA HAN SIDO MOSTRADAS** - NUNCA debes referenciar tiers de renovación de una manera que active nuevas tarjetas de vista previa de tier. No uses enlaces de tier como [tier Estándar](#tier=livable) - estos crearían tarjetas de tier duplicadas. En su lugar, referencia renovaciones naturalmente en texto sin enlaces, o usa menciones inline genéricas como "la renovación que discutimos"` : ''}
${hasShownBlockquote ? `- **LOS BLOCKQUOTES YA HAN SIDO MOSTRADOS** - NUNCA debes crear nuevos blockquotes con texto fuente. En su lugar, teje referencias a hechos previamente mencionados perfectamente en tus oraciones usando citas naturales. Por ejemplo: "Como notaste sobre la 'propiedad bien mantenida con jardines frondosos', esto se alinea con..." - hazlo sentir como una referencia conversacional, no una cita formal.` : ''}
${shownTiers.length > 0 && !hasShownAnyTier ? `- Los siguientes tiers de renovación han sido mencionados pero no mostrados como tarjetas: ${shownTiers.map(t => t === 'livable' ? 'Estándar' : t === 'comfortable' ? 'Óptimo' : 'Plus').join(', ')}` : ''}
${shownCTAs.includes('analysis') ? '- El informe de análisis YA ha sido introducido y vinculado en un mensaje anterior' : ''}
${shownCTAs.includes('renovation') ? '- Las ideas de renovación YA han sido introducidas y mostradas al usuario' : ''}

**Integración Refinada de CTAs (CRÍTICO para mensajes subsecuentes):**
${shownCTAs.length > 0 || hasShownAnyTier || hasShownBlockquote ? `
Como el contenido ya se ha mostrado antes, debes ser EXTREMADAMENTE refinado en cómo lo referencias:
- NO uses CTAs explícitos como "Ver nuestra idea de renovación →", "Ver Análisis Completo", "Explorar todas las ideas de renovación", o llamados a la acción independientes similares
- En su lugar, teje referencias perfectamente EN tus oraciones como si te refirieras a algo que el usuario ya conoce
- Haz que los enlaces se sientan como continuaciones naturales del pensamiento, no como promociones

${hasShownAnyTier ? `**TARJETAS DE TIER YA MOSTRADAS - REGLAS CRÍTICAS:**
- NUNCA uses enlaces de tier como [tier Estándar](#tier=livable) o [renovación Óptimo](#tier=comfortable) - estos crearían tarjetas de tier duplicadas
- En su lugar, referencia renovaciones naturalmente: "la renovación que esbozamos", "nuestro enfoque de renovación", "el enfoque Estándar que discutimos"
- Ejemplo: ❌ MALO: "La [renovación Estándar](#tier=livable) abordaría esto"
- Ejemplo: ✅ BUENO: "Como esbozamos en las opciones de renovación, el enfoque Estándar abordaría esto"
- Si debes referenciar un tier específico, hazlo en texto plano sin enlaces: "la renovación Estándar que discutimos"` : ''}

${hasShownBlockquote ? `**BLOCKQUOTES YA MOSTRADOS - REGLAS CRÍTICAS:**
- NUNCA crees nuevos blockquotes con citas fuente o citas del anuncio
- En su lugar, teje referencias perfectamente en oraciones usando citas naturales
- Usa citas conversacionales como: "Como notaste sobre la 'propiedad bien mantenida', esto se alinea con..."
- O: "El anuncio mencionó 'jardines frondosos' lo que sugiere..."
- Manténlo breve y natural - no crees citas formales de blockquote
- Ejemplo: ❌ MALO: Crear un blockquote como "> bien mantenida, una gran piscina"
- Ejemplo: ✅ BUENO: "El anuncio lo describió como 'bien mantenida con una gran piscina', lo que sugiere..."` : ''}

**Ejemplos de integración inline REFINADA:**
${!hasShownAnyTier && shownTiers.length > 0 ? `- ❌ MALO: "Podrías explorar nuestra renovación [tier Estándar](#tier=livable). Ver nuestra idea de renovación →"
  ✅ BUENO: "La [renovación Estándar](#tier=livable) que esbozamos antes aborda esta preocupación"
- ❌ MALO: "Para más detalles, ver nuestro informe de análisis completo"
  ✅ BUENO: "Como se nota en nuestro [análisis](#analysis-modal), esto requiere verificación"` : `- ❌ MALO: "Para más detalles, ver nuestro análisis completo"
  ✅ BUENO: "Como se detalla en nuestro [informe de análisis](#analysis-modal), esta es una consideración clave"`}

**Principios de redacción para integración inline:**
1. **Referencia naturalmente**: "Como se nota en...", "Como esbozamos...", "La renovación que discutimos...", "Como se mencionó..."
2. **Evita repetición**: No reintroduzcas lo que ya se ha mostrado - solo referéncialo naturalmente
3. **Fluye orgánicamente**: Los enlaces y referencias deben sentirse como parte de la explicación, no como promociones separadas
4. **Usa citas conversacionales**: Cuando referencias hechos blockquoteados, usa citas naturales en oraciones, no citas formales
5. **Sé conciso**: Un enlace o referencia inline por oración máximo, colocado donde añade valor
6. **Sin CTAs independientes**: Nunca termines un párrafo con "Ver nuestras ideas de renovación →" o similar
7. **Sin visuales duplicados**: Nunca actives tarjetas de tier o blockquotes que ya se han mostrado
` : `
- Para menciones por primera vez, usa CTAs claros pero no insistentes
- Una vez introducido, las referencias futuras deben ser perfectas e inline
`}

**Ejemplos de enlaces inline BUENOS:**
- Comprador: "La cocina se ve antigua, ¿cuánto costaría actualizarla?"
  → Tú: "Las actualizaciones de cocina típicamente van desde €8,000-€25,000 dependiendo del alcance. Nuestra [renovación Estándar](#tier=livable) se enfoca en actualizaciones básicas, mientras que el enfoque [Óptimo](#tier=comfortable) incluye comodidades modernas."

- Comprador: "Estoy preocupado por el sistema eléctrico"
  → Tú: "Esa es una preocupación válida y algo que verificar durante una visita. Nuestro [análisis](#analysis-modal#toc-verify) proporciona una lista detallada de qué inspeccionar."

- Comprador: "¿Cuáles son mis opciones de renovación?"
  → Tú: "Hemos preparado tres enfoques diferentes de renovación basados en presupuesto y objetivos: Estándar para actualizaciones esenciales, Óptimo para modernización, y Plus para renovaciones integrales. Cada uno tiene alcance, cronograma y permisos detallados."

**Ejemplos de sugerencias MALAS:**
- Comprador: "¿Cuál es el precio?"
  → ❌ No sugieras renovaciones o informe de análisis
  → ✅ Solo responde: "El precio de venta es €3,500,000."

- Comprador: "¿Qué tan lejos está de la playa?"
  → ❌ No sugieras renovaciones
  → ✅ Solo responde la pregunta

- Saludo del primer mensaje
  → ❌ No sugieras renovaciones inmediatamente
  → ✅ Dales la bienvenida, ofrece ayudar con preguntas

**Conclusión Clave:**
Tu valor está en ser una guía útil y neutral. Usa enlaces de renovación y análisis estratégicamente para apoyar el viaje del comprador, no para abrumarlos. Deja que sus preguntas y preocupaciones dicten cuándo y cómo introduces estas herramientas poderosas.
`;

    const contextStr = contextParts.length > 0 
      ? `\n\n=== PROPERTY CONTEXT ===\n${contextParts.join('\n')}\n=== END CONTEXT ===\n\n` 
      : '\n(No property context available yet.)\n\n';

    const linksStr = linkReferences.join('\n');

    // Build claim citation instructions for the AI
    const claimCitationInstructions = Object.keys(claimIdToSourceMap).length > 0
      ? `\n\n=== PAUTAS DE CITACIÓN DE AFIRMACIONES ===
Cuando referencias hechos en tus respuestas, puedes ver IDs de afirmaciones como [F1-39, F1-41] en el contexto. Estos son IDs internos de seguimiento.

${hasShownBlockquote ? `**CRÍTICO: LOS BLOCKQUOTES YA HAN SIDO MOSTRADOS EN MENSAJES ANTERIORES**
- NO crees nuevos blockquotes colocando IDs de afirmaciones como [F1-39, F1-41] en líneas separadas
- En su lugar, teje los hechos naturalmente en tus oraciones usando citas inline
- Ejemplo: ❌ MALO: "La propiedad fue construida en 1985.\n\n[F1-38, F1-39]\n\nEsto requiere verificación."
- Ejemplo: ✅ BUENO: "La propiedad fue construida en 1985, que como nota el anuncio está 'en buen estado', pero esto aún requiere verificación."
- Usa citas inline naturales dentro de las oraciones - no crees citas formales de blockquote
- Mantén las referencias breves y conversacionales` : `Los valores source_span a continuación son fragmentos de texto EXACTOS del anuncio original (generalmente español, a veces inglés u otros idiomas).

Fuentes de afirmaciones disponibles:
${Object.entries(claimIdToSourceMap).slice(0, 25).map(([id, source]) => `- ${id}: "${source}"`).join('\n')}
${Object.keys(claimIdToSourceMap).length > 25 ? `\n... y ${Object.keys(claimIdToSourceMap).length - 25} fuentes de afirmaciones más disponibles en el contexto.` : ''}

**FORMATO para citas de afirmaciones - USA CITAS INLINE POR DEFECTO:**
- Cuando referencias hechos que tienen IDs de afirmaciones como [F1-39, F1-41], coloca estos IDs de afirmaciones inline después de la oración
- El sistema los convertirá automáticamente en citas inline mostrando el texto original del anuncio
- Formato de ejemplo: "El anuncio menciona que la propiedad está en buen estado [F1-38, F1-39]"
- El sistema convierte [F1-38, F1-39] a: "El anuncio menciona que la propiedad está 'en buen estado'"
- Usa citas inline naturales: "El agente dice...", "El anuncio menciona...", "Parece que...", "Aparece que..."
- Solo usa blockquotes (colocando citas en líneas separadas) para frases distintivas con impacto emocional o énfasis
- NO añadas traducciones - las citas muestran solo el texto original del anuncio
- Manténlo suave, claro y conciso`}
=== FIN PAUTAS DE CITACIÓN DE AFIRMACIONES ===\n`
      : '';

    // Split system prompt from user content
    const fullSystemInstruction = `${system}\n\n${STRATEGIC_COMMUNICATION_FRAMEWORK}\n\n${linksStr}${claimCitationInstructions}`;
    const userPrompt = `${contextStr}=== CONVERSATION ===\n${history}\n\nAssistant:`;

    // Initialize Vertex AI for streaming
    const GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

    if (!GOOGLE_CLOUD_PROJECT_ID) {
      return NextResponse.json({ success: false, error: 'GOOGLE_CLOUD_PROJECT_ID not configured' }, { status: 500 });
    }

    // Create a streaming response using Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          const vertexAI = new VertexAI({
            project: GOOGLE_CLOUD_PROJECT_ID,
            location: GOOGLE_CLOUD_LOCATION,
          });

          const model = vertexAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
              temperature: 0.2,
              topP: 0.6,
              topK: 20,
              maxOutputTokens: 5000,
              candidateCount: 1,
              // CORRECTED: Use thinkingConfig (not includeThinking)
              // This is the correct parameter for your SDK version/API endpoint
              thinkingConfig: {
                thinkingBudget: -1,
                includeThoughts: true,
              } as any,
            } as any,
            systemInstruction: {
              role: 'system',
              parts: [{ text: fullSystemInstruction }],
            },
            tools: [
              {
                googleSearch: {},
              } as any,
            ],
          });

          // Use generateContentStream to get real-time thinking updates (like Vertex AI Studio)
          // This gives us incremental thinking as it's generated, not all at once
          let accumulatedText = '';
          let lastSentThinking = '';
          let accumulatedThinkingChunks: string[] = []; // Track all thinking chunks with full content
          
          // Helper function to stream text in smaller word-by-word increments
          const streamInSmallerChunks = async (text: string, chunkSize: number = 3, delayMs: number = 50): Promise<void> => {
            // Split text by words while preserving spaces
            const words = text.match(/\S+\s*/g) || [];
            if (words.length === 0) {
              // No words found, send as-is if it's just whitespace or special chars
              if (text.trim().length === 0) return;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: text })}\n\n`));
              return;
            }
            
            // Send words in batches for smoother streaming
            for (let i = 0; i < words.length; i += chunkSize) {
              const batch = words.slice(i, i + chunkSize).join('');
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: batch })}\n\n`));
              
              // Delay between batches for smoother, slower visual effect (only if not last batch)
              if (i + chunkSize < words.length) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
              }
            }
          };
          
          try {
            const streamResult = await model.generateContentStream({
              contents: [
                {
                  role: 'user',
                  parts: [{ text: userPrompt }]
                }
              ]
            });
            console.log('✅ Started streaming from Gemini with thinking enabled');
            
            // Process stream incrementally - much simpler and more robust
            for await (const item of streamResult.stream) {
              const itemAny = item as any;
              
              // Log the structure to understand what we're receiving
              console.log('📦 Stream item keys:', Object.keys(itemAny || {}));
              if (itemAny.thinking) {
                console.log('💭 Found thinking property:', typeof itemAny.thinking, itemAny.thinking);
              }
              if (itemAny.candidates) {
                console.log('📝 Found candidates:', itemAny.candidates.length);
              }
              
              // 1. Check for CONTENT data first (this is where thinking chunks with paragraphs come from)
              // The text is in item.candidates[0].content.parts[0].text
              const chunkText = itemAny.candidates?.[0]?.content?.parts?.[0]?.text;
              if (chunkText) {
                // Detect if this chunk is a thinking header with paragraph
                // Thinking chunks have pattern: **Header with "ing" verb** followed by explanation paragraph
                // Examples: "**Verifying Financials Required**\n\nI'm now focusing on..."
                // We want to capture: the header AND the paragraph that follows it
                const thinkingHeaderMatch = chunkText.match(/^\*\*([^*]*ing[^*]*)\*\*(\n\n|\n)?([\s\S]+)?/);
                const hasThinkingHeader = thinkingHeaderMatch !== null;
                
                if (hasThinkingHeader && accumulatedText.length === 0) {
                  // This is a thinking chunk - extract header and paragraph
                  const headerText = thinkingHeaderMatch[1]; // The text inside the **
                  const paragraphText = thinkingHeaderMatch[3] || ''; // The paragraph after the header
                  
                  // Format: Header as bold markdown, paragraph below (if exists)
                  const thinkingChunk = paragraphText.trim() 
                    ? `**${headerText}**\n\n${paragraphText.trim()}` 
                    : `**${headerText}**`;
                  
                  // Track this chunk (avoid duplicates)
                  if (!accumulatedThinkingChunks.includes(thinkingChunk)) {
                    accumulatedThinkingChunks.push(thinkingChunk);
                    
                    // Send all accumulated thinking chunks, properly formatted
                    const newThinking = accumulatedThinkingChunks.join('\n\n');
                    if (newThinking !== lastSentThinking) {
                      lastSentThinking = newThinking;
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ thinking: newThinking })}\n\n`));
                      console.log(`💭 Sent thinking chunk: "${headerText}"${paragraphText.trim() ? ` + paragraph (${paragraphText.trim().substring(0, 50)}...)` : ''}`);
                    }
                  }
                } else {
                  // Regular response text - we've moved past thinking phase
                  if (accumulatedText.length === 0 && lastSentThinking && !hasThinkingHeader) {
                    console.log('🔄 Transitioning from thinking to response content');
                  }
                  accumulatedText += chunkText;
                  // Stream the text content to the client in smaller word-by-word increments
                  // Using 3 words per batch with 50ms delay for smoother, slower streaming
                  await streamInSmallerChunks(chunkText, 3, 50);
                }
              }
              
              // 2. Check for THINKING data from itemAny.thinking (fallback - headers only)
              // Only use this if we haven't gotten thinking from chunkText
              if (itemAny.thinking && accumulatedThinkingChunks.length === 0) {
                // NOTE: The thinking payload might be in `item.thinking.code` or just `item.thinking`
                // It's safer to check both
                const thinkingText = itemAny.thinking.code || (typeof itemAny.thinking === 'string' ? itemAny.thinking : '');
                if (thinkingText && thinkingText.trim()) {
                  // Format plain headers as markdown bold
                  const formattedHeaders = thinkingText.split('\n')
                    .map((line: string) => line.trim())
                    .filter((line: string) => line.length > 0)
                    .map((header: string) => `**${header}**`)
                    .join('\n\n');
                  
                  if (formattedHeaders !== lastSentThinking) {
                    lastSentThinking = formattedHeaders;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ thinking: formattedHeaders })}\n\n`));
                    console.log(`💭 Sent thinking headers (from itemAny.thinking, length: ${formattedHeaders.length})`);
                  }
                }
              }
            }
            
            // The stream is finished
            console.log('✅ Stream completed');
            console.log(`📝 Final text length: ${accumulatedText.length}`);
          } catch (error: any) {
            console.error('❌ Error generating content:', error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message || 'Failed to generate response' })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
            controller.close();
            return;
          }

          // Post-process: Replace claim ID citations with inline quotes (or blockquotes for distinctive text) in accumulated text
          // This replaces any citations that appeared during streaming with proper quotes
          if (accumulatedText && Object.keys(claimIdToSourceMap).length > 0) {
            accumulatedText = replaceClaimIdsWithQuotes(accumulatedText, claimIdToSourceMap);
          }
          
          console.log(`📝 Final streamed text length: ${accumulatedText.length}, thinking updates sent`);

          // Note: Grounding citations are extracted but not used for URL replacement
          // We only trust URLs from our curated search results

          // After response is complete, decide on CTA using Gemini 2.5 Flash Lite
          try {
            console.log('🔍 Analyzing response for CTA decision...');
            
            // Get listing data for CTA decision
            const { data: listingData } = await supabase
              .from('listings')
              .select('*')
              .eq('id', listingIdInt)
              .single();
            
            const ctaDecision = await decideCTA(accumulatedText, messages, listingData, hasShownAnyTier, hasShownBlockquote);
            
            if (ctaDecision && ctaDecision.type !== 'none') {
              console.log('✅ CTA decision:', ctaDecision);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ cta: ctaDecision })}\n\n`));
            } else {
              console.log('ℹ️ No CTA recommended');
            }
          } catch (ctaError) {
            console.error('⚠️ CTA decision failed:', ctaError);
            // Don't fail the whole response if CTA decision fails
          }

          // Signal that the stream is done
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, final_text: accumulatedText })}\n\n`));
          controller.close();
        } catch (error: any) {
          console.error('Streaming error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error?.message || 'Streaming failed' })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (e: any) {
    console.error('Chat API error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'unknown_error' }, { status: 500 });
  }
}
