/**
 * Recommender Orchestrator
 * 
 * Ties together all Recommender phases:
 * R1: Life Profile (from intake)
 * R2: Sweet Spot Generation (geographic candidates)
 * R3: Harvest Filter (DynamoDB query)
 * R4: WPA on Shortlist (Gemini analysis)
 * R5: Fit Scoring (ranking)
 * 
 * Usage:
 *   const recommendations = await runRecommender(profileId);
 */

import { LifeProfile } from '@/types/recommender';
import { generateSweetSpot } from './sweetSpot';
import { filterListingsForProfile, FilteredListing } from './harvestFilter';
import { getWPAForListings, WPAResult } from './wpaShortlist';
import { scoreAndRankListings, ScoredListing } from './fitScoring';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

// ============================================================================
// Types
// ============================================================================

export interface RecommenderResult {
  success: boolean;
  
  // Results
  recommendations: ScoredListing[];
  totalFound: number;
  totalAnalyzed: number;
  
  // Timing
  timing: {
    total: number;
    sweetSpot: number;
    filter: number;
    wpa: number;
    scoring: number;
  };
  
  // Debug info
  debug?: {
    sweetSpotLocations: string[];
    filtersApplied: any;
    cacheHits: number;
    wpaRun: number;
  };
}

export interface RecommenderOptions {
  maxResults?: number;         // Max recommendations to return (default: 20)
  maxWPA?: number;             // Max listings to run WPA on (default: 10, hard cap: 15)
  skipWPA?: boolean;           // Skip WPA for faster results
  includeDebug?: boolean;      // Include debug info
}

// ============================================================================
// Profile Loading
// ============================================================================

let docClient: DynamoDBDocumentClient | null = null;

function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: process.env.AWS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      } : undefined,
    });
    docClient = DynamoDBDocumentClient.from(client);
  }
  return docClient;
}

/**
 * Load user profile from DynamoDB or Supabase
 */
