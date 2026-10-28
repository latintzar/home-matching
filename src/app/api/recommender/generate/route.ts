import {rowToProfile} from '@/lib/recommender/profileStorage';
/**
 * Recommender Generate API
 * 
 * Runs the full Recommender pipeline and returns personalized property matches.
 * 
 * POST /api/recommender/generate
 * Body: { profileId: string } OR { profile: LifeProfile }
 * 
 * Options (query params OR body):
 * - maxResults: number (default: 20)
 * - maxWPA: number (default: 10, hard cap: 15) - COST CONTROLLED
 * - skipWPA: boolean (default: false)
 * - debug: boolean (default: false)
 * 
 * Cost estimate per run: ~€1.50 (10 WPA × ~€0.15 each)
 */

import { NextRequest, NextResponse } from 'next/server';
import type {RecommenderOptions} from '@/lib/recommender/orchestrator';
import {sampleMode,sampleServerClient} from '@/lib/sample/server';
import {sampleRecommendations} from '@/lib/sample/recommend';
import { LifeProfile } from '@/types/recommender';

// Hard cap on WPA to prevent cost overruns
const MAX_WPA_HARD_CAP = 15;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId, profile, maxResults, maxWPA, skipWPA } = body;
    
    if (!profileId && !profile) {
      return NextResponse.json(
        { error: 'Must provide profileId or profile' },
        { status: 400 }
      );
    }
    
    if(sampleMode()) {
      const {data:row}=await sampleServerClient().from('user_lifestyle_profiles').select('*').eq('id',profileId).single();
      if(!row)return NextResponse.json({error:'Choose your sample profile.'},{status:404});
      const stored=rowToProfile(row);
      return NextResponse.json(sampleRecommendations(stored,maxResults));
    }

    // Parse options from body or query params (body takes precedence)
    const searchParams = request.nextUrl.searchParams;
    const requestedMaxWPA = maxWPA ?? parseInt(searchParams.get('maxWPA') || '10');
    
    const options: RecommenderOptions = {
      maxResults: maxResults ?? parseInt(searchParams.get('maxResults') || '20'),
      maxWPA: Math.min(requestedMaxWPA, MAX_WPA_HARD_CAP), // HARD CAP
      skipWPA: skipWPA ?? searchParams.get('skipWPA') === 'true',
      includeDebug: searchParams.get('debug') === 'true',
    };
    
    console.log('[API] Recommender generate:', { profileId, hasProfile: !!profile, options });
    
    // Run recommender
    const {runRecommender}=await import('@/lib/recommender/orchestrator');
    const result = await runRecommender(
      profile || profileId,
      options
    );
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to generate recommendations', details: 'Profile not found or invalid' },
        { status: 404 }
      );
    }
    
    // Transform results for API response
    const response = {
      success: true,
      recommendations: result.recommendations.map(r => ({
        listing_id: r.listing.listing_id,
        url: r.listing.url,
        title: r.listing.title,
        price: r.listing.price,
        sqm: r.listing.sqm,
        bedrooms: r.listing.bedrooms,
        bathrooms: r.listing.bathrooms,
        city: r.listing.city,
        address: r.listing.address,
        image_urls: r.listing.image_urls?.slice(0, 3),
        
        fitScore: r.fitScore,
        breakdown: r.breakdown,
        topReasons: r.topReasons,
        concerns: r.concerns,
        explanation: r.explanation,
        
        hasWPA: !!r.wpa,
      })),
      results: {listings:result.recommendations.map(item=>({...item,listing:item.listing})),total:result.totalFound,wpaEnabled:!options.skipWPA},
      stats: {
        totalFound: result.totalFound,
        totalAnalyzed: result.totalAnalyzed,
        returned: result.recommendations.length,
        timing: result.timing,
      },
      debug: result.debug,
    };
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('[API] Recommender error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    endpoint: '/api/recommender/generate',
    method: 'POST',
    description: 'Generate personalized property recommendations',
    body: {
      profileId: 'string (user ID to load profile)',
      profile: 'LifeProfile object (optional, if not using profileId)',
      maxResults: 'number (default: 20)',
      maxWPA: 'number (default: 10, hard cap: 15) - COST CONTROLLED',
      skipWPA: 'boolean (default: false)',
    },
    costEstimate: '~€1.50 per run (10 WPA calls)',
  });
}

