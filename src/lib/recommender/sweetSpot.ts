/**
 * Sweet Spot Generator
 * 
 * Generates geographic candidates based on life profile preferences.
 * Phase R2 of the Recommender system.
 * 
 * MVP: Uses profile preferences directly
 * Future: Integrate Geoapify for amenity-based scoring
 */

import { LifeProfile, SweetSpot, LocationScore } from '@/types/recommender';

// ============================================================================
// Location Database (hardcoded for MVP, will be replaced with Geoapify/DynamoDB)
// ============================================================================

interface LocationData {
  name: string;
  city: string;
  type: 'central' | 'urban' | 'suburban' | 'rural';
  avgPricePerSqm: number;
  noise: 'high' | 'medium' | 'low';
  greenSpace: 'high' | 'medium' | 'low';
  nightlife: 'high' | 'medium' | 'low';
  familyFriendly: boolean;
  petFriendly: boolean;
  workFromHomeScore: number; // 0-100
  commuteToCenter: number; // minutes
  hasMetro: boolean;
}

// Authored fictional neighborhoods; amounts and commute minutes are example inputs.
const MADRID_LOCATIONS: LocationData[] = [
  {
    name: 'Example neighborhood 1',
    city: 'Ciudad Ejemplo',
    type: 'central',
    avgPricePerSqm: 1900,
    noise: 'medium',
    greenSpace: 'low',
    nightlife: 'high',
    familyFriendly: false,
    petFriendly: false,
    workFromHomeScore: 85,
    commuteToCenter: 15,
    hasMetro: true,
  },
  {
    name: 'Example neighborhood 2',
    city: 'Ciudad Ejemplo',
    type: 'central',
    avgPricePerSqm: 2000,
    noise: 'medium',
    greenSpace: 'medium',
    nightlife: 'high',
    familyFriendly: true,
    petFriendly: true,
    workFromHomeScore: 90,
    commuteToCenter: 20,
    hasMetro: true,
  },
  {
    name: 'Example neighborhood 3',
    city: 'Ciudad Ejemplo',
    type: 'central',
    avgPricePerSqm: 2100,
    noise: 'low',
    greenSpace: 'high',
    nightlife: 'medium',
    familyFriendly: true,
    petFriendly: true,
    workFromHomeScore: 95,
    commuteToCenter: 25,
    hasMetro: true,
  },
  {
    name: 'Example neighborhood 4',
    city: 'Ciudad Ejemplo',
    type: 'central',
    avgPricePerSqm: 2200,
    noise: 'high',
    greenSpace: 'low',
    nightlife: 'high',
    familyFriendly: false,
    petFriendly: false,
    workFromHomeScore: 70,
    commuteToCenter: 30,
    hasMetro: true,
  },
  {
    name: 'Example neighborhood 5',
    city: 'Ciudad Ejemplo',
    type: 'urban',
    avgPricePerSqm: 2300,
    noise: 'low',
    greenSpace: 'medium',
    nightlife: 'low',
    familyFriendly: true,
    petFriendly: true,
    workFromHomeScore: 88,
    commuteToCenter: 35,
    hasMetro: true,
  },
  {
    name: 'Example neighborhood 6',
    city: 'Ciudad Ejemplo',
    type: 'urban',
    avgPricePerSqm: 2400,
    noise: 'low',
    greenSpace: 'high',
    nightlife: 'low',
    familyFriendly: true,
    petFriendly: true,
    workFromHomeScore: 85,
    commuteToCenter: 40,
    hasMetro: true,
  },
  {
    name: 'Example neighborhood 7',
    city: 'Ciudad Ejemplo',
    type: 'suburban',
    avgPricePerSqm: 2500,
    noise: 'low',
    greenSpace: 'high',
    nightlife: 'low',
    familyFriendly: true,
    petFriendly: true,
    workFromHomeScore: 80,
    commuteToCenter: 45,
    hasMetro: true,
  },
  {
    name: 'Example neighborhood 8',
    city: 'Ciudad Ejemplo',
    type: 'suburban',
    avgPricePerSqm: 2600,
    noise: 'low',
    greenSpace: 'high',
    nightlife: 'low',
    familyFriendly: true,
    petFriendly: true,
    workFromHomeScore: 75,
    commuteToCenter: 50,
    hasMetro: false,
  },
  {
    name: 'Example neighborhood 9',
    city: 'Ciudad Ejemplo',
    type: 'suburban',
    avgPricePerSqm: 2700,
    noise: 'low',
    greenSpace: 'high',
    nightlife: 'low',
    familyFriendly: true,
    petFriendly: true,
    workFromHomeScore: 82,
    commuteToCenter: 55,
    hasMetro: true,
  },
  {
    name: 'Example neighborhood 10',
    city: 'Ciudad Ejemplo',
    type: 'suburban',
    avgPricePerSqm: 2800,
    noise: 'medium',
    greenSpace: 'medium',
    nightlife: 'low',
    familyFriendly: true,
    petFriendly: true,
    workFromHomeScore: 70,
    commuteToCenter: 60,
    hasMetro: true,
  },
];

