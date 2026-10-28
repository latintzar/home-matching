/**
 * Check Availability API
 * 
 * Called BY ElevenLabs agent mid-conversation to check how many properties
 * match the user's preferences. If not enough, returns flexibility suggestions
 * with pre-generated questions for opportunity area exploration.
 * 
 * POST /api/recommender/check-availability
 * 
 * This endpoint is designed to be called as an ElevenLabs server tool.
 * It does NOT run WPA (that happens later) - just filters and counts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateSweetSpot, getSweetSpotLocations } from '@/lib/recommender/sweetSpot';
import { filterListings, FilterOptions } from '@/lib/recommender/harvestFilter';
import { 
  getAdjacentNeighborhoods, 
  getCheaperAdjacentNeighborhoods,
  getUpcomingAdjacentNeighborhoods 
} from '@/lib/recommender/neighborhoodAdjacency';
import { LifeProfile } from '@/types/recommender';

// ============================================================================
// Constants
// ============================================================================

// Minimum listings needed to proceed without flexibility questions
const MIN_FOR_WPA = 10;

// Flexibility query multipliers
const BUDGET_FLEX_PERCENT = 0.15; // +15% budget
const COMMUTE_FLEX_MINS = 5;      // +5 minutes

// ============================================================================
// Types
// ============================================================================

interface CheckAvailabilityRequest {
  budget?: number;
  locations?: string[];
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  maxCommuteMinutes?: number;
  workAddress?: string;
  dealbreakers?: string[];
  // For partial life profile
  minSqm?: number;
}

interface FlexibilitySuggestion {
  type: 'budget' | 'commute' | 'adjacent_neighborhoods' | 'property_type' | 'bedrooms' | 'dealbreaker';
  delta: number;  // How many MORE listings this would unlock
  question_es: string;
  question_en: string;
  // Type-specific details
  newBudget?: number;
  additionalMinutes?: number;
  neighborhoods?: string[];
  removedDealbreaker?: string;
  newBedrooms?: number;
}

interface MatchedLocation {
  name: string;
  count: number;
}

interface CheckAvailabilityResponse {
  count: number;
  hasEnough: boolean;
  matchedLocations: MatchedLocation[];
  priceRange: { min: number; max: number };
  flexibilityAnalysis?: {
    suggestions: FlexibilitySuggestion[];
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build a minimal LifeProfile from request params for sweet spot generation
 */
function buildMinimalProfile(req: CheckAvailabilityRequest): LifeProfile {
  return {
    id: 'temp-check',
    household: {
      adults: 1,
      children: [],
      pets: [],
      workSituation: 'office',
    },
    constraints: {
      maxBudget: req.budget || 300000,
      maxCommuteMinutes: req.maxCommuteMinutes || 30,
      commuteDestination: '',
      moveInDate: null,
      renovationAppetite: 'any',
    },
    propertyPreferences: {
      preferredLocations: req.locations || [],
      avoidLocations: [],
      minBedrooms: req.bedrooms || 1,
      minBathrooms: req.bathrooms || 1,
      minSqm: req.minSqm || 40,
      propertyTypes: req.propertyType ? [req.propertyType] : [],
    },
    lifestyle: {
      morningRoutine: '',
      eveningRoutine: '',
      weekendActivities: [],
      dealbreakers: req.dealbreakers || [],
      mustHaves: [],
    },
    tradeoffs: {
      spaceVsLocation: 0,
      newVsCharacter: 0,
      quietVsVibrant: 0,
      viewsVsPrivacy: 0,
    },
    intakeCompleted: false,
    intakeStep: 0,
  };
}

/**
 * Run flexibility queries to find what constraints could be relaxed
 */
