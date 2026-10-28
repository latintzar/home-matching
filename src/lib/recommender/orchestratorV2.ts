/**
 * Recommender Orchestrator V2
 * 
 * P0 Lean App Implementation
 * 
 * New flow:
 * 1. Pre-WPA Filter (FREE, algorithmic)
 * 2. Neighborhood Profile Lookup (H3 geo-matching, from cache)
 * 3. Full WPA (on shortlist only)
 * 4. Enhanced 55-dimension Fit Scoring
 * 5. Personalized Explanations (Flash-lite, cheap)
 * 
 * Cost-optimized:
 * - Pre-filter before expensive WPA
 * - Cache WPA results in DynamoDB
 * - Use Flash-lite for explanations
 * - Limit WPA calls to top candidates
 */

import { LifeProfile } from '@/types/recommender';
import { FilteredListing, filterListingsForProfile } from './harvestFilter';
import { calculateFitScore, calculatePreWpaFitScore, UserFitProfile, scoreAndRankListingsV2, FitResult } from './fitScoringV2';
import { WPAScores } from '@/app/api/wpa/score/route';
import { NeighborhoodProfile, flattenNeighborhoodScores, NeighborhoodScores } from '@/types/neighborhood';
import { getNeighborhoodProfile, getNeighborhoodProfileWithDefault, initializeNeighborhoodService } from './neighborhoodService';
import { getWpaCached, setWpaCached, generatePhotoHash, WpaMode } from '@/lib/wpa/cache';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

// ============================================================================
// Types
// ============================================================================

export interface RecommenderV2Result {
  success: boolean;
  
  // Results
  recommendations: V2ScoredListing[];
  totalFound: number;
  preFilterPassed: number;
  wpaProcessed: number;
  
  // Timing
  timing: {
    total: number;
    preFilter: number;
    neighborhood: number;
    wpa: number;
    scoring: number;
    explain: number;
  };
  
  // Cost tracking
  costs: {
    wpaDescribe: number;    // Vision API calls
    wpaScore: number;       // Text scoring calls
    explain: number;        // Personalized explanations
    total: number;
  };
  
  // Debug info
  debug?: {
    preFilterReasons: Record<string, string[]>;
    wpaFromCache: number;
    neighborhoodsFound: number;
  };
}

export interface V2ScoredListing {
  listing: FilteredListing;
  
  // Pre-WPA score (for context)
  preWpaScore: number;
  
  // Full fit result
  fitResult: FitResult;
  
  // WPA data (if available)
  wpa?: WPAScores;
  
  // Neighborhood
  neighborhood?: NeighborhoodProfile | null;
  
  // Personalized explanation (user-facing)
  explanation?: string;
  
  // Quick tags for UI
  tags: string[];
}

export interface RecommenderV2Options {
  maxResults?: number;        // Max recommendations (default: 20)
  maxWPA?: number;            // Max WPA calls (default: 10, cost control)
  preFilterThreshold?: number; // Min pre-WPA score to proceed (default: 40)
  skipWPA?: boolean;          // Skip WPA for faster results
  skipExplanations?: boolean; // Skip personalized explanations
  includeDebug?: boolean;
}

// ============================================================================
// DynamoDB Client
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

// ============================================================================
// Profile Loading
// ============================================================================

async function loadProfile(profileId: string): Promise<LifeProfile | null> {
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
    console.log('[RecommenderV2] Profile not found in DynamoDB:', error);
  }
  
  return null;
}

// ============================================================================
// Convert LifeProfile to UserFitProfile
// ============================================================================

import {convertToUserFitProfile} from './profileFit';

// ============================================================================
// WPA Runner
// ============================================================================

