/**
 * Vibe Check API
 * 
 * Called by ElevenLabs show_property tool to:
 * 1. Get top property recommendations for user
 * 2. Run instant WPA on each
 * 3. Push carousel data to frontend via Supabase Realtime
 * 4. Return quick summary for Leo to verbalize
 * 
 * Response time target: <5 seconds (instant WPA on 3-5 properties)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { quickSearchV2 } from '@/lib/recommender/orchestratorV2';
import { LifeProfile } from '@/types/recommender';

// ============================================================================
// Types
// ============================================================================

interface VibeCheckRequest {
  userId: string;
  transcriptContext?: string;   // Recent conversation for context
  specificRequest?: string;     // "more light", "bigger kitchen", etc.
  count?: number;               // Properties to show (1-5)
}

interface PropertyForCarousel {
  listing_id: string;
  url: string;
  title: string;
  price: number;
  sqm: number;
  bedrooms: number;
  city: string;
  neighborhood: string;
  image_urls: string[];
  
  // Quick WPA summary for verbalization
  quickScore: number;
  standouts: string[];
  concerns: string[];
  
  // Fit context
  fitScore: number;
  whyItWorks: string;
}

interface VibeCheckResponse {
  success: boolean;
  properties: PropertyForCarousel[];
  verbalSummary: string;       // What Leo should say
  sessionId: string;           // For tracking feedback
}

// ============================================================================
// Supabase Client
// ============================================================================

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

// ============================================================================
// Profile Loading
// ============================================================================

async function loadUserProfile(userId: string): Promise<LifeProfile | null> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('user_lifestyle_profiles')
    .select('life_profile')
    .eq('user_id', userId)
    .single();
  
  if (error || !data?.life_profile) {
    console.log(`[VibeCheck] No profile found for user ${userId}`);
    return null;
  }
  
  return data.life_profile as LifeProfile;
}

// ============================================================================
// Instant WPA
// ============================================================================

async function runInstantWPA(
  listingId: string,
  photos: string[],
  listingInfo: any
): Promise<{ quickScore: number; standouts: string[]; concerns: string[] } | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000'}/api/wpa/instant`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: listingId,
          photos: photos.slice(0, 5), // Max 5 for instant
          listing_info: listingInfo,
        }),
      }
    );
    
    if (!response.ok) {
      console.error(`[VibeCheck] Instant WPA failed for ${listingId}`);
      return null;
    }
    
    const result = await response.json();
    return {
      quickScore: result.quickScore || 70,
      standouts: result.standouts || [],
      concerns: result.concerns || [],
    };
  } catch (error) {
    console.error(`[VibeCheck] Instant WPA error for ${listingId}:`, error);
    return null;
  }
}

// ============================================================================
// Generate Verbal Summary
// ============================================================================

function generateVerbalSummary(properties: PropertyForCarousel[]): string {
  if (properties.length === 0) {
    return "Hmm, I couldn't find any properties matching your criteria right now. Let's refine your preferences a bit.";
  }
  
  if (properties.length === 1) {
    const p = properties[0];
    return `I've pulled up a ${p.sqm}m² place in ${p.neighborhood} at ${p.price.toLocaleString()}€. ${p.standouts[0] || 'Take a look and tell me what you think.'}`;
  }
  
  // Multiple properties
  const priceRange = {
    min: Math.min(...properties.map(p => p.price)),
    max: Math.max(...properties.map(p => p.price)),
  };
  
  const neighborhoods = [...new Set(properties.map(p => p.neighborhood))].slice(0, 2);
  
  let summary = `I've put ${properties.length} places on your screen`;
  
  if (priceRange.min !== priceRange.max) {
    summary += `, ranging from ${priceRange.min.toLocaleString()}€ to ${priceRange.max.toLocaleString()}€`;
  }
  
  if (neighborhoods.length === 1) {
    summary += ` in ${neighborhoods[0]}`;
  } else if (neighborhoods.length > 1) {
    summary += ` in ${neighborhoods.join(' and ')}`;
  }
  
  summary += '. Take a look and tell me which ones catch your eye, or what feels off about any of them.';
  
  return summary;
}

// ============================================================================
// Push to Frontend (Realtime)
// ============================================================================

async function pushToFrontend(
  userId: string,
  sessionId: string,
  properties: PropertyForCarousel[]
): Promise<void> {
  const supabase = getSupabase();
  
  // Insert carousel session for frontend to pick up
  await supabase.from('vibe_check_sessions').insert({
    id: sessionId,
    user_id: userId,
    properties,
    status: 'active',
    created_at: new Date().toISOString(),
  });
  
  // Also broadcast via Realtime
  await supabase.channel(`vibe-check:${userId}`).send({
    type: 'broadcast',
    event: 'show_carousel',
    payload: {
      sessionId,
      properties,
    },
  });
  
  console.log(`[VibeCheck] Pushed ${properties.length} properties to user ${userId}`);
}

// ============================================================================
// Main Handler
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: VibeCheckRequest = await request.json();
    const { userId, transcriptContext, specificRequest, count = 3 } = body;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }
    
    console.log(`[VibeCheck] Request for user ${userId}: ${count} properties`);
    if (specificRequest) {
      console.log(`[VibeCheck] Specific request: ${specificRequest}`);
    }
    
    // Load user profile
    const profile = await loadUserProfile(userId);
    if (!profile) {
      return NextResponse.json({
        success: false,
        properties: [],
        verbalSummary: "I don't have your preferences saved yet. Let's go through what you're looking for first.",
        sessionId: '',
      } as VibeCheckResponse);
    }
    
    // Get top recommendations (quick mode, no full WPA)
    const recommendations = await quickSearchV2(profile, count * 2); // Get 2x to have buffer
    
    if (recommendations.length === 0) {
      return NextResponse.json({
        success: false,
        properties: [],
        verbalSummary: "I couldn't find any properties matching your criteria. Would you consider expanding your search area or budget?",
        sessionId: '',
      } as VibeCheckResponse);
    }
    
    // Run instant WPA on top candidates (parallel)
    const propertiesToShow = recommendations.slice(0, Math.min(count, 5));
    
    const propertiesWithWPA = await Promise.all(
      propertiesToShow.map(async (rec) => {
        const listing = rec.listing;
        
        // Run instant WPA
        const wpa = await runInstantWPA(
          listing.listing_id,
          listing.image_urls || [],
          {
            price: listing.price,
            sqm: listing.sqm,
            bedrooms: listing.bedrooms,
            city: listing.city,
          }
        );
        
        return {
          listing_id: listing.listing_id,
          url: listing.url,
          title: listing.title,
          price: listing.price,
          sqm: listing.sqm,
          bedrooms: listing.bedrooms,
          city: listing.city,
          neighborhood: listing.region || listing.city,
          image_urls: listing.image_urls || [],
          
          quickScore: wpa?.quickScore || rec.fitResult.score,
          standouts: wpa?.standouts || rec.fitResult.topMatches,
          concerns: wpa?.concerns || rec.fitResult.concerns,
          
          fitScore: rec.fitResult.score,
          whyItWorks: rec.explanation || rec.fitResult.reason,
        } as PropertyForCarousel;
      })
    );
    
    // Generate session ID
    const sessionId = `vibe_${userId}_${Date.now()}`;
    
    // Push to frontend via Realtime
    await pushToFrontend(userId, sessionId, propertiesWithWPA);
    
    // Generate verbal summary for Leo
    const verbalSummary = generateVerbalSummary(propertiesWithWPA);
    
    const duration = Date.now() - startTime;
    console.log(`[VibeCheck] Complete in ${duration}ms: ${propertiesWithWPA.length} properties`);
    
    return NextResponse.json({
      success: true,
      properties: propertiesWithWPA,
      verbalSummary,
      sessionId,
    } as VibeCheckResponse);
    
  } catch (error: any) {
    console.error('[VibeCheck] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Internal server error',
        properties: [],
        verbalSummary: "Something went wrong on my end. Let's continue chatting and I'll try again in a moment.",
        sessionId: '',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Feedback Endpoint (for carousel interactions)
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, listingId, reaction, comment } = body;
    
    if (!sessionId || !listingId) {
      return NextResponse.json(
        { error: 'sessionId and listingId are required' },
        { status: 400 }
      );
    }
    
    const supabase = getSupabase();
    
    // Store feedback
    await supabase.from('vibe_check_feedback').insert({
      session_id: sessionId,
      listing_id: listingId,
      reaction, // 'like', 'dislike', 'curious'
      comment,  // Optional free-text
      created_at: new Date().toISOString(),
    });
    
    // Update session with feedback
    await supabase
      .from('vibe_check_sessions')
      .update({
        has_feedback: true,
        last_feedback_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
    
    console.log(`[VibeCheck] Feedback for ${listingId}: ${reaction}`);
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('[VibeCheck] Feedback error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

