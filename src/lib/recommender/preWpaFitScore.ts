/**
 * Pre-WPA Fit Scoring
 * 
 * FREE algorithmic pre-filtering before running expensive WPA.
 * 
 * Use this to:
 * 1. Filter out obviously bad matches (save WPA costs)
 * 2. Rank candidates before WPA (run WPA on best first)
 * 3. Provide instant feedback while WPA runs
 * 
 * Based on:
 * - Basic listing attributes (price, size, location)
 * - User profile constraints
 * - Pre-computed enriched data (cadastre, rental yield, etc.)
 * 
 * Cost: FREE (pure computation)
 * Latency: <1ms per listing
 */

// ============================================================================
// Types
// ============================================================================

export interface ListingAttributes {
  listing_id: string;
  price: number;
  sqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  floor?: number;
  has_elevator?: boolean;
  has_terrace?: boolean;
  has_parking?: boolean;
  year_built?: number;
  city?: string;
  neighborhood?: string;
  district?: string;
  lat?: number;
  lng?: number;
  transaction_type: 'rent' | 'sale';
  
  // Pre-computed enriched data (from nightly pipeline)
  enriched?: {
    cadastre_official_m2?: number;
    cadastre_year_built?: number;
    rental_yield_pct?: number;
    price_vs_neighborhood?: number;  // % difference from avg
    sqm_discrepancy?: number;        // Listed vs cadastre
    building_age_years?: number;
    is_potential_gem?: boolean;
    neighborhood_noise_score?: number;
    neighborhood_safety_score?: number;
  };
}

export interface UserSearchProfile {
  // Budget
  budget: {
    min?: number;
    max: number;
  };
  
  // Location
  preferredLocations: string[];
  avoidLocations: string[];
  commuteDestination?: {
    lat: number;
    lng: number;
    maxMinutes: number;
  };
  
  // Property requirements
  minSqm?: number;
  maxSqm?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  
  // Preferences
  wantsParking?: boolean;
  wantsTerrace?: boolean;
  wantsElevator?: boolean;
  maxFloor?: number;
  minFloor?: number;
  
  // Building age
  maxBuildingAge?: number;  // e.g., 30 = built after 1994
  
  // For buyers
  isBuyer?: boolean;
  minRentalYield?: number;
  seekingUndervalued?: boolean;
  
  // Deal-breakers
  avoidGroundFloor?: boolean;
  avoidTopFloor?: boolean;
}

export interface PreWpaFitResult {
  listing_id: string;
  score: number;              // 0-100
  pass: boolean;              // Score >= threshold (default 40)
  reasons: string[];          // Why it scores this way
  concerns: string[];         // Potential issues
  priority: 'high' | 'medium' | 'low';  // For WPA ordering
  
  // Budget info
  budgetStatus: 'under' | 'within' | 'at_limit' | 'over';
  
  // Location match
  locationMatch: 'preferred' | 'neutral' | 'avoid' | 'unknown';
  
  // Size match
  sizeMatch: 'exceeds' | 'meets' | 'close' | 'under' | 'unknown';
  
  // For buyers: investment potential
  investmentScore?: number;
}

// ============================================================================
// Score Calculation
// ============================================================================

/**
 * Calculate pre-WPA fit score
 * This is FREE - no API calls!
 */
