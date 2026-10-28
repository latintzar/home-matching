/**
 * Fit Scoring V2
 * 
 * Enhanced algorithmic fit scoring using 35-dimension WPA scores.
 * 
 * Key features:
 * - 35 WPA dimensions + 4 neighborhood weights currently used
 * - Dealbreaker checks (instant fail)
 * - Must-have thresholds (minimum acceptable)
 * - Weighted scoring based on user priorities
 * - Bonus/penalty adjustments for standouts and concerns
 * - Life situation awareness (kids, pets, WFH, etc.)
 * 
 * This is purely algorithmic - no LLM calls.
 */

import type { WPAScores } from '../../types/wpa-score';

// ============================================================================
// Types
// ============================================================================

export interface UserFitProfile {
  // Dimension weights (0-2, default 1.0)
  // Higher = user cares more about this dimension
  weights: Partial<Record<string, number>>;
  
  // Dealbreakers (instant fail if true)
  dealbreakers: {
    cubicle_bathroom?: boolean;
    mezzanine_ladder?: boolean;
    needs_full_renovation?: boolean;
    ground_floor_exposed?: boolean;
    is_house_share?: boolean;
    no_natural_light?: boolean;
  };
  
  // Must-haves (minimum acceptable score, 0-100)
  must_haves: Partial<Record<string, number>>;
  
  // Life situation (affects safety checks and bonuses)
  has_children: boolean;
  planning_children: boolean;
  has_pets: boolean;
  works_from_home: boolean;
  living_alone: boolean;
  has_mobility_needs: boolean;
  has_vision_impairment: boolean;
  is_elderly: boolean;
}

export interface NeighborhoodProfile {
  scores: {
    quietness?: number;
    safety_overall?: number;
    digital_nomad?: number;
    family_friendly?: number;
    pet_friendly?: number;
    nightlife_social?: number;
    transport_access?: number;
    walkability?: number;
    // ... other dimensions from SERP research
  };
}

export interface ListingBasics {
  price: number;
  sqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  floor?: number;
  has_elevator?: boolean;
  city?: string;
  neighborhood?: string;
}

export interface FitResult {
  score: number;              // 0-100 overall fit
  pass: boolean;              // Score >= 50
  reason: string;             // Human-readable summary
  breakdown: Record<string, number>;  // Per-dimension contribution
  adjustments: number;        // Bonus/penalty applied
  topMatches: string[];       // Top 3 matching dimensions
  concerns: string[];         // From WPA concerns
  failReason?: string;        // If pass = false
}

// ============================================================================
// Default Weights
// ============================================================================

const DEFAULT_WEIGHTS: Record<string, number> = {
  // Light & Air (high baseline importance)
  natural_light_intensity: 1.2,
  light_distribution: 1.0,
  cross_ventilation: 0.8,
  ceiling_height: 0.7,
  window_quality: 0.9,
  
  // Layout & Flow
  entrance_experience: 0.6,
  kitchen_living_relationship: 0.9,
  bathroom_privacy: 0.8,
  bedroom_seclusion: 0.9,
  flow_for_entertaining: 0.7,
  furniture_feasibility: 0.9,
  two_person_living: 0.8,
  escape_room_potential: 0.6,
  
  // Kitchen
  counter_space: 0.9,
  appliance_quality: 0.8,
  kitchen_storage: 0.8,
  cooking_ventilation: 0.7,
  
  // Bathroom & Bedroom
  bathroom_functionality: 0.9,
  bedroom_size_fit: 1.0,
  closet_storage: 0.8,
  morning_light_bedroom: 0.6,
  
  // Condition (highly variable by user)
  renovation_state: 1.0,
  signs_of_aging: 0.8,
  kitchen_modernity: 0.7,
  bathroom_modernity: 0.8,
  
  // Comfort & Lifestyle
  cozy_corner_potential: 0.6,
  wfh_potential: 0.7,
  outdoor_space_quality: 0.8,
  balcony_security: 0.5,
  storage_total: 0.8,
  guest_hosting: 0.5,
  
  // Views & Exposure
  view_quality: 0.7,
  street_exposure: 0.8,
  floor_level_safety: 0.6,
  building_position: 0.7,
  
  // Neighborhood (when available)
  neighborhood_quietness: 0.8,
  neighborhood_safety: 0.9,
  neighborhood_wfh: 0.6,
  neighborhood_family: 0.5,
};

