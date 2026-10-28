/**
 * Fit Scoring
 * 
 * Calculates how well a property matches a user's life profile.
 * Phase R5 of the Recommender system.
 * 
 * Combines:
 * - Life Profile preferences and tradeoffs
 * - WPA analysis results
 * - Basic listing attributes
 * 
 * Outputs:
 * - Overall fit score (0-100)
 * - Score breakdown by category
 * - Personalized explanations
 */

import { LifeProfile, Match, ScoreBreakdown } from '@/types/recommender';
import { FilteredListing } from './harvestFilter';
import { RecommenderWPA } from './wpaShortlist';

// ============================================================================
// Types
// ============================================================================

export interface ScoredListing {
  listing: FilteredListing;
  wpa: RecommenderWPA | null;
  fitScore: number;
  breakdown: ScoreBreakdown;
  topReasons: string[];
  concerns: string[];
  explanation: string;
}

interface WeightConfig {
  naturalLight: number;
  noise: number;
  space: number;
  outdoorSpace: number;
  condition: number;
  layout: number;
  location: number;
  commute: number;
}

// ============================================================================
// Weight Calculation
// ============================================================================

/**
 * Calculate weights based on user's tradeoffs and lifestyle
 */
function calculateWeights(profile: LifeProfile): WeightConfig {
  const base: WeightConfig = {
    naturalLight: 15,
    noise: 15,
    space: 15,
    outdoorSpace: 10,
    condition: 15,
    layout: 10,
    location: 10,
    commute: 10,
  };
  
  // Adjust based on tradeoffs
  const { tradeoffs, lifestyle, household } = profile;
  
  // Space vs Location
  if (tradeoffs.spaceVsLocation < 0) {
    base.space += Math.abs(tradeoffs.spaceVsLocation) * 2;
    base.location -= Math.abs(tradeoffs.spaceVsLocation);
  } else if (tradeoffs.spaceVsLocation > 0) {
    base.location += tradeoffs.spaceVsLocation * 2;
    base.space -= tradeoffs.spaceVsLocation;
  }
  
  // Quiet vs Vibrant
  if (tradeoffs.quietVsVibrant < 0) {
    base.noise += Math.abs(tradeoffs.quietVsVibrant) * 2;
  }
  
  // Views vs Privacy
  if (tradeoffs.viewsVsPrivacy < 0) {
    base.naturalLight += Math.abs(tradeoffs.viewsVsPrivacy);
  }
  
  // Lifestyle adjustments
  if (lifestyle.mustHaves.some(m => m.toLowerCase().includes('luz') || m.toLowerCase().includes('light'))) {
    base.naturalLight += 10;
  }
  
  if (lifestyle.mustHaves.some(m => m.toLowerCase().includes('terraza') || m.toLowerCase().includes('jardín'))) {
    base.outdoorSpace += 10;
  }
  
  if (lifestyle.dealbreakers.some(d => d.toLowerCase().includes('ruido') || d.toLowerCase().includes('noise'))) {
    base.noise += 15;
  }
  
  // Renovation appetite
  if (profile.constraints.renovationAppetite === 'turnkey') {
    base.condition += 15;
  } else if (profile.constraints.renovationAppetite === 'full') {
    base.condition -= 5;
  }
  
  // Work situation
  if (household.workSituation === 'remote') {
    base.naturalLight += 5;
    base.noise += 5;
    base.layout += 5;  // Need good home office space
  }
  
  // Pets
  if (household.pets.length > 0) {
    base.outdoorSpace += 10;
  }
  
  // Normalize weights to sum to 100
  const total = Object.values(base).reduce((sum, v) => sum + v, 0);
  const normalized: WeightConfig = {} as WeightConfig;
  for (const [key, value] of Object.entries(base)) {
    normalized[key as keyof WeightConfig] = (value / total) * 100;
  }
  
  return normalized;
}

// ============================================================================
// Score Calculation
// ============================================================================

/**
 * Calculate individual category scores
 */
