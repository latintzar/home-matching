/**
 * Recommender System Types
 * 
 * These types define the data structures for the Leo Recommender,
 * which matches buyers to properties based on lifestyle, not just filters.
 */

// ============================================================================
// Life Profile Types
// ============================================================================

export interface Child {
  age: number;
  name?: string;
}

export interface Pet {
  type: 'dog' | 'cat' | 'bird' | 'fish' | 'other';
  size: 'small' | 'medium' | 'large';
  name?: string;
}

export type WorkSituation = 'remote' | 'hybrid' | 'office' | 'retired' | 'other';
export type RenovationAppetite = 'turnkey' | 'cosmetic' | 'full' | 'any';

export interface Household {
  adults: number;
  children: Child[];
  pets: Pet[];
  workSituation: WorkSituation;
}

export interface LifestyleDNA {
  morningRoutine: string;      // "Coffee on balcony", "Gym at 6am"
  eveningRoutine: string;      // "Cook elaborate meals", "Netflix"
  weekendActivities: string[]; // ["hiking", "hosting friends"]
  dealbreakers: string[];      // ["no natural light", "street noise"]
  mustHaves: string[];         // ["outdoor space", "quiet street"]
}

export interface Constraints {
  maxBudget: number;
  maxCommuteMinutes: number;
  commuteDestination: string;
  moveInDate: string | null;
  renovationAppetite: RenovationAppetite;
}

export interface Tradeoffs {
  spaceVsLocation: number;     // -5 (prefer space) to +5 (prefer location)
  newVsCharacter: number;      // -5 (prefer new) to +5 (prefer character)
  quietVsVibrant: number;      // -5 (prefer quiet) to +5 (prefer vibrant)
  viewsVsPrivacy: number;      // -5 (prefer views) to +5 (prefer privacy)
}

export interface PropertyPreferences {
  propertyTypes: string[];     // ['piso', 'casa', 'chalet']
  minBedrooms: number;
  minBathrooms: number;
  minSqm: number;
  preferredLocations: string[];
  avoidLocations: string[];
}

export interface ProfileCompleteness {
  // Minimum requirements (MUST have for any recommendations)
  hasBudget: boolean;          // Must know price range
  hasLocation: boolean;        // Must know general area
  hasHouseholdSize: boolean;   // Must know how many people
  
  // Nice to have (improves recommendations)
  hasWorkSituation: boolean;
  hasCommute: boolean;
  hasDealbreakers: boolean;
  hasMustHaves: boolean;
  hasTradeoffs: boolean;
  
  // Computed
  minimumMet: boolean;         // Can we give ANY recommendations?
  completenessScore: number;   // 0-100 how complete the profile is
  missingFields: string[];     // What we still don't know
}

export interface LifeProfile {
  id?: string;
  sessionId?: string;
  userId?: string;
  
  household: Household;
  lifestyle: LifestyleDNA;
  constraints: Constraints;
  tradeoffs: Tradeoffs;
  propertyPreferences: PropertyPreferences;
  
  // Intake progress
  intakeCompleted: boolean;
  intakeStep: number;
  
  // Completeness tracking (for partial profiles)
  completeness?: ProfileCompleteness;
  
  // Voice intake data
  voiceConversationId?: string;
  voiceTranscript?: string;
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// Match Types
// ============================================================================

export interface ScoreBreakdown {
  naturalLight: number;   // 0-100
  noise: number;          // 0-100
  space: number;          // 0-100
  outdoorSpace: number;   // 0-100
  condition: number;      // 0-100
  layout: number;         // 0-100
  location: number;       // 0-100
  commute: number;        // 0-100
}

export interface Match {
  id: string;
  profileId: string;
  listingId: string;
  
  fitScore: number;            // 0-100 overall
  scoreBreakdown: ScoreBreakdown;
  topReasons: string[];        // ["☀️ Exceptional natural light", ...]
  concerns: string[];          // ["⚠️ Kitchen needs updating"]
  
  status: 'suggested' | 'saved' | 'dismissed' | 'contacted';
  