// ============================================================================
// Dimension Display Names (Spanish)
// ============================================================================

const DIMENSION_NAMES: Record<string, string> = {
  natural_light_intensity: 'Luz natural',
  light_distribution: 'Distribución de luz',
  cross_ventilation: 'Ventilación cruzada',
  ceiling_height: 'Altura de techos',
  window_quality: 'Calidad de ventanas',
  entrance_experience: 'Entrada',
  kitchen_living_relationship: 'Cocina-salón',
  bathroom_privacy: 'Privacidad del baño',
  bedroom_seclusion: 'Tranquilidad dormitorios',
  flow_for_entertaining: 'Para recibir visitas',
  furniture_feasibility: 'Para amueblar',
  two_person_living: 'Para pareja',
  escape_room_potential: 'Espacio privado',
  counter_space: 'Encimera cocina',
  appliance_quality: 'Electrodomésticos',
  kitchen_storage: 'Almacenaje cocina',
  cooking_ventilation: 'Ventilación cocina',
  bathroom_functionality: 'Baño funcional',
  bedroom_size_fit: 'Tamaño dormitorio',
  closet_storage: 'Armarios',
  morning_light_bedroom: 'Luz matinal',
  renovation_state: 'Estado reforma',
  signs_of_aging: 'Desgaste visible',
  kitchen_modernity: 'Cocina moderna',
  bathroom_modernity: 'Baño moderno',
  cozy_corner_potential: 'Rincón acogedor',
  wfh_potential: 'Para teletrabajar',
  outdoor_space_quality: 'Espacio exterior',
  balcony_security: 'Seguridad balcón',
  storage_total: 'Almacenaje total',
  guest_hosting: 'Para huéspedes',
  view_quality: 'Vistas',
  street_exposure: 'Exposición calle',
  floor_level_safety: 'Planta segura',
  building_position: 'Posición edificio',
  nb_quietness: 'Barrio tranquilo',
  nb_safety_overall: 'Seguridad del barrio',
  nb_digital_nomad: 'Barrio para teletrabajar',
  nb_family_friendly: 'Barrio familiar',
};

// ============================================================================
// Helper Functions
// ============================================================================

function fail(reason: string): FitResult {
  return {
    score: 0,
    pass: false,
    reason,
    breakdown: {},
    adjustments: 0,
    topMatches: [],
    concerns: [],
    failReason: reason,
  };
}

function getEffectiveWeight(
  dimension: string,
  profile: UserFitProfile
): number {
  // User override
  if (profile.weights[dimension] !== undefined) {
    return profile.weights[dimension]!;
  }
  // Default weight
  return DEFAULT_WEIGHTS[dimension] ?? 1.0;
}

function getDimensionName(dimension: string): string {
  return DIMENSION_NAMES[dimension] || dimension;
}

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Calculate fit score for a property against a user profile
 * 
 * This is the core algorithmic scoring - no LLM calls!
 */