function calculateBreakdown(
  listing: FilteredListing,
  wpa: RecommenderWPA | null,
  profile: LifeProfile
): ScoreBreakdown {
  const breakdown: ScoreBreakdown = {
    naturalLight: 50,
    noise: 50,
    space: 50,
    outdoorSpace: 50,
    condition: 50,
    layout: 50,
    location: 50,
    commute: 50,
  };
  
  // Use WPA scores if available
  if (wpa) {
    breakdown.naturalLight = wpa.scores.naturalLight;
    breakdown.noise = wpa.scores.quietness;
    breakdown.outdoorSpace = wpa.scores.outdoorSpace;
    breakdown.condition = wpa.scores.condition;
    breakdown.layout = wpa.scores.layout;
  }
  
  // Space score based on sqm vs preferences
  if (listing.sqm && profile.propertyPreferences.minSqm) {
    const sqmRatio = listing.sqm / profile.propertyPreferences.minSqm;
    if (sqmRatio >= 1.5) breakdown.space = 100;
    else if (sqmRatio >= 1.2) breakdown.space = 85;
    else if (sqmRatio >= 1.0) breakdown.space = 70;
    else if (sqmRatio >= 0.8) breakdown.space = 50;
    else breakdown.space = 30;
  }
  
  // Location score based on preferred locations
  const preferred = profile.propertyPreferences.preferredLocations.map(l => l.toLowerCase());
  const avoid = profile.propertyPreferences.avoidLocations.map(l => l.toLowerCase());
  const listingLocation = `${listing.city || ''} ${listing.region || ''} ${listing.address || ''}`.toLowerCase();
  
  if (preferred.some(p => listingLocation.includes(p))) {
    breakdown.location = 90;
  } else if (avoid.some(a => listingLocation.includes(a))) {
    breakdown.location = 20;
  } else {
    breakdown.location = 60;
  }
  
  // Commute score (simplified - would need geocoding for accuracy)
  if (profile.constraints.commuteDestination) {
    // For now, assume central locations have better commute
    if (listingLocation.includes('centro') || listingLocation.includes('central')) {
      breakdown.commute = 85;
    } else if (listingLocation.includes('chamberí') || listingLocation.includes('salamanca')) {
      breakdown.commute = 80;
    } else {
      breakdown.commute = 60;
    }
  }
  
  return breakdown;
}

/**
 * Calculate overall fit score from breakdown
 */
function calculateOverallScore(breakdown: ScoreBreakdown, weights: WeightConfig): number {
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const [key, weight] of Object.entries(weights)) {
    const score = breakdown[key as keyof ScoreBreakdown];
    weightedSum += score * weight;
    totalWeight += weight;
  }
  
  return Math.round(weightedSum / totalWeight);
}

// ============================================================================
// Explanation Generation
// ============================================================================

/**
 * Generate personalized reasons and concerns
 */