// ============================================================================
// Scoring Functions
// ============================================================================

function scoreLocation(location: LocationData, profile: LifeProfile): { score: number; reasons: string[] } {
  let score = 50; // Start at neutral
  const reasons: string[] = [];

  // Budget check - can they afford this area?
  const estimatedSqm = profile.propertyPreferences.minSqm || 80;
  const estimatedCost = location.avgPricePerSqm * estimatedSqm;
  const budgetRatio = estimatedCost / (profile.constraints.maxBudget || 400000);
  
  if (budgetRatio > 1.2) {
    score -= 30;
    reasons.push(`⚠️ Zona cara (€${(location.avgPricePerSqm/1000).toFixed(1)}k/m²)`);
  } else if (budgetRatio > 1) {
    score -= 15;
    reasons.push(`💰 En el límite de presupuesto`);
  } else if (budgetRatio < 0.7) {
    score += 15;
    reasons.push(`✅ Buen precio (€${(location.avgPricePerSqm/1000).toFixed(1)}k/m²)`);
  }

  // Commute check
  if (profile.constraints.maxCommuteMinutes) {
    if (location.commuteToCenter > profile.constraints.maxCommuteMinutes) {
      score -= 20;
      reasons.push(`❌ Commute ${location.commuteToCenter} min > ${profile.constraints.maxCommuteMinutes} min`);
    } else if (location.commuteToCenter <= profile.constraints.maxCommuteMinutes * 0.5) {
      score += 10;
      reasons.push(`✅ Commute rápido (${location.commuteToCenter} min)`);
    }
  }

  // Work situation
  if (profile.household.workSituation === 'remote') {
    score += location.workFromHomeScore / 10;
    if (location.workFromHomeScore > 85) {
      reasons.push('🏠 Ideal para trabajo remoto');
    }
  } else if (profile.household.workSituation === 'office') {
    if (location.hasMetro) {
      score += 10;
      reasons.push('🚇 Buena conexión metro');
    }
  }

  // Family considerations
  if (profile.household.children.length > 0) {
    if (location.familyFriendly) {
      score += 15;
      reasons.push('👨‍👩‍👧 Zona familiar');
    } else {
      score -= 10;
    }
  }

  // Pet considerations
  if (profile.household.pets.length > 0) {
    if (location.petFriendly && location.greenSpace === 'high') {
      score += 15;
      reasons.push('🐕 Zonas verdes para mascotas');
    } else if (!location.petFriendly) {
      score -= 10;
    }
  }

  // Tradeoffs: Space vs Location
  if (profile.tradeoffs.spaceVsLocation < -2) {
    // Prefers space
    if (location.type === 'suburban' || location.type === 'rural') {
      score += 15;
      reasons.push('📐 Más espacio por precio');
    }
  } else if (profile.tradeoffs.spaceVsLocation > 2) {
    // Prefers location
    if (location.type === 'central') {
      score += 15;
      reasons.push('📍 Ubicación céntrica');
    }
  }

  // Tradeoffs: Quiet vs Vibrant
  if (profile.tradeoffs.quietVsVibrant < -2) {
    // Prefers quiet
    if (location.noise === 'low') {
      score += 10;
      reasons.push('🤫 Zona tranquila');
    } else if (location.noise === 'high') {
      score -= 15;
    }
  } else if (profile.tradeoffs.quietVsVibrant > 2) {
    // Prefers vibrant
    if (location.nightlife === 'high') {
      score += 10;
      reasons.push('🎉 Ambiente animado');
    }
  }

  // Dealbreakers
  const dealbreakers = profile.lifestyle.dealbreakers.map(d => d.toLowerCase());
  if (dealbreakers.includes('ruido') || dealbreakers.includes('ruido de calle')) {
    if (location.noise === 'high') {
      score -= 30;
      reasons.push('❌ Zona ruidosa (dealbreaker)');
    }
  }

  // Must-haves
  const mustHaves = profile.lifestyle.mustHaves.map(m => m.toLowerCase());
  if (mustHaves.includes('terraza') || mustHaves.includes('jardín')) {
    if (location.type === 'suburban') {
      score += 10;
      reasons.push('✅ Más opciones con exterior');
    }
  }

  // User preferences
  const preferred = profile.propertyPreferences.preferredLocations.map(l => l.toLowerCase());
  const avoid = profile.propertyPreferences.avoidLocations.map(l => l.toLowerCase());
  
  if (preferred.includes(location.name.toLowerCase())) {
    score += 25;
    reasons.push('⭐ Zona preferida');
  }
  
  if (avoid.includes(location.name.toLowerCase())) {
    score -= 50;
    reasons.push('🚫 Zona a evitar');
  }

  // Normalize score to 0-100
  score = Math.max(0, Math.min(100, score));

  return { score, reasons };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generate a Sweet Spot based on the user's life profile.
 * Returns ranked locations with scores and reasons.
 */
export async function generateSweetSpot(profile: LifeProfile): Promise<SweetSpot> {
  console.log('[SweetSpot] Generating for profile:', {
    budget: profile.constraints.maxBudget,
    workSituation: profile.household.workSituation,
    hasKids: profile.household.children.length > 0,
    hasPets: profile.household.pets.length > 0,
    preferredLocations: profile.propertyPreferences.preferredLocations,
  });

  // Score all locations
  const scoredLocations: LocationScore[] = MADRID_LOCATIONS.map(location => {
    const { score, reasons } = scoreLocation(location, profile);
    return {
      name: location.name,
      score,
      reasons,
      commuteMinutes: location.commuteToCenter,
      avgPricePerSqm: location.avgPricePerSqm,
    };
  });

  // Sort by score
  scoredLocations.sort((a, b) => b.score - a.score);

  // Split into tiers
  const primary = scoredLocations.filter(l => l.score >= 70);
  const secondary = scoredLocations.filter(l => l.score >= 50 && l.score < 70);
  const avoid = scoredLocations.filter(l => l.score < 50);

  const sweetSpot: SweetSpot = {
    primary: primary.slice(0, 5),
    secondary: secondary.slice(0, 5),
    avoid: avoid.slice(0, 3),
    generatedAt: new Date().toISOString(),
  };

  console.log('[SweetSpot] Generated:', {
    primary: sweetSpot.primary.map(l => `${l.name} (${l.score})`),
    secondary: sweetSpot.secondary.map(l => `${l.name} (${l.score})`),
    avoid: sweetSpot.avoid.map(l => `${l.name} (${l.score})`),
  });

  return sweetSpot;
}

/**
 * Get location names for DynamoDB filtering
 */
export function getSweetSpotLocations(sweetSpot: SweetSpot): string[] {
  return [
    ...sweetSpot.primary.map(l => l.name),
    ...sweetSpot.secondary.map(l => l.name),
  ];
}