export function calculateFitScore(
  wpa: WPAScores,
  profile: UserFitProfile,
  neighborhood: NeighborhoodProfile | null = null,
  listing: ListingBasics | null = null
): FitResult {
  
  // =========================================================================
  // STEP 1: DEALBREAKER CHECKS (Instant Fail)
  // =========================================================================
  
  // Flag-based dealbreakers
  if (profile.dealbreakers.cubicle_bathroom && wpa.flags.has_cubicle_bathroom) {
    return fail('Dealbreaker: Baño de "cabina de teléfono"');
  }
  
  if (profile.dealbreakers.mezzanine_ladder && wpa.flags.has_mezzanine) {
    return fail('Dealbreaker: Altillo con escalera');
  }
  
  if (profile.dealbreakers.needs_full_renovation && wpa.flags.needs_full_renovation) {
    return fail('Dealbreaker: Necesita reforma integral');
  }
  
  if (profile.dealbreakers.ground_floor_exposed && wpa.flags.ground_floor_exposed) {
    return fail('Dealbreaker: Bajo a pie de calle');
  }
  
  if (profile.dealbreakers.is_house_share && wpa.flags.is_house_share) {
    return fail('Piso compartido - buscas vivir solo/a');
  }
  
  if (profile.dealbreakers.no_natural_light && wpa.flags.no_natural_light) {
    return fail('Dealbreaker: Sin luz natural');
  }
  
  // Safety dealbreakers based on life situation
  if (profile.has_children && wpa.safety_flags.child_hazards.length > 0) {
    return fail(`Riesgos para niños: ${wpa.safety_flags.child_hazards.join(', ')}`);
  }
  
  if (profile.has_mobility_needs && wpa.safety_flags.accessibility_issues.length > 0) {
    return fail(`Problemas de accesibilidad: ${wpa.safety_flags.accessibility_issues.join(', ')}`);
  }
  
  if (profile.is_elderly && wpa.safety_flags.elderly_hazards.length > 0) {
    return fail(`Riesgos para mayores: ${wpa.safety_flags.elderly_hazards.join(', ')}`);
  }
  
  // =========================================================================
  // STEP 2: MUST-HAVE CHECKS (Minimum Thresholds)
  // =========================================================================
  
  for (const [dimension, minScore] of Object.entries(profile.must_haves)) {
    if (minScore === undefined) continue;
    const actualScore = wpa.scores[dimension as keyof typeof wpa.scores];
    if (actualScore !== null && actualScore !== undefined && actualScore < minScore) {
      return fail(`${getDimensionName(dimension)} insuficiente: ${actualScore} < ${minScore}`);
    }
  }
  
  // =========================================================================
  // STEP 3: WEIGHTED SCORE CALCULATION
  // =========================================================================
  
  let weightedSum = 0;
  let totalWeight = 0;
  const breakdown: Record<string, number> = {};
  
  // Calculate weighted sum for all WPA dimensions
  for (const [dimension, score] of Object.entries(wpa.scores)) {
    if (score === null || score === undefined) continue;  // Can't assess
    
    const weight = getEffectiveWeight(dimension, profile);
    if (weight === 0) continue;  // User doesn't care
    
    const contribution = score * weight;
    weightedSum += contribution;
    totalWeight += weight * 100;  // Normalize to 0-100 range
    
    breakdown[dimension] = Math.round(score);
  }
  
  // Add neighborhood scores if available
  if (neighborhood?.scores) {
    const neighborhoodMappings: [string, string][] = [
      ['quietness', 'neighborhood_quietness'],
      ['safety_overall', 'neighborhood_safety'],
      ['digital_nomad', 'neighborhood_wfh'],
      ['family_friendly', 'neighborhood_family'],
    ];
    
    for (const [nbDim, profileDim] of neighborhoodMappings) {
      const score = neighborhood.scores[nbDim as keyof typeof neighborhood.scores];
      const weight = getEffectiveWeight(profileDim, profile);
      
      if (score !== null && score !== undefined && weight > 0) {
        weightedSum += score * weight;
        totalWeight += weight * 100;
        breakdown[`nb_${nbDim}`] = score;
      }
    }
  }
  
  // Calculate base score
  const baseScore = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 50;
  
  // =========================================================================
  // STEP 4: BONUS/PENALTY ADJUSTMENTS
  // =========================================================================
  
  let adjustments = 0;
  
  // BONUS: Exceeds expectations on high-priority items (weight >= 1.5)
  const highPriorities = Object.entries(profile.weights)
    .filter(([_, w]) => (w as number) >= 1.5)
    .map(([dim]) => dim);
  
  for (const dim of highPriorities) {
    const score = wpa.scores[dim as keyof typeof wpa.scores];
    if (score && score >= 85) {
      adjustments += 5;  // +5 for excellent match on priority
    }
  }
  
  // BONUS: Has standout features matching user interests
  const standoutKeywords: Record<string, string[]> = {
    wfh_potential: ['oficina', 'office', 'workspace', 'video call', 'despacho'],
    natural_light_intensity: ['luz natural', 'natural light', 'bright', 'sunny', 'soleado', 'luminoso'],
    outdoor_space_quality: ['balcón', 'balcony', 'terraza', 'terrace', 'jardín', 'garden'],
    cozy_corner_potential: ['acogedor', 'cozy', 'reading', 'rincón', 'fireplace', 'chimenea'],
  };
  
  for (const [dim, keywords] of Object.entries(standoutKeywords)) {
    const weight = getEffectiveWeight(dim, profile);
    if (weight >= 1.5) {
      const hasMatch = wpa.standouts.some(s => 
        keywords.some(k => s.toLowerCase().includes(k))
      );
      if (hasMatch) adjustments += 3;
    }
  }
  
  // PENALTY: Concerns match user sensitivities
  if (profile.works_from_home) {
    const wfhConcernKeywords = ['ruido', 'noise', 'dark', 'oscuro', 'sin luz'];
    if (wpa.concerns.some(c => wfhConcernKeywords.some(k => c.toLowerCase().includes(k)))) {
      adjustments -= 10;
    }
  }
  
  if (profile.has_children || profile.planning_children) {
    const familyConcernKeywords = ['seguridad', 'safety', 'escaleras', 'stairs', 'peligro', 'hazard'];
    if (wpa.concerns.some(c => familyConcernKeywords.some(k => c.toLowerCase().includes(k)))) {
      adjustments -= 10;
    }
  }
  
  if (profile.has_pets) {
    const petConcernKeywords = ['no mascotas', 'no pets', 'balcón pequeño', 'small balcony'];
    if (wpa.concerns.some(c => petConcernKeywords.some(k => c.toLowerCase().includes(k)))) {
      adjustments -= 8;
    }
  }
  
  // PENALTY: Low confidence WPA (fewer photos = less reliable)
  if (wpa.confidence === 'low') {
    adjustments -= 5;
  }
  
  // =========================================================================
  // STEP 5: LIFE SITUATION ADJUSTMENTS
  // =========================================================================
  
  // WFH users: boost quiet, light, and space dimensions
  if (profile.works_from_home) {
    const wfhScore = wpa.scores.wfh_potential;
    if (wfhScore && wfhScore >= 70) {
      adjustments += 5;
    } else if (wfhScore && wfhScore < 40) {
      adjustments -= 5;
    }
  }
  
  // Families/planning: boost family-relevant scores
  if (profile.has_children || profile.planning_children) {
    const bedrooms = listing?.bedrooms || 0;
    if (bedrooms >= 3) adjustments += 3;
    if (bedrooms <= 1) adjustments -= 5;
  }
  
  // Pet owners: outdoor space is crucial
  if (profile.has_pets) {
    const outdoor = wpa.scores.outdoor_space_quality;
    if (outdoor && outdoor >= 70) adjustments += 5;
    if (outdoor && outdoor < 30) adjustments -= 8;
  }
  
  // Living alone: different priorities
  if (profile.living_alone) {
    const escape = wpa.scores.escape_room_potential;
    const twoPersonLiving = wpa.scores.two_person_living;
    // Don't need two-person features, so remove any penalty
    if (twoPersonLiving && twoPersonLiving < 50) {
      // No penalty for solo living
    }
  }
  
  // =========================================================================
  // STEP 6: FINAL SCORE
  // =========================================================================
  
  const finalScore = Math.max(0, Math.min(100, baseScore + adjustments));
  const pass = finalScore >= 50;
  
  // Find top matching dimensions
  const scoredDimensions = Object.entries(breakdown)
    .filter(([dim]) => getEffectiveWeight(dim, profile) >= 1.0)
    .sort(([,a], [,b]) => b - a);
  
  const topMatches = scoredDimensions
    .slice(0, 3)
    .map(([dim]) => getDimensionName(dim));
  
  // Generate reason
  let reason: string;
  if (finalScore >= 80) reason = 'Excelente encaje - cumple la mayoría de tus prioridades';
  else if (finalScore >= 70) reason = 'Muy buen encaje';
  else if (finalScore >= 60) reason = 'Buen encaje con algunos compromisos';
  else if (finalScore >= 50) reason = 'Encaje aceptable';
  else reason = 'Encaje débil - no cumple requisitos clave';
  
  return {
    score: Math.round(finalScore),
    pass,
    reason,
    breakdown,
    adjustments: Math.round(adjustments),
    topMatches,
    concerns: wpa.concerns,
  };
}