async function runWPAForListing(
  listing: FilteredListing,
  useCache: boolean = true
): Promise<WPAScores | null> {
  const listingId = listing.listing_id;
  const photoUrls = listing.image_urls || [];
  
  if (photoUrls.length === 0) {
    console.log(`[RecommenderV2] No photos for ${listingId}, skipping WPA`);
    return null;
  }
  
  const photoHash = generatePhotoHash(photoUrls);
  
  // Check cache first
  if (useCache) {
    const cached = await getWpaCached(listingId, 'scores', photoHash);
    if (cached) {
      console.log(`[RecommenderV2] WPA cache hit for ${listingId}`);
      return cached as WPAScores;
    }
  }
  
  // Run WPA pipeline
  console.log(`[RecommenderV2] Running WPA for ${listingId} (${photoUrls.length} photos)`);
  
  try {
    // Step 1: Describe
    const describeResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000'}/api/wpa/describe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingId,
        photos: photoUrls,
        listingInfo: {
          price: listing.price,
          sqm: listing.sqm,
          bedrooms: listing.bedrooms,
          city: listing.city,
          region: listing.region,
        },
      }),
    });
    
    if (!describeResponse.ok) {
      console.error(`[RecommenderV2] Describe failed for ${listingId}`);
      return null;
    }
    
    const { description } = await describeResponse.json();
    
    // Step 2: Score
    const scoreResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000'}/api/wpa/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingId,
        description,
      }),
    });
    
    if (!scoreResponse.ok) {
      console.error(`[RecommenderV2] Score failed for ${listingId}`);
      return null;
    }
    
    const { scores } = await scoreResponse.json();
    
    // Cache result
    await setWpaCached(listingId, 'scores', listing.city || 'unknown', photoHash, scores);
    
    return scores as WPAScores;
    
  } catch (error) {
    console.error(`[RecommenderV2] WPA error for ${listingId}:`, error);
    return null;
  }
}

// ============================================================================
// Explanation Generator
// ============================================================================

async function generateExplanation(
  listing: FilteredListing,
  wpa: WPAScores | undefined,
  neighborhood: NeighborhoodProfile | null,
  fitResult: FitResult,
  profile: LifeProfile
): Promise<string> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000'}/api/wpa/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wpa_descriptions: wpa?.standouts || [],
        wpa_scores: wpa?.scores || {},
        neighborhood: neighborhood ? flattenNeighborhoodScores(neighborhood) : null,
        listing: {
          price: listing.price,
          sqm: listing.sqm,
          bedrooms: listing.bedrooms,
          city: listing.city,
        },
        fit_score: fitResult.score,
        top_matches: fitResult.topMatches,
        concerns_for_user: fitResult.concerns,
        user_summary: `${profile.household.adults} adulto(s)${profile.household.children.length > 0 ? `, ${profile.household.children.length} niño(s)` : ''}`,
        user_priorities: Object.entries(profile.lifestyle.mustHaves).slice(0, 3),
      }),
    });
    
    if (!response.ok) {
      return '';
    }
    
    const { explanation } = await response.json();
    return explanation || '';
    
  } catch (error) {
    console.error('[RecommenderV2] Explanation error:', error);
    return '';
  }
}

// ============================================================================
// Main Orchestrator
// ============================================================================