  createdAt: string;
  updatedAt: string;
}

export interface MatchFeedback {
  id: string;
  matchId: string;
  feedbackType: 'like' | 'dislike' | 'save' | 'dismiss' | 'contact';
  reason?: string;
  createdAt: string;
}

// ============================================================================
// Sweet Spot Types (Geo-Intelligence)
// ============================================================================

export interface LocationScore {
  name: string;
  score: number;
  reasons: string[];
  commuteMinutes?: number;
  avgPricePerSqm?: number;
}

export interface SweetSpot {
  primary: LocationScore[];
  secondary: LocationScore[];
  avoid: LocationScore[];
  generatedAt: string;
}

// ============================================================================
// API Types
// ============================================================================

export interface CreateProfileRequest {
  household?: Partial<Household>;
  lifestyle?: Partial<LifestyleDNA>;
  constraints?: Partial<Constraints>;
  tradeoffs?: Partial<Tradeoffs>;
  propertyPreferences?: Partial<PropertyPreferences>;
}

export interface UpdateProfileRequest {
  profileId: string;
  updates: Partial<LifeProfile>;
}

export interface GetMatchesRequest {
  profileId: string;
  limit?: number;
  offset?: number;
  status?: Match['status'];
}

export interface GetMatchesResponse {
  matches: Match[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// Intake Form Types
// ============================================================================

export type IntakeStep = 
  | 'household'
  | 'lifestyle'
  | 'constraints'
  | 'tradeoffs'
  | 'property-preferences'
  | 'review';

export interface IntakeFormState {
  currentStep: IntakeStep;
  stepIndex: number;
  totalSteps: number;
  data: Partial<LifeProfile>;
  errors: Record<string, string>;
  isValid: boolean;
}

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_HOUSEHOLD: Household = {
  adults: 1,
  children: [],
  pets: [],
  workSituation: 'hybrid',
};

export const DEFAULT_LIFESTYLE: LifestyleDNA = {
  morningRoutine: '',
  eveningRoutine: '',
  weekendActivities: [],
  dealbreakers: [],
  mustHaves: [],
};

export const DEFAULT_CONSTRAINTS: Constraints = {
  maxBudget: 400000,
  maxCommuteMinutes: 30,
  commuteDestination: '',
  moveInDate: null,
  renovationAppetite: 'cosmetic',
};

export const DEFAULT_TRADEOFFS: Tradeoffs = {
  spaceVsLocation: 0,
  newVsCharacter: 0,
  quietVsVibrant: 0,
  viewsVsPrivacy: 0,
};

export const DEFAULT_PROPERTY_PREFERENCES: PropertyPreferences = {
  propertyTypes: ['piso'],
  minBedrooms: 2,
  minBathrooms: 1,
  minSqm: 60,
  preferredLocations: [],
  avoidLocations: [],
};

export const DEFAULT_LIFE_PROFILE: LifeProfile = {
  household: DEFAULT_HOUSEHOLD,
  lifestyle: DEFAULT_LIFESTYLE,
  constraints: DEFAULT_CONSTRAINTS,
  tradeoffs: DEFAULT_TRADEOFFS,
  propertyPreferences: DEFAULT_PROPERTY_PREFERENCES,
  intakeCompleted: false,
  intakeStep: 0,
};

// ============================================================================
// Profile Completeness Helper
// ============================================================================

export function calculateCompleteness(profile: Partial<LifeProfile>): ProfileCompleteness {
  const result: ProfileCompleteness = {
    hasBudget: false,
    hasLocation: false,
    hasHouseholdSize: false,
    hasWorkSituation: false,
    hasCommute: false,
    hasDealbreakers: false,
    hasMustHaves: false,
    hasTradeoffs: false,
    minimumMet: false,
    completenessScore: 0,
    missingFields: [],
  };
  
  // Check minimum requirements
  result.hasBudget = (profile.constraints?.maxBudget ?? 0) > 0;
  result.hasLocation = (profile.propertyPreferences?.preferredLocations?.length ?? 0) > 0 || 
                       (profile.constraints?.commuteDestination?.length ?? 0) > 0;
  result.hasHouseholdSize = (profile.household?.adults ?? 0) > 0;
  
  // Check nice-to-haves
  result.hasWorkSituation = profile.household?.workSituation !== undefined && 
                            profile.household.workSituation !== 'other';
  result.hasCommute = (profile.constraints?.maxCommuteMinutes ?? 0) > 0 && 
                      (profile.constraints?.commuteDestination?.length ?? 0) > 0;
  result.hasDealbreakers = (profile.lifestyle?.dealbreakers?.length ?? 0) > 0;
  result.hasMustHaves = (profile.lifestyle?.mustHaves?.length ?? 0) > 0;
  result.hasTradeoffs = profile.tradeoffs !== undefined && 
                        Object.values(profile.tradeoffs).some(v => v !== 0);
  
  // Calculate minimum met (need budget + location OR household)
  result.minimumMet = result.hasBudget && (result.hasLocation || result.hasHouseholdSize);
  
  // Calculate completeness score
  const fields = [
    result.hasBudget,
    result.hasLocation,
    result.hasHouseholdSize,
    result.hasWorkSituation,
    result.hasCommute,
    result.hasDealbreakers,
    result.hasMustHaves,
    result.hasTradeoffs,
  ];
  result.completenessScore = Math.round((fields.filter(Boolean).length / fields.length) * 100);
  
  // Track missing fields for UI/notifications
  if (!result.hasBudget) result.missingFields.push('presupuesto');
  if (!result.hasLocation) result.missingFields.push('zona');
  if (!result.hasHouseholdSize) result.missingFields.push('número de personas');
  if (!result.hasWorkSituation) result.missingFields.push('situación laboral');
  if (!result.hasCommute) result.missingFields.push('commute');
  if (!result.hasDealbreakers) result.missingFields.push('lo que no quieres');
  if (!result.hasMustHaves) result.missingFields.push('lo que necesitas');
  
  return result;
}

