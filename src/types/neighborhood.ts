/**
 * Neighborhood Profile Types
 * 
 * Used for 20-dimension neighborhood scoring that feeds into Fit Scoring.
 */

export interface NeighborhoodLifeStages {
  student_friendly: number;      // 0-100: Good for students (cheap, university proximity, bars)
  young_professional: number;    // 0-100: Good for young professionals (coworking, transport, social)
  couple_friendly: number;       // 0-100: Good for couples (restaurants, parks, mid-price)
  family_friendly: number;       // 0-100: Good for families (schools, parks, safety, space)
  retiree_friendly: number;      // 0-100: Good for retirees (quiet, healthcare, walking)
}

export interface NeighborhoodLifestyle {
  digital_nomad: number;         // 0-100: Wifi cafes, coworking, expat community
  fitness_active: number;        // 0-100: Gyms, running paths, cycling, yoga
  foodie_scene: number;          // 0-100: Restaurant variety, markets, cafes
  nightlife_social: number;      // 0-100: Bars, clubs, late-night options
  arts_culture: number;          // 0-100: Galleries, theaters, cultural events
  nature_outdoor: number;        // 0-100: Parks, green space, beach proximity
  pet_friendly: number;          // 0-100: Dog parks, pet-friendly venues
  lgbtq_friendly: number;        // 0-100: LGBTQ+ scene, acceptance
  eco_conscious: number;         // 0-100: Bike lanes, recycling, organic shops
}

export interface NeighborhoodUniversal {
  safety: number;                // 0-100: Crime rates, feeling of safety
  quietness: number;             // 0-100: Noise levels, traffic
  transport: number;             // 0-100: Metro, bus, walkability
  vibes: string[];               // Descriptors: "hipster", "traditional", "bohemian", etc.
}

export interface NeighborhoodEconomics {
  gentrification_stage: 'early' | 'mid' | 'advanced' | 'peaked' | 'stable' | 'unknown';
  budget_level: 'budget' | 'middle' | 'upper' | 'luxury';
}

export interface NeighborhoodProfile {
  neighborhood_id: string;       // e.g., "barcelona-gracia"
  city: string;                  // e.g., "barcelona"
  name: string;                  // e.g., "Gràcia"
  
  // Scores (all 0-100)
  life_stages: NeighborhoodLifeStages;
  lifestyle: NeighborhoodLifestyle;
  universal: NeighborhoodUniversal;
  economics: NeighborhoodEconomics;
  
  // Metadata
  source_count: number;          // Number of sources used for aggregation
  confidence: 'high' | 'medium' | 'low';
  updated_at: string;            // ISO timestamp
  
  // Optional: Aggregated scores for quick filtering
  scores?: NeighborhoodScores;
}

/**
 * Flattened scores for easy access in fit scoring
 */
export interface NeighborhoodScores {
  // Life stages
  student_friendly: number;
  young_professional: number;
  couple_friendly: number;
  family_friendly: number;
  retiree_friendly: number;
  
  // Lifestyle
  digital_nomad: number;
  fitness_active: number;
  foodie_scene: number;
  nightlife_social: number;
  arts_culture: number;
  nature_outdoor: number;
  pet_friendly: number;
  lgbtq_friendly: number;
  eco_conscious: number;
  
  // Universal
  safety_overall: number;
  quietness: number;
  transport_access: number;
}

/**
 * Flatten a NeighborhoodProfile into NeighborhoodScores for fit scoring
 */
export function flattenNeighborhoodScores(profile: NeighborhoodProfile): NeighborhoodScores {
  return {
    // Life stages
    student_friendly: profile.life_stages.student_friendly,
    young_professional: profile.life_stages.young_professional,
    couple_friendly: profile.life_stages.couple_friendly,
    family_friendly: profile.life_stages.family_friendly,
    retiree_friendly: profile.life_stages.retiree_friendly,
    
    // Lifestyle
    digital_nomad: profile.lifestyle.digital_nomad,
    fitness_active: profile.lifestyle.fitness_active,
    foodie_scene: profile.lifestyle.foodie_scene,
    nightlife_social: profile.lifestyle.nightlife_social,
    arts_culture: profile.lifestyle.arts_culture,
    nature_outdoor: profile.lifestyle.nature_outdoor,
    pet_friendly: profile.lifestyle.pet_friendly,
    lgbtq_friendly: profile.lifestyle.lgbtq_friendly,
    eco_conscious: profile.lifestyle.eco_conscious,
    
    // Universal
    safety_overall: profile.universal.safety,
    quietness: profile.universal.quietness,
    transport_access: profile.universal.transport,
  };
}

/**
 * User lifestyle profile mapped to neighborhood dimensions
 */
export interface UserNeighborhoodWeights {
  // Which dimensions matter to this user (0-10 scale)
  student_friendly?: number;
  young_professional?: number;
  couple_friendly?: number;
  family_friendly?: number;
  retiree_friendly?: number;
  
  digital_nomad?: number;
  fitness_active?: number;
  foodie_scene?: number;
  nightlife_social?: number;
  arts_culture?: number;
  nature_outdoor?: number;
  pet_friendly?: number;
  lgbtq_friendly?: number;
  eco_conscious?: number;
  
  safety_overall?: number;
  quietness?: number;
  transport_access?: number;
}

/**
 * Calculate neighborhood match score for a user
 */
export function calculateNeighborhoodMatch(
  profile: NeighborhoodProfile,
  userWeights: UserNeighborhoodWeights
): number {
  const scores = flattenNeighborhoodScores(profile);
  
  let totalScore = 0;
  let totalWeight = 0;
  
  // Iterate over user weights
  for (const [dimension, weight] of Object.entries(userWeights)) {
    if (weight !== undefined && weight > 0) {
      const dimensionKey = dimension as keyof NeighborhoodScores;
      const neighborhoodScore = scores[dimensionKey];
      
      if (neighborhoodScore !== undefined) {
        totalScore += neighborhoodScore * weight;
        totalWeight += weight * 100; // Normalize
      }
    }
  }
  
  if (totalWeight === 0) {
    return 50; // Neutral if no preferences
  }
  
  return Math.round(totalScore / totalWeight * 100);
}