export async function runRecommenderV2(
  profileOrId: LifeProfile | string,
  options: RecommenderV2Options = {}
): Promise<RecommenderV2Result> {
  const {
    maxResults = 20,
    maxWPA = 10,
    preFilterThreshold = 40,
    skipWPA = false,
    skipExplanations = false,
    includeDebug = false,
  } = options;
  
  const timing = {
    total: 0,
    preFilter: 0,
    neighborhood: 0,
    wpa: 0,
    scoring: 0,
    explain: 0,
  };
  
  const costs = {
    wpaDescribe: 0,
    wpaScore: 0,
    explain: 0,
    total: 0,
  };
  
  const startTotal = Date.now();
  console.log('[RecommenderV2] Starting pipeline');
  
  // Load profile
  let profile: LifeProfile;
  if (typeof profileOrId === 'string') {
    const loaded = await loadProfile(profileOrId);
    if (!loaded) {
      return {
        success: false,
        recommendations: [],
        totalFound: 0,
        preFilterPassed: 0,
        wpaProcessed: 0,
        timing,
        costs,
      };
    }
    profile = loaded;
  } else {
    profile = profileOrId;
  }
  
  const userFitProfile = convertToUserFitProfile(profile);
  
  // =========================================================================
  // STEP 1: Get candidate listings
  // =========================================================================
  console.log('[RecommenderV2] Filtering candidates...');
  const filterResult = await filterListingsForProfile(profile);
  
  if (filterResult.total === 0) {
    timing.total = Date.now() - startTotal;
    return {
      success: true,
      recommendations: [],
      totalFound: 0,
      preFilterPassed: 0,
      wpaProcessed: 0,
      timing,
      costs,
    };
  }
  
  console.log(`[RecommenderV2] Found ${filterResult.total} candidates`);
  
  // =========================================================================
  // STEP 2: Pre-WPA Filtering (FREE)
  // =========================================================================
  const startPreFilter = Date.now();
  console.log('[RecommenderV2] Running pre-WPA filter...');
  
  const preFilterConfig = {
    budget: {
      min: 0, // No minimum budget constraint typically
      max: profile.constraints.maxBudget,
    },
    preferredLocations: profile.propertyPreferences.preferredLocations,
    avoidLocations: profile.propertyPreferences.avoidLocations,
    minSqm: profile.propertyPreferences.minSqm,
    minBedrooms: profile.propertyPreferences.minBedrooms,
  };
  
  const preFilterResults = new Map<string, { score: number; reasons: string[] }>();
  
  for (const listing of filterResult.listings) {
    const listingBasics = {
      price: listing.price,
      sqm: listing.sqm,
      bedrooms: listing.bedrooms,
      city: listing.city,
      neighborhood: listing.region,
    };
    
    const result = calculatePreWpaFitScore(listingBasics, preFilterConfig);
    preFilterResults.set(listing.listing_id, result);
  }
  
  // Sort by pre-WPA score and filter
  const preFiltered = filterResult.listings
    .map(l => ({
      listing: l,
      preWpaScore: preFilterResults.get(l.listing_id)?.score || 0,
      reasons: preFilterResults.get(l.listing_id)?.reasons || [],
    }))
    .filter(l => l.preWpaScore >= preFilterThreshold)
    .sort((a, b) => b.preWpaScore - a.preWpaScore);
  
  timing.preFilter = Date.now() - startPreFilter;
  console.log(`[RecommenderV2] Pre-filter: ${preFiltered.length}/${filterResult.total} passed (threshold: ${preFilterThreshold})`);
  
  // =========================================================================
  // STEP 3: Neighborhood Lookup (From Cache)
  // =========================================================================
  const startNeighborhood = Date.now();
  console.log('[RecommenderV2] Looking up neighborhoods...');
  
  const neighborhoodCache = new Map<string, NeighborhoodProfile | null>();
  let neighborhoodsFound = 0;
  
  // Take only top candidates for neighborhood lookup
  const candidatesForLookup = preFiltered.slice(0, maxWPA * 2); // 2x to have buffer
  
  for (const { listing } of candidatesForLookup) {
    if (listing.lat && listing.lng) {
      const neighborhood = await getNeighborhoodProfile(listing.lat, listing.lng);
      neighborhoodCache.set(listing.listing_id, neighborhood);
      if (neighborhood) neighborhoodsFound++;
    }
  }
  
  timing.neighborhood = Date.now() - startNeighborhood;
  console.log(`[RecommenderV2] Found ${neighborhoodsFound}/${candidatesForLookup.length} neighborhoods`);
  
  // =========================================================================
  // STEP 4: WPA on Top Candidates
  // =========================================================================
  const startWPA = Date.now();
  const wpaCache = new Map<string, WPAScores | null>();
  let wpaFromCache = 0;
  let wpaProcessed = 0;
  
  if (!skipWPA) {
    console.log(`[RecommenderV2] Running WPA on top ${maxWPA} candidates...`);
    
    const topCandidates = preFiltered.slice(0, maxWPA);
    
    for (const { listing } of topCandidates) {
      const wpa = await runWPAForListing(listing, true);
      wpaCache.set(listing.listing_id, wpa);
      
      if (wpa) {
        // Track costs (approximate)
        const photoCount = listing.image_urls?.length || 0;
        if (photoCount > 0) {
          costs.wpaDescribe += 0.05 * (photoCount / 10); // ~$0.05 per 10 photos
          costs.wpaScore += 0.003; // ~$0.003 for text scoring
        }
        wpaProcessed++;
      }
    }
    
    // Check cache stats
    wpaFromCache = wpaProcessed; // Simplification - proper tracking would need cache service
  }
  
  timing.wpa = Date.now() - startWPA;
  console.log(`[RecommenderV2] WPA complete: ${wpaProcessed} processed`);
  
  // =========================================================================
  // STEP 5: Full Fit Scoring
  // =========================================================================
  const startScoring = Date.now();
  console.log('[RecommenderV2] Calculating fit scores...');
  
  const scoredListings: V2ScoredListing[] = [];
  
  for (const { listing, preWpaScore, reasons } of preFiltered.slice(0, maxResults * 2)) {
    const wpa = wpaCache.get(listing.listing_id) || undefined;
    const neighborhood = neighborhoodCache.get(listing.listing_id) || null;
    
    // Build listing basics for fit scoring
    const listingBasics = {
      price: listing.price,
      sqm: listing.sqm,
      bedrooms: listing.bedrooms,
      bathrooms: undefined as number | undefined,
      floor: undefined as number | undefined,
      has_elevator: undefined as boolean | undefined,
      city: listing.city,
      neighborhood: listing.region,
    };
    
    // Calculate fit score
    let fitResult: FitResult;
    
    if (wpa) {
      // Full scoring with WPA
      fitResult = calculateFitScore(
        wpa,
        userFitProfile,
        neighborhood ? { scores: flattenNeighborhoodScores(neighborhood) } : null,
        listingBasics
      );
    } else {
      // Fallback to pre-WPA score
      fitResult = {
        score: preWpaScore,
        pass: preWpaScore >= 50,
        reason: reasons.join('. '),
        breakdown: {},
        adjustments: 0,
        topMatches: [],
        concerns: [],
      };
    }
    
    // Generate tags for UI
    const tags: string[] = [];
    if (fitResult.score >= 80) tags.push('Top Match');
    if (wpa?.flags?.no_natural_light === false && wpa?.scores?.natural_light_intensity && wpa.scores.natural_light_intensity >= 80) tags.push('Muy Luminoso');
    if (wpa?.scores?.wfh_potential && wpa.scores.wfh_potential >= 80) tags.push('Ideal WFH');
    if (wpa?.scores?.outdoor_space_quality && wpa.scores.outdoor_space_quality >= 80) tags.push('Terraza');
    if (neighborhood && neighborhood.universal.safety >= 80) tags.push('Zona Segura');
    
    scoredListings.push({
      listing,
      preWpaScore,
      fitResult,
      wpa,
      neighborhood,
      tags,
    });
  }
  
  // Sort by fit score
  scoredListings.sort((a, b) => {
    if (a.fitResult.pass !== b.fitResult.pass) {
      return a.fitResult.pass ? -1 : 1;
    }
    return b.fitResult.score - a.fitResult.score;
  });
  
  timing.scoring = Date.now() - startScoring;
  const passCount = scoredListings.filter(s => s.fitResult.pass).length;
  console.log(`[RecommenderV2] Scoring complete: ${passCount}/${scoredListings.length} pass`);
  
  // =========================================================================
  // STEP 6: Generate Explanations (Top Results Only)
  // =========================================================================
  const startExplain = Date.now();
  
  if (!skipExplanations) {
    console.log('[RecommenderV2] Generating explanations for top results...');
    
    // Only explain top 5 to save costs
    const toExplain = scoredListings.slice(0, 5);
    
    for (const result of toExplain) {
      const explanation = await generateExplanation(
        result.listing,
        result.wpa,
        result.neighborhood || null,
        result.fitResult,
        profile
      );
      result.explanation = explanation;
      costs.explain += 0.001; // ~$0.001 per explanation
    }
  }
  
  timing.explain = Date.now() - startExplain;
  
  // =========================================================================
  // FINALIZE
  // =========================================================================
  
  timing.total = Date.now() - startTotal;
  costs.total = costs.wpaDescribe + costs.wpaScore + costs.explain;
  
  const recommendations = scoredListings.slice(0, maxResults);
  
  console.log(`[RecommenderV2] Complete in ${timing.total}ms`);
  console.log(`[RecommenderV2] Estimated cost: $${costs.total.toFixed(3)}`);
  console.log(`[RecommenderV2] Top scores: ${recommendations.slice(0, 5).map(r => r.fitResult.score).join(', ')}`);
  
  return {
    success: true,
    recommendations,
    totalFound: filterResult.total,
    preFilterPassed: preFiltered.length,
    wpaProcessed,
    timing,
    costs,
    debug: includeDebug ? {
      preFilterReasons: Object.fromEntries(
        preFiltered.slice(0, 10).map(p => [p.listing.listing_id, p.reasons])
      ),
      wpaFromCache,
      neighborhoodsFound,
    } : undefined,
  };
}

// ============================================================================
// Quick Mode (No WPA, for browsing)
// ============================================================================

export async function quickSearchV2(
  profile: LifeProfile,
  limit: number = 50
): Promise<V2ScoredListing[]> {
  const result = await runRecommenderV2(profile, {
    maxResults: limit,
    skipWPA: true,
    skipExplanations: true,
  });
  
  return result.recommendations;
}

// ============================================================================
// Deep Mode (Full WPA, for shortlist)
// ============================================================================

export async function deepAnalysisV2(
  profile: LifeProfile,
  listings: FilteredListing[]
): Promise<V2ScoredListing[]> {
  console.log(`[RecommenderV2] Deep analysis on ${listings.length} listings`);
  
  // Run full WPA on all provided listings
  const result = await runRecommenderV2(profile, {
    maxResults: listings.length,
    maxWPA: listings.length,
    preFilterThreshold: 0, // Process all
    skipExplanations: false,
    includeDebug: true,
  });
  
  return result.recommendations;
}

// ============================================================================
// Exports
// ============================================================================

export { convertToUserFitProfile };

