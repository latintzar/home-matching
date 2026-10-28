/**
 * Recommender Search API
 * 
 * POST - Search for listings matching a life profile
 * 
 * This is the main entry point for the Recommender system.
 * It generates a sweet spot, filters listings, runs WPA, and scores results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { filterListingsForProfile, FilterResult, filterListings, FilterOptions } from '@/lib/recommender/harvestFilter';
import { getWPAForListings } from '@/lib/recommender/wpaShortlist';
import { scoreAndRankListings, ScoredListing } from '@/lib/recommender/fitScoring';
import { LifeProfile } from '@/types/recommender';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Fallback: Get listings from Supabase when DynamoDB is empty
 */
async function getSupabaseListings(profile: LifeProfile, limit: number) {
  console.log('[RecommenderSearch] Fetching from Supabase...');
  
  let query = supabase
    .from('listings')
    .select('*, listing_photos(url)')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  // Apply filters
  if (profile.constraints.maxBudget) {
    query = query.lte('price_eur', profile.constraints.maxBudget);
  }
  if (profile.propertyPreferences.minBedrooms) {
    query = query.gte('bedrooms', profile.propertyPreferences.minBedrooms);
  }
  if (profile.propertyPreferences.minSqm) {
    query = query.gte('sqm', profile.propertyPreferences.minSqm);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('[RecommenderSearch] Supabase error:', error);
    return [];
  }
  
  // Transform to FilteredListing format
  return (data || []).map((listing: any) => ({
    domain: listing.source_url ? new URL(listing.source_url).hostname : 'unknown',
    listing_id: listing.id.toString(),
    url: listing.source_url,
    title: listing.title,
    price: listing.price_eur,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    sqm: listing.sqm,
    city: listing.city,
    region: listing.region,
    address: listing.address,
    image_urls: listing.listing_photos?.map((p: any) => p.url) || [],
    lat: listing.lat,
    lng: listing.lng,
    status: 'active',
    first_seen: listing.created_at,
    last_seen: listing.updated_at,
  }));
}

/**
 * POST /api/recommender/search
 * 
 * Body:
 * - profileId: string - ID of saved profile
 * OR
 * - profile: LifeProfile - Direct profile object
 * 
 * Query params:
 * - limit: number - Max results (default 50)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId, profile: directProfile } = body;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    console.log('[RecommenderSearch] Starting search', { profileId, hasDirectProfile: !!directProfile });

    let profile: LifeProfile;

    // Get profile from ID or use direct profile
    if (profileId) {
      const { data, error } = await supabase
        .from('user_lifestyle_profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { success: false, error: 'Profile not found' },
          { status: 404 }
        );
      }

      // Transform database row to LifeProfile
      profile = transformRowToProfile(data);
    } else if (directProfile) {
      profile = directProfile;
    } else {
      return NextResponse.json(
        { success: false, error: 'Either profileId or profile is required' },
        { status: 400 }
      );
    }

    // Get query params
    const runWpa = searchParams.get('wpa') !== 'false'; // Default: run WPA
    const shortlistSize = parseInt(searchParams.get('shortlist') || '20');

    // Run the filter
    console.log('[RecommenderSearch] Running filter...');
    const result = await filterListingsForProfile(profile);
    
    // If no listings from DynamoDB, try Supabase fallback
    let listings = result.listings;
    if (listings.length === 0) {
      console.log('[RecommenderSearch] No DynamoDB results, trying Supabase fallback...');
      const supabaseListings = await getSupabaseListings(profile, limit);
      listings = supabaseListings;
    }

    // Take shortlist for WPA (expensive operation)
    const shortlist = listings.slice(0, shortlistSize);
    console.log(`[RecommenderSearch] Shortlist: ${shortlist.length} listings`);

    let scoredListings: ScoredListing[] = [];
    
    if (runWpa && shortlist.length > 0) {
      // Run WPA on shortlist
      console.log('[RecommenderSearch] Running WPA on shortlist...');
      const wpaResults = await getWPAForListings(shortlist);
      
      // Score and rank
      console.log('[RecommenderSearch] Scoring listings...');
      scoredListings = scoreAndRankListings(wpaResults, profile);
    } else {
      // Skip WPA, just return basic scores
      scoredListings = shortlist.map(listing => ({
        listing,
        wpa: null,
        fitScore: 50, // Neutral score without WPA
        breakdown: {
          naturalLight: 50, noise: 50, space: 50, outdoorSpace: 50,
          condition: 50, layout: 50, location: 50, commute: 50,
        },
        topReasons: [],
        concerns: [],
        explanation: 'Sin análisis WPA disponible',
      }));
    }

    // Format response
    return NextResponse.json({
      success: true,
      data: {
        listings: scoredListings.slice(0, limit),
        total: result.total || listings.length,
        sweetSpot: result.sweetSpot,
        filters: result.filters,
        wpaEnabled: runWpa,
      },
      meta: {
        profileId,
        limit,
        shortlistSize,
        wpaRun: runWpa,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error: any) {
    console.error('[RecommenderSearch] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Search failed' },
      { status: 500 }
    );
  }
}

/**
 * Transform database row to LifeProfile
 */
function transformRowToProfile(row: any): LifeProfile {
  return {
    id: row.id,
    userId: row.user_id,
    household: {
      adults: row.adults || 1,
      children: row.children || [],
      pets: row.pets || [],
      workSituation: row.work_situation || 'hybrid',
    },
    lifestyle: {
      morningRoutine: row.morning_routine || '',
      eveningRoutine: row.evening_routine || '',
      weekendActivities: row.weekend_activities || [],
      dealbreakers: row.dealbreakers || [],
      mustHaves: row.must_haves || [],
    },
    constraints: {
      maxBudget: row.max_budget || 400000,
      maxCommuteMinutes: row.max_commute_minutes || 30,
      commuteDestination: row.commute_destination || '',
      moveInDate: row.move_in_date,
      renovationAppetite: row.renovation_appetite || 'cosmetic',
    },
    tradeoffs: {
      spaceVsLocation: row.tradeoff_space_vs_location || 0,
      newVsCharacter: row.tradeoff_new_vs_character || 0,
      quietVsVibrant: row.tradeoff_quiet_vs_vibrant || 0,
      viewsVsPrivacy: row.tradeoff_views_vs_privacy || 0,
    },
    propertyPreferences: {
      propertyTypes: row.property_types || ['piso'],
      minBedrooms: row.min_bedrooms || 2,
      minBathrooms: row.min_bathrooms || 1,
      minSqm: row.min_sqm || 60,
      preferredLocations: row.preferred_locations || [],
      avoidLocations: row.avoid_locations || [],
    },
    intakeCompleted: row.intake_completed || false,
    intakeStep: row.intake_step || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * GET /api/recommender/search/test
 * 
 * Test endpoint to verify the search is working
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Recommender Search API is ready',
    endpoints: {
      search: 'POST /api/recommender/search with { profileId } or { profile }',
    },
  });
}