export function calculatePreWpaFitScore(
  listing: ListingAttributes,
  profile: UserSearchProfile,
  threshold: number = 40
): PreWpaFitResult {
  let score = 50;  // Start neutral
  const reasons: string[] = [];
  const concerns: string[] = [];
  
  // =========================================================================
  // 1. BUDGET (0-30 points)
  // =========================================================================
  let budgetStatus: PreWpaFitResult['budgetStatus'] = 'within';
  
  if (profile.budget.max) {
    const priceRatio = listing.price / profile.budget.max;
    
    if (priceRatio <= 0.7) {
      score += 25;
      budgetStatus = 'under';
      reasons.push('💰 Muy por debajo del presupuesto');
    } else if (priceRatio <= 0.9) {
      score += 20;
      budgetStatus = 'within';
      reasons.push('💰 Dentro del presupuesto');
    } else if (priceRatio <= 1.0) {
      score += 10;
      budgetStatus = 'at_limit';
      reasons.push('💰 En el límite del presupuesto');
    } else if (priceRatio <= 1.1) {
      score -= 10;
      budgetStatus = 'over';
      concerns.push('⚠️ Ligeramente sobre presupuesto');
    } else {
      score -= 25;
      budgetStatus = 'over';
      concerns.push('❌ Significativamente sobre presupuesto');
    }
  }
  
  // =========================================================================
  // 2. LOCATION (0-25 points)
  // =========================================================================
  let locationMatch: PreWpaFitResult['locationMatch'] = 'neutral';
  
  const locationStr = [
    listing.city,
    listing.neighborhood,
    listing.district
  ].filter(Boolean).join(' ').toLowerCase();
  
  if (profile.avoidLocations.some(loc => locationStr.includes(loc.toLowerCase()))) {
    score -= 25;
    locationMatch = 'avoid';
    concerns.push('❌ Zona a evitar');
  } else if (profile.preferredLocations.some(loc => locationStr.includes(loc.toLowerCase()))) {
    score += 25;
    locationMatch = 'preferred';
    reasons.push('📍 Zona preferida');
  } else if (locationStr) {
    locationMatch = 'neutral';
  } else {
    locationMatch = 'unknown';
  }
  
  // =========================================================================
  // 3. SIZE (0-20 points)
  // =========================================================================
  let sizeMatch: PreWpaFitResult['sizeMatch'] = 'unknown';
  
  // Use cadastre m² if available (more accurate)
  const sqm = listing.enriched?.cadastre_official_m2 || listing.sqm;
  
  if (sqm && profile.minSqm) {
    const sqmRatio = sqm / profile.minSqm;
    
    if (sqmRatio >= 1.3) {
      score += 20;
      sizeMatch = 'exceeds';
      reasons.push(`📐 ${sqm}m² - más que tu mínimo`);
    } else if (sqmRatio >= 1.0) {
      score += 15;
      sizeMatch = 'meets';
      reasons.push(`📐 ${sqm}m² - cumple mínimo`);
    } else if (sqmRatio >= 0.9) {
      score += 5;
      sizeMatch = 'close';
      concerns.push(`📐 ${sqm}m² - ligeramente menos`);
    } else {
      score -= 15;
      sizeMatch = 'under';
      concerns.push(`📐 ${sqm}m² - por debajo del mínimo`);
    }
    
    // Check for listing exaggeration
    if (listing.sqm && listing.enriched?.cadastre_official_m2) {
      const discrepancy = listing.sqm - listing.enriched.cadastre_official_m2;
      if (discrepancy > 10) {
        concerns.push(`⚠️ Anuncia ${listing.sqm}m² pero catastro dice ${listing.enriched.cadastre_official_m2}m²`);
      }
    }
  }
  
  if (profile.maxSqm && sqm && sqm > profile.maxSqm) {
    score -= 10;
    concerns.push(`📐 ${sqm}m² - más grande de lo deseado`);
  }
  
  // =========================================================================
  // 4. BEDROOMS (0-15 points)
  // =========================================================================
  
  if (profile.minBedrooms && listing.bedrooms) {
    if (listing.bedrooms >= profile.minBedrooms + 1) {
      score += 15;
      reasons.push(`🛏️ ${listing.bedrooms} hab - más de lo necesario`);
    } else if (listing.bedrooms >= profile.minBedrooms) {
      score += 10;
      reasons.push(`🛏️ ${listing.bedrooms} hab - suficientes`);
    } else {
      score -= 15;
      concerns.push(`🛏️ ${listing.bedrooms} hab - insuficientes`);
    }
  }
  
  if (profile.maxBedrooms && listing.bedrooms && listing.bedrooms > profile.maxBedrooms) {
    score -= 5;
    concerns.push(`🛏️ ${listing.bedrooms} hab - demasiadas`);
  }
  
  // =========================================================================
  // 5. BATHROOMS (0-10 points)
  // =========================================================================
  
  if (profile.minBathrooms && listing.bathrooms) {
    if (listing.bathrooms >= profile.minBathrooms) {
      score += 10;
      reasons.push(`🚿 ${listing.bathrooms} baños - suficientes`);
    } else {
      score -= 10;
      concerns.push(`🚿 ${listing.bathrooms} baños - insuficientes`);
    }
  }
  
  // =========================================================================
  // 6. FLOOR PREFERENCES (0-10 points)
  // =========================================================================
  
  if (listing.floor !== undefined) {
    // Ground floor
    if (profile.avoidGroundFloor && listing.floor === 0) {
      score -= 15;
      concerns.push('❌ Planta baja (a evitar)');
    }
    
    // Top floor
    if (profile.avoidTopFloor && listing.floor >= 6) {
      score -= 5;
      concerns.push('⚠️ Último piso (posible calor/problemas)');
    }
    
    // Min floor
    if (profile.minFloor && listing.floor < profile.minFloor) {
      score -= 10;
      concerns.push(`⚠️ Planta ${listing.floor} - prefieres más alto`);
    }
    
    // Max floor without elevator
    if (listing.floor >= 3 && listing.has_elevator === false) {
      score -= 10;
      concerns.push(`⚠️ Planta ${listing.floor} sin ascensor`);
    }
    
    // Elevator when wanted
    if (profile.wantsElevator && listing.has_elevator === true) {
      score += 5;
      reasons.push('🛗 Con ascensor');
    }
  }
  
  // =========================================================================
  // 7. AMENITIES (0-10 points each)
  // =========================================================================
  
  if (profile.wantsTerrace && listing.has_terrace) {
    score += 10;
    reasons.push('🌿 Con terraza');
  } else if (profile.wantsTerrace && listing.has_terrace === false) {
    score -= 5;
    concerns.push('Sin terraza');
  }
  
  if (profile.wantsParking && listing.has_parking) {
    score += 10;
    reasons.push('🚗 Con parking');
  } else if (profile.wantsParking && listing.has_parking === false) {
    score -= 5;
    concerns.push('Sin parking');
  }
  
  // =========================================================================
  // 8. BUILDING AGE (0-10 points)
  // =========================================================================
  
  const buildingAge = listing.enriched?.building_age_years || 
    (listing.year_built ? new Date().getFullYear() - listing.year_built : null);
  
  if (buildingAge !== null && profile.maxBuildingAge) {
    if (buildingAge <= profile.maxBuildingAge) {
      score += 10;
      reasons.push(`🏢 Edificio de ${listing.year_built || '?'} (${buildingAge} años)`);
    } else {
      score -= 5;
      concerns.push(`🏢 Edificio antiguo (${buildingAge} años)`);
    }
  }
  
  // =========================================================================
  // 9. BUYER INVESTMENT METRICS (0-20 points)
  // =========================================================================
  
  let investmentScore: number | undefined;
  
  if (profile.isBuyer && listing.enriched) {
    investmentScore = 50;  // Neutral start
    
    // Rental yield
    if (listing.enriched.rental_yield_pct !== undefined) {
      if (profile.minRentalYield && listing.enriched.rental_yield_pct >= profile.minRentalYield) {
        investmentScore += 20;
        score += 10;
        reasons.push(`📈 Rentabilidad ${listing.enriched.rental_yield_pct.toFixed(1)}%`);
      } else if (listing.enriched.rental_yield_pct >= 4) {
        investmentScore += 15;
        score += 5;
        reasons.push(`📈 Buena rentabilidad ${listing.enriched.rental_yield_pct.toFixed(1)}%`);
      }
    }
    
    // Price vs neighborhood
    if (listing.enriched.price_vs_neighborhood !== undefined) {
      const diff = listing.enriched.price_vs_neighborhood;
      
      if (diff <= -15) {
        investmentScore += 25;
        score += 10;
        reasons.push(`💎 ${Math.abs(diff)}% por debajo del mercado`);
      } else if (diff <= -5) {
        investmentScore += 15;
        score += 5;
        reasons.push(`📉 ${Math.abs(diff)}% bajo precio de zona`);
      } else if (diff >= 15) {
        investmentScore -= 15;
        score -= 5;
        concerns.push(`📈 ${diff}% por encima del mercado`);
      }
    }
    
    // Potential gem flag
    if (listing.enriched.is_potential_gem) {
      investmentScore += 15;
      score += 5;
      reasons.push('💎 Posible oportunidad de inversión');
    }
  }
  
  // =========================================================================
  // 10. NEIGHBORHOOD SCORES (from pre-computed data)
  // =========================================================================
  
  if (listing.enriched) {
    // Noise score (from Airbnb analysis)
    if (listing.enriched.neighborhood_noise_score !== undefined) {
      const noise = listing.enriched.neighborhood_noise_score;
      if (noise >= 70) {
        score += 5;
        reasons.push('🤫 Zona tranquila');
      } else if (noise <= 30) {
        score -= 5;
        concerns.push('🔊 Zona posiblemente ruidosa');
      }
    }
    
    // Safety score
    if (listing.enriched.neighborhood_safety_score !== undefined) {
      const safety = listing.enriched.neighborhood_safety_score;
      if (safety >= 70) {
        score += 5;
        reasons.push('🛡️ Zona segura');
      } else if (safety <= 30) {
        score -= 10;
        concerns.push('⚠️ Zona con posibles problemas de seguridad');
      }
    }
  }
  
  // =========================================================================
  // FINAL SCORE & PRIORITY
  // =========================================================================
  
  const finalScore = Math.max(0, Math.min(100, score));
  const pass = finalScore >= threshold;
  
  // Determine priority for WPA ordering
  let priority: PreWpaFitResult['priority'];
  if (finalScore >= 70) {
    priority = 'high';
  } else if (finalScore >= 50) {
    priority = 'medium';
  } else {
    priority = 'low';
  }
  
  return {
    listing_id: listing.listing_id,
    score: Math.round(finalScore),
    pass,
    reasons,
    concerns,
    priority,
    budgetStatus,
    locationMatch,
    sizeMatch,
    investmentScore,
  };
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Score multiple listings and sort by pre-WPA fit
 */
export function preFilterAndRankListings(
  listings: ListingAttributes[],
  profile: UserSearchProfile,
  options: {
    threshold?: number;          // Min score to pass (default 40)
    maxResults?: number;         // Max results to return
    includeFailures?: boolean;   // Include failing listings
  } = {}
): PreWpaFitResult[] {
  const {
    threshold = 40,
    maxResults,
    includeFailures = false,
  } = options;
  
  console.log(`[PreWPA] Scoring ${listings.length} listings...`);
  
  // Score all listings
  const results = listings.map(listing => 
    calculatePreWpaFitScore(listing, profile, threshold)
  );
  
  // Filter if needed
  let filtered = includeFailures 
    ? results 
    : results.filter(r => r.pass);
  
  // Sort by score (highest first), then by priority
  filtered.sort((a, b) => {
    if (a.priority !== b.priority) {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.score - a.score;
  });
  
  // Limit results
  if (maxResults) {
    filtered = filtered.slice(0, maxResults);
  }
  
  const passCount = results.filter(r => r.pass).length;
  console.log(`[PreWPA] ${passCount}/${listings.length} pass threshold (${threshold})`);
  console.log(`[PreWPA] Returning ${filtered.length} results`);
  
  return filtered;
}

/**
 * Get listings ordered by priority for WPA processing
 * High priority first, then medium, then low
 */
export function getWpaPriorityOrder(
  preWpaResults: PreWpaFitResult[]
): string[] {
  const sorted = [...preWpaResults].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  return sorted.map(r => r.listing_id);
}

// Types are already exported where they are defined