async function analyzeFlexibility(
  baseFilters: FilterOptions,
  baseCount: number,
  req: CheckAvailabilityRequest
): Promise<FlexibilitySuggestion[]> {
  const suggestions: FlexibilitySuggestion[] = [];
  
  // 1. Budget flexibility (+15%)
  if (req.budget) {
    const newBudget = Math.round(req.budget * (1 + BUDGET_FLEX_PERCENT));
    const budgetFlexFilters = { ...baseFilters, maxPrice: newBudget };
    
    try {
      const budgetResults = await filterListings(budgetFlexFilters);
      const delta = budgetResults.length - baseCount;
      
      if (delta > 0) {
        const formattedBudget = newBudget >= 1000000 
          ? `€${(newBudget / 1000000).toFixed(1)}M` 
          : `€${Math.round(newBudget / 1000)}k`;
        
        suggestions.push({
          type: 'budget',
          delta,
          newBudget,
          question_es: `¿Podrías estirar el presupuesto hasta ${formattedBudget}?`,
          question_en: `Could you stretch your budget to ${formattedBudget}?`,
        });
      }
    } catch (e) {
      console.warn('[CheckAvailability] Budget flex query failed:', e);
    }
  }
  
  // 2. Adjacent neighborhoods
  if (req.locations && req.locations.length > 0) {
    const allAdjacent = new Set<string>();
    
    for (const location of req.locations) {
      // Get all adjacent, plus cheaper and upcoming ones
      const adjacent = getAdjacentNeighborhoods(location);
      const cheaper = getCheaperAdjacentNeighborhoods(location);
      const upcoming = getUpcomingAdjacentNeighborhoods(location);
      
      [...adjacent, ...cheaper, ...upcoming].forEach(n => allAdjacent.add(n));
    }
    
    // Remove already preferred locations
    req.locations.forEach(l => allAdjacent.delete(l));
    
    if (allAdjacent.size > 0) {
      const adjacentArray = Array.from(allAdjacent).slice(0, 5); // Top 5
      const adjacentFilters = {
        ...baseFilters,
        locations: [...(baseFilters.locations || []), ...adjacentArray],
      };
      
      try {
        const adjacentResults = await filterListings(adjacentFilters);
        const delta = adjacentResults.length - baseCount;
        
        if (delta > 0) {
          // Pick top 2-3 for the question
          const topAdjacent = adjacentArray.slice(0, 3);
          const neighborhoodList = topAdjacent.join(' o ');
          const neighborhoodListEn = topAdjacent.join(' or ');
          
          suggestions.push({
            type: 'adjacent_neighborhoods',
            delta,
            neighborhoods: adjacentArray,
            question_es: `¿Considerarías ${neighborhoodList}? Están al lado y hay más opciones.`,
            question_en: `Would you consider ${neighborhoodListEn}? They're nearby with more options.`,
          });
        }
      } catch (e) {
        console.warn('[CheckAvailability] Adjacent flex query failed:', e);
      }
    }
  }
  
  // 3. Bedroom flexibility (-1)
  if (req.bedrooms && req.bedrooms > 1) {
    const newBedrooms = req.bedrooms - 1;
    const bedroomFlexFilters = { ...baseFilters, minBedrooms: newBedrooms };
    
    try {
      const bedroomResults = await filterListings(bedroomFlexFilters);
      const delta = bedroomResults.length - baseCount;
      
      if (delta > 0) {
        suggestions.push({
          type: 'bedrooms',
          delta,
          newBedrooms,
          question_es: `¿Funcionaría con ${newBedrooms} ${newBedrooms === 1 ? 'habitación' : 'habitaciones'}?`,
          question_en: `Would ${newBedrooms} bedroom${newBedrooms === 1 ? '' : 's'} work?`,
        });
      }
    } catch (e) {
      console.warn('[CheckAvailability] Bedroom flex query failed:', e);
    }
  }
  
  // 4. Commute flexibility (+5 mins)
  // Note: This would require isochrone recalculation with Geoapify
  // For MVP, we'll skip this unless we have work address
  if (req.maxCommuteMinutes && req.workAddress) {
    const additionalMinutes = COMMUTE_FLEX_MINS;
    // TODO: Implement isochrone expansion when Geoapify is integrated
    // For now, add a placeholder suggestion with estimated delta
    suggestions.push({
      type: 'commute',
      delta: 5, // Estimated
      additionalMinutes,
      question_es: `¿Y si el commute fuera ${additionalMinutes} minutos más largo?`,
      question_en: `What if the commute was ${additionalMinutes} minutes longer?`,
    });
  }
  
  // 5. Dealbreaker flexibility
  if (req.dealbreakers && req.dealbreakers.length > 0) {
    // Pick one dealbreaker to suggest removing
    const dealbreaker = req.dealbreakers[0];
    const dealbreakerFilters = {
      ...baseFilters,
      // This would need custom handling in filterListings
    };
    
    // For MVP, add suggestion without actual count
    suggestions.push({
      type: 'dealbreaker',
      delta: 3, // Estimated
      removedDealbreaker: dealbreaker,
      question_es: `¿Y si no tuviera ${dealbreaker}? ¿Lo considerarías por el lugar perfecto?`,
      question_en: `What if it didn't have ${dealbreaker}? Would you consider it for the perfect place?`,
    });
  }
  
  // Sort by delta (most impactful first)
  suggestions.sort((a, b) => b.delta - a.delta);
  
  return suggestions;
}

/**
 * Get mock data when DynamoDB isn't available (for testing)
 */