function generateExplanations(
  listing: FilteredListing,
  wpa: RecommenderWPA | null,
  breakdown: ScoreBreakdown,
  profile: LifeProfile
): { topReasons: string[]; concerns: string[]; explanation: string } {
  const reasons: string[] = [];
  const concerns: string[] = [];
  
  // High-scoring attributes become reasons
  if (breakdown.naturalLight >= 80) {
    reasons.push('☀️ Excelente luz natural');
  }
  if (breakdown.noise >= 80) {
    reasons.push('🤫 Zona muy tranquila');
  }
  if (breakdown.outdoorSpace >= 80) {
    reasons.push('🌿 Buen espacio exterior');
  }
  if (breakdown.condition >= 80) {
    reasons.push('✨ Listo para entrar a vivir');
  }
  if (breakdown.layout >= 80) {
    reasons.push('📐 Distribución excelente');
  }
  if (breakdown.location >= 80) {
    reasons.push('📍 Zona que te encanta');
  }
  if (breakdown.space >= 80) {
    reasons.push('🏠 Más espacio del que buscas');
  }
  
  // Add WPA insights if available
  if (wpa?.insights.standoutFeatures) {
    for (const feature of wpa.insights.standoutFeatures.slice(0, 2)) {
      if (!reasons.some(r => r.toLowerCase().includes(feature.toLowerCase()))) {
        reasons.push(`⭐ ${feature}`);
      }
    }
  }
  
  // Low-scoring attributes become concerns
  if (breakdown.naturalLight < 50) {
    concerns.push('⚠️ Poca luz natural');
  }
  if (breakdown.noise < 50 && profile.lifestyle.dealbreakers.some(d => d.toLowerCase().includes('ruido'))) {
    concerns.push('⚠️ Posible zona ruidosa (dealbreaker tuyo)');
  }
  if (breakdown.condition < 50 && profile.constraints.renovationAppetite === 'turnkey') {
    concerns.push('⚠️ Necesita reforma (prefieres llave en mano)');
  }
  if (breakdown.outdoorSpace < 30 && profile.household.pets.length > 0) {
    concerns.push('⚠️ Sin espacio exterior para mascotas');
  }
  if (breakdown.space < 50) {
    concerns.push('⚠️ Menos metros de lo que buscas');
  }
  
  // Add WPA concerns if available
  if (wpa?.insights.concerns) {
    for (const concern of wpa.insights.concerns.slice(0, 2)) {
      if (!concerns.some(c => c.toLowerCase().includes(concern.toLowerCase()))) {
        concerns.push(`⚠️ ${concern}`);
      }
    }
  }
  
  // Generate summary explanation
  const avgScore = Object.values(breakdown).reduce((a, b) => a + b, 0) / 8;
  let explanation = '';
  
  if (avgScore >= 75) {
    explanation = 'Esta propiedad encaja muy bien con tu estilo de vida.';
  } else if (avgScore >= 60) {
    explanation = 'Buena opción con algunos compromisos menores.';
  } else if (avgScore >= 45) {
    explanation = 'Opción aceptable pero con varios compromisos.';
  } else {
    explanation = 'No es la mejor opción para tu perfil.';
  }
  
  if (reasons.length > 0) {
    explanation += ` Destaca por: ${reasons.slice(0, 2).map(r => r.replace(/^[^\s]+ /, '')).join(', ')}.`;
  }
  
  return {
    topReasons: reasons.slice(0, 4),
    concerns: concerns.slice(0, 3),
    explanation,
  };
}

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Score a single listing against a profile
 */
export function scoreListing(
  listing: FilteredListing,
  wpa: RecommenderWPA | null,
  profile: LifeProfile
): ScoredListing {
  // Calculate weights based on profile
  const weights = calculateWeights(profile);
  
  // Calculate breakdown scores
  const breakdown = calculateBreakdown(listing, wpa, profile);
  
  // Calculate overall score
  const fitScore = calculateOverallScore(breakdown, weights);
  
  // Generate explanations
  const { topReasons, concerns, explanation } = generateExplanations(
    listing, wpa, breakdown, profile
  );
  
  return {
    listing,
    wpa,
    fitScore,
    breakdown,
    topReasons,
    concerns,
    explanation,
  };
}

/**
 * Score and rank multiple listings
 */
export function scoreAndRankListings(
  listings: Array<{ listing: FilteredListing; wpa: RecommenderWPA | null }>,
  profile: LifeProfile
): ScoredListing[] {
  console.log(`[FitScoring] Scoring ${listings.length} listings`);
  
  // Score all listings
  const scored = listings.map(({ listing, wpa }) => 
    scoreListing(listing, wpa, profile)
  );
  
  // Sort by fit score (highest first)
  scored.sort((a, b) => b.fitScore - a.fitScore);
  
  console.log(`[FitScoring] Top scores: ${scored.slice(0, 5).map(s => s.fitScore).join(', ')}`);
  
  return scored;
}

/**
 * Convert scored listing to Match object for storage
 */
export function scoredListingToMatch(
  scored: ScoredListing,
  profileId: string
): Omit<Match, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    profileId,
    listingId: scored.listing.listing_id,
    fitScore: scored.fitScore,
    scoreBreakdown: scored.breakdown,
    topReasons: scored.topReasons,
    concerns: scored.concerns,
    status: 'suggested',
  };
}