// ============================================================================
// Batch Scoring
// ============================================================================

/**
 * Score multiple listings and sort by fit
 */
export function scoreAndRankListingsV2(
  listings: Array<{
    wpa: WPAScores;
    listing: ListingBasics;
    neighborhood?: NeighborhoodProfile | null;
  }>,
  profile: UserFitProfile
): Array<{
  listing: ListingBasics;
  wpa: WPAScores;
  fitResult: FitResult;
}> {
  console.log(`[FitScoringV2] Scoring ${listings.length} listings`);
  
  const scored = listings.map(({ wpa, listing, neighborhood }) => ({
    listing,
    wpa,
    fitResult: calculateFitScore(wpa, profile, neighborhood || null, listing),
  }));
  
  // Sort by fit score (highest first), passing listings before failing ones
  scored.sort((a, b) => {
    // Passing scores first
    if (a.fitResult.pass !== b.fitResult.pass) {
      return a.fitResult.pass ? -1 : 1;
    }
    // Then by score
    return b.fitResult.score - a.fitResult.score;
  });
  
  const passCount = scored.filter(s => s.fitResult.pass).length;
  console.log(`[FitScoringV2] ${passCount}/${listings.length} pass (score >= 50)`);
  console.log(`[FitScoringV2] Top scores: ${scored.slice(0, 5).map(s => s.fitResult.score).join(', ')}`);
  
  return scored;
}