function getMockResults(filters: FilterOptions): { count: number; matchedLocations: MatchedLocation[] } {
  // Simulate results based on filters
  const baseCount = 50;
  let count = baseCount;
  
  // Reduce based on constraints
  if (filters.maxPrice && filters.maxPrice < 200000) count = Math.floor(count * 0.3);
  else if (filters.maxPrice && filters.maxPrice < 300000) count = Math.floor(count * 0.6);
  
  if (filters.minBedrooms && filters.minBedrooms >= 3) count = Math.floor(count * 0.5);
  if (filters.locations && filters.locations.length === 1) count = Math.floor(count * 0.4);
  
  // Ensure minimum
  count = Math.max(2, count);
  
  const matchedLocations: MatchedLocation[] = filters.locations?.map(loc => ({
    name: loc,
    count: Math.floor(count / (filters.locations?.length || 1)),
  })) || [{ name: 'Madrid', count }];
  
  return { count, matchedLocations };
}

// ============================================================================
// Main Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: CheckAvailabilityRequest = await request.json();
    
    console.log('[CheckAvailability] Request:', {
      budget: body.budget,
      locations: body.locations,
      bedrooms: body.bedrooms,
    });
    
    // Validate minimum requirements
    if (!body.budget) {
      return NextResponse.json(
        { error: 'Budget is required' },
        { status: 400 }
      );
    }
    
    // Build minimal profile for sweet spot
    const profile = buildMinimalProfile(body);
    
    // Generate sweet spot
    const sweetSpot = await generateSweetSpot(profile);
    const sweetSpotLocations = getSweetSpotLocations(sweetSpot);
    
    // Build filter options
    const filters: FilterOptions = {
      maxPrice: body.budget,
      minBedrooms: body.bedrooms,
      minBathrooms: body.bathrooms,
      minSqm: body.minSqm,
      locations: body.locations?.length ? body.locations : sweetSpotLocations,
      propertyTypes: body.propertyType ? [body.propertyType] : undefined,
      limit: 200, // Get more for counting
    };
    
    // Try to filter from DynamoDB, fall back to mock
    let count: number;
    let matchedLocations: MatchedLocation[];
    let priceRange = { min: 0, max: 0 };
    
    try {
      const listings = await filterListings(filters);
      count = listings.length;
      
      // Group by location
      const locationCounts = new Map<string, number>();
      listings.forEach(l => {
        const loc = l.city || 'Unknown';
        locationCounts.set(loc, (locationCounts.get(loc) || 0) + 1);
      });
      
      matchedLocations = Array.from(locationCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      // Calculate price range
      if (listings.length > 0) {
        const prices = listings.map(l => l.price).filter(p => p > 0);
        priceRange = {
          min: Math.min(...prices),
          max: Math.max(...prices),
        };
      }
      
      console.log('[CheckAvailability] DynamoDB results:', { count, locations: matchedLocations.length });
      
    } catch (error) {
      console.warn('[CheckAvailability] DynamoDB unavailable, using mock:', error);
      const mock = getMockResults(filters);
      count = mock.count;
      matchedLocations = mock.matchedLocations;
      priceRange = { min: body.budget * 0.6, max: body.budget };
    }
    
    const hasEnough = count >= MIN_FOR_WPA;
    
    // Build response
    const response: CheckAvailabilityResponse = {
      count,
      hasEnough,
      matchedLocations,
      priceRange,
    };
    
    // If not enough, analyze flexibility options
    if (!hasEnough) {
      console.log('[CheckAvailability] Not enough listings, analyzing flexibility...');
      
      const suggestions = await analyzeFlexibility(filters, count, body);
      
      if (suggestions.length > 0) {
        response.flexibilityAnalysis = {
          suggestions: suggestions.slice(0, 5), // Top 5
        };
      }
      
      console.log('[CheckAvailability] Flexibility suggestions:', suggestions.length);
    }
    
    console.log('[CheckAvailability] Response:', {
      count,
      hasEnough,
      suggestionsCount: response.flexibilityAnalysis?.suggestions.length || 0,
    });
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('[CheckAvailability] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support GET for testing
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  const mockRequest: CheckAvailabilityRequest = {
    budget: parseInt(searchParams.get('budget') || '300000'),
    locations: searchParams.get('locations')?.split(',') || ['Chamberí'],
    bedrooms: parseInt(searchParams.get('bedrooms') || '2'),
  };
  
  // Create a fake POST request
  const fakeReq = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify(mockRequest),
    headers: { 'Content-Type': 'application/json' },
  });
  
  return POST(fakeReq);
}

