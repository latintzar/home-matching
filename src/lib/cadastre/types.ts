export interface CadastreUnit {
  refCat: string;
  address: string;
  floor?: string;
  door?: string;
  stair?: string;
  usage?: string;
  surfaceConstructed?: number;
  yearBuilt?: number;
  livingArea?: number;
  commonArea?: number;
  storageArea?: number;
  class?: string;
}

export type CertaintyLevel =
  | 'EXACT_MATCH'
  | 'HIGH_PROBABILITY'
  | 'BUILDING_CONTEXT'
  | 'BLOCK_CONTEXT'
  | 'NEIGHBORHOOD_CONTEXT' // Added this
  | 'NONE';

export interface Level1Data {
    // Neighborhood Vibe
    scope: 'Neighborhood';
    description: string; // "Gràcia (Old, Dense)"
    averageYear: number;
    dominantUse: string;
    ageRange: { min: number, max: number };
    sampleSize: number;
}

export interface Level2Data {
    // Block/Street Context
    scope: 'Block/Street';
    streetName: string;
    averageYear: number;
    dominantUse: string;
    sampleSize: number;
    trend: string; // "Newer than neighborhood" or "Typical"
}

export interface Level3Data {
    // Building/Parcel Context
    scope: 'Building';
    refCatParcel: string;
    totalUnits: number;
    yearBuiltMostCommon: number;
    dominantUse: string;
    structureType: string; // "Concrete frame, 1970" (inferred)
}

export interface Level4Data {
    // Specific Unit
    scope: 'Unit';
    unit: CadastreUnit;
    legalReality: string; // "Office use" or "Residential"
}

export interface TruthReport {
  found: boolean;
  certainty: CertaintyLevel;
  
  // The 4 Levels
  level1?: Level1Data;
  level2?: Level2Data;
  level3?: Level3Data;
  level4?: Level4Data;
  
  discrepancies: string[];
  warnings: string[];
}

export interface ListingInput {
  address?: string;
  coordinates?: { lat: number; lng: number };
  claimedSize?: number;
  claimedYear?: number;
  claimedFloor?: string;
  claimedType?: string;
}