// ============================================================================
// Pre-WPA Fit Scoring (FREE, no WPA required)
// ============================================================================

/**
 * Quick pre-filter score based on listing basics only.
 * Use this to filter before running expensive WPA.
 * 
 * Returns 0-100 score based on:
 * - Price vs budget
 * - Location match
 * - Size match
 * - Bedroom count
 * 
 * This is FREE (no AI calls) and fast.
 */
export function calculatePreWpaFitScore(
  listing: ListingBasics,
  profile: {
    budget: { min?: number; max: number };
    preferredLocations: string[];
    avoidLocations: string[];
    minSqm?: number;
    minBedrooms?: number;
  }
): { score: number; reasons: string[] } {
  let score = 50;  // Start neutral
  const reasons: string[] = [];
  
  // Price check (0-30 points)
  if (profile.budget.max) {
    const priceRatio = listing.price / profile.budget.max;
    if (priceRatio <= 0.7) {
      score += 30;
      reasons.push('Muy por debajo del presupuesto');
    } else if (priceRatio <= 0.9) {
      score += 20;
      reasons.push('Dentro del presupuesto');
    } else if (priceRatio <= 1.0) {
      score += 10;
      reasons.push('En el límite del presupuesto');
    } else if (priceRatio <= 1.1) {
      score -= 10;
      reasons.push('Ligeramente sobre presupuesto');
    } else {
      score -= 25;
      reasons.push('Sobre presupuesto');
    }
  }
  
  // Location check (0-25 points)
  const locationStr = `${listing.city || ''} ${listing.neighborhood || ''}`.toLowerCase();
  
  if (profile.avoidLocations.some(loc => locationStr.includes(loc.toLowerCase()))) {
    score -= 25;
    reasons.push('Zona a evitar');
  } else if (profile.preferredLocations.some(loc => locationStr.includes(loc.toLowerCase()))) {
    score += 25;
    reasons.push('Zona preferida');
  }
  
  // Size check (0-20 points)
  if (profile.minSqm && listing.sqm) {
    const sqmRatio = listing.sqm / profile.minSqm;
    if (sqmRatio >= 1.2) {
      score += 20;
      reasons.push('Más metros que el mínimo');
    } else if (sqmRatio >= 1.0) {
      score += 10;
      reasons.push('Metros suficientes');
    } else if (sqmRatio >= 0.9) {
      // Slight under is OK
    } else {
      score -= 15;
      reasons.push('Menos metros que el mínimo');
    }
  }
  
  // Bedrooms check (0-15 points)
  if (profile.minBedrooms && listing.bedrooms) {
    if (listing.bedrooms >= profile.minBedrooms + 1) {
      score += 15;
      reasons.push('Más habitaciones que el mínimo');
    } else if (listing.bedrooms >= profile.minBedrooms) {
      score += 10;
      reasons.push('Habitaciones suficientes');
    } else {
      score -= 15;
      reasons.push('Pocas habitaciones');
    }
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

// ============================================================================
// Export Types
// ============================================================================

export type { WPAScores } from '../../types/wpa-score';