async function loadProfile(profileId: string): Promise<LifeProfile | null> {
  // Try DynamoDB first (for new profiles)
  try {
    const client = getDocClient();
    const result = await client.send(new GetCommand({
      TableName: 'leo-geo-intelligence',
      Key: { profile_id: profileId },
    }));
    
    if (result.Item?.life_profile) {
      return result.Item.life_profile as LifeProfile;
    }
  } catch (error) {
    console.log('[Recommender] DynamoDB profile not found, checking Supabase');
  }
  
  // Try Supabase (for existing profiles)
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/user_lifestyle_profiles?user_id=eq.${profileId}&select=life_profile`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data[0]?.life_profile) {
          return data[0].life_profile as LifeProfile;
        }
      }
    }
  } catch (error) {
    console.log('[Recommender] Supabase profile load error:', error);
  }
  
  return null;
}

// ============================================================================
// Main Orchestrator
// ============================================================================

/**
 * Run the full Recommender pipeline
 */
export async function runRecommender(
  profileOrId: LifeProfile | string,
  options: RecommenderOptions = {}
): Promise<RecommenderResult> {
  const {
    maxResults = 20,
    maxWPA = 10,  // COST CONTROL: Max 10 WPA calls (~€1.50)
    skipWPA = false,
    includeDebug = false,
  } = options;
  
  const timing = {
    total: 0,
    sweetSpot: 0,
    filter: 0,
    wpa: 0,
    scoring: 0,
  };
  
  const startTotal = Date.now();
  
  console.log('[Recommender] Starting pipeline');
  
  // Load profile if ID provided
  let profile: LifeProfile;
  if (typeof profileOrId === 'string') {
    const loaded = await loadProfile(profileOrId);
    if (!loaded) {
      return {
        success: false,
        recommendations: [],
        totalFound: 0,
        totalAnalyzed: 0,
        timing,
      };
    }
    profile = loaded;
  } else {
    profile = profileOrId;
  }
  
  // =========================================================================
  // R2: Sweet Spot Generation
  // =========================================================================
  const startSweetSpot = Date.now();
  console.log('[Recommender] R2: Generating sweet spot...');
  
  const sweetSpot = await generateSweetSpot(profile);
  timing.sweetSpot = Date.now() - startSweetSpot;
  
  const sweetSpotLocations = [
    ...sweetSpot.primary.map(l => l.name),
    ...sweetSpot.secondary.map(l => l.name),
  ];
  
  console.log(`[Recommender] Sweet spot: ${sweetSpotLocations.slice(0, 5).join(', ')}`);
  
  // =========================================================================
  // R3: Filter DynamoDB Listings
  // =========================================================================
  const startFilter = Date.now();
  console.log('[Recommender] R3: Filtering listings...');
  
  const filterResult = await filterListingsForProfile(profile);
  timing.filter = Date.now() - startFilter;
  
  console.log(`[Recommender] Found ${filterResult.total} matching listings`);
  
  if (filterResult.total === 0) {
    timing.total = Date.now() - startTotal;
    return {
      success: true,
      recommendations: [],
      totalFound: 0,
      totalAnalyzed: 0,
      timing,
      debug: includeDebug ? {
        sweetSpotLocations,
        filtersApplied: filterResult.filters,
        cacheHits: 0,
        wpaRun: 0,
      } : undefined,
    };
  }
  
  // =========================================================================
  // R4: WPA on Shortlist (COST CONTROLLED)
  // =========================================================================
  let wpaResults: WPAResult[] = [];
  let cacheHits = 0;
  let wpaRun = 0;
  
  // Sort by value (price per m²) - best value first for WPA
  const sortedByValue = [...filterResult.listings].sort((a, b) => {
    const valueA = a.sqm > 0 ? a.price / a.sqm : Infinity;
    const valueB = b.sqm > 0 ? b.price / b.sqm : Infinity;
    return valueA - valueB;
  });
  
  // Take only top N for WPA (default 10, max 15 to control costs)
  const effectiveMaxWPA = Math.min(maxWPA, 15);
  const shortlist = sortedByValue.slice(0, effectiveMaxWPA);
  
  console.log(`[Recommender] WPA shortlist: ${shortlist.length} listings (sorted by €/m²)`);
  
  if (!skipWPA && shortlist.length > 0) {
    const startWPA = Date.now();
    console.log(`[Recommender] R4: Running WPA on ${shortlist.length} listings...`);
    
    wpaResults = await getWPAForListings(shortlist);
    timing.wpa = Date.now() - startWPA;
    
    cacheHits = wpaResults.filter(r => r.wpa !== null).length;
    wpaRun = shortlist.length - cacheHits;
    
    console.log(`[Recommender] WPA complete: ${cacheHits} cached, ${wpaRun} analyzed`);
  } else {
    // Create results without WPA
    wpaResults = shortlist.map(listing => ({ listing, wpa: null }));
  }
  
  // =========================================================================
  // R5: Fit Scoring
  // =========================================================================
  const startScoring = Date.now();
  console.log('[Recommender] R5: Scoring and ranking...');
  
  const listingsWithWPA = wpaResults.map(r => ({
    listing: r.listing,
    wpa: r.wpa,
  }));
  
  const scored = scoreAndRankListings(listingsWithWPA, profile);
  timing.scoring = Date.now() - startScoring;
  
  // Take top results
  const recommendations = scored.slice(0, maxResults);
  
  timing.total = Date.now() - startTotal;
  
  console.log(`[Recommender] Complete in ${timing.total}ms`);
  console.log(`[Recommender] Top scores: ${recommendations.slice(0, 5).map(r => r.fitScore).join(', ')}`);
  
  return {
    success: true,
    recommendations,
    totalFound: filterResult.total,
    totalAnalyzed: shortlist.length,
    timing,
    debug: includeDebug ? {
      sweetSpotLocations,
      filtersApplied: filterResult.filters,
      cacheHits,
      wpaRun,
    } : undefined,
  };
}

/**
 * Quick search without WPA (faster for browsing)
 */
export async function quickSearch(
  profile: LifeProfile,
  limit: number = 50
): Promise<ScoredListing[]> {
  const result = await runRecommender(profile, {
    maxResults: limit,
    skipWPA: true,
  });
  
  return result.recommendations;
}

/**
 * Deep analysis with WPA (for shortlist)
 */
export async function deepAnalysis(
  profile: LifeProfile,
  listings: FilteredListing[]
): Promise<ScoredListing[]> {
  console.log(`[Recommender] Deep analysis on ${listings.length} listings`);
  
  // Run WPA
  const wpaResults = await getWPAForListings(listings);
  
  // Score
  const listingsWithWPA = wpaResults.map(r => ({
    listing: r.listing,
    wpa: r.wpa,
  }));
  
  return scoreAndRankListings(listingsWithWPA, profile);
}

// ============================================================================
// Export
// ============================================================================

export { generateSweetSpot } from './sweetSpot';
export { filterListingsForProfile, filterListings } from './harvestFilter';
export { runWPA, getWPAForListings } from './wpaShortlist';
export { scoreListing, scoreAndRankListings } from './fitScoring';

