/**
 * Life Profile API Endpoint
 * 
 * GET  - Get current user's life profile
 * POST - Create/update life profile
 * 
 * Part of R1: Life Profile Intake
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { 
  LifeProfile, 
  CreateProfileRequest,
  DEFAULT_LIFE_PROFILE 
} from '@/types/recommender';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Transform database row to LifeProfile
 */
function rowToProfile(row: any): LifeProfile {
  return {
    id: row.id,
    userId: row.user_id,
    household: {
      adults: row.adults || 1,
      children: row.children || [],
      pets: row.pets || [],
      workSituation: row.work_situation || 'hybrid',
    },
    lifestyle: {
      morningRoutine: row.morning_routine || '',
      eveningRoutine: row.evening_routine || '',
      weekendActivities: row.weekend_activities || [],
      dealbreakers: row.dealbreakers || [],
      mustHaves: row.must_haves || [],
    },
    constraints: {
      maxBudget: row.max_budget || 400000,
      maxCommuteMinutes: row.max_commute_minutes || 30,
      commuteDestination: row.commute_destination || '',
      moveInDate: row.move_in_date,
      renovationAppetite: row.renovation_appetite || 'cosmetic',
    },
    tradeoffs: {
      spaceVsLocation: row.tradeoff_space_vs_location || 0,
      newVsCharacter: row.tradeoff_new_vs_character || 0,
      quietVsVibrant: row.tradeoff_quiet_vs_vibrant || 0,
      viewsVsPrivacy: row.tradeoff_views_vs_privacy || 0,
    },
    propertyPreferences: {
      propertyTypes: row.property_types || ['piso'],
      minBedrooms: row.min_bedrooms || 2,
      minBathrooms: row.min_bathrooms || 1,
      minSqm: row.min_sqm || 60,
      preferredLocations: row.preferred_locations || [],
      avoidLocations: row.avoid_locations || [],
    },
    intakeCompleted: row.intake_completed || false,
    intakeStep: row.intake_step || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Transform LifeProfile to database row
 */
function profileToRow(profile: Partial<LifeProfile>, userId?: string): any {
  const row: any = {};
  
  if (userId) row.user_id = userId;
  
  if (profile.household) {
    row.adults = profile.household.adults;
    row.children = profile.household.children;
    row.pets = profile.household.pets;
    row.work_situation = profile.household.workSituation;
  }
  
  if (profile.lifestyle) {
    row.morning_routine = profile.lifestyle.morningRoutine;
    row.evening_routine = profile.lifestyle.eveningRoutine;
    row.weekend_activities = profile.lifestyle.weekendActivities;
    row.dealbreakers = profile.lifestyle.dealbreakers;
    row.must_haves = profile.lifestyle.mustHaves;
  }
  
  if (profile.constraints) {
    row.max_budget = profile.constraints.maxBudget;
    row.max_commute_minutes = profile.constraints.maxCommuteMinutes;
    row.commute_destination = profile.constraints.commuteDestination;
    row.move_in_date = profile.constraints.moveInDate;
    row.renovation_appetite = profile.constraints.renovationAppetite;
  }
  
  if (profile.tradeoffs) {
    row.tradeoff_space_vs_location = profile.tradeoffs.spaceVsLocation;
    row.tradeoff_new_vs_character = profile.tradeoffs.newVsCharacter;
    row.tradeoff_quiet_vs_vibrant = profile.tradeoffs.quietVsVibrant;
    row.tradeoff_views_vs_privacy = profile.tradeoffs.viewsVsPrivacy;
  }
  
  if (profile.propertyPreferences) {
    row.property_types = profile.propertyPreferences.propertyTypes;
    row.min_bedrooms = profile.propertyPreferences.minBedrooms;
    row.min_bathrooms = profile.propertyPreferences.minBathrooms;
    row.min_sqm = profile.propertyPreferences.minSqm;
    row.preferred_locations = profile.propertyPreferences.preferredLocations;
    row.avoid_locations = profile.propertyPreferences.avoidLocations;
  }
  
  if (profile.intakeCompleted !== undefined) {
    row.intake_completed = profile.intakeCompleted;
  }
  
  if (profile.intakeStep !== undefined) {
    row.intake_step = profile.intakeStep;
  }
  
  return row;
}

/**
 * GET /api/recommender/profile
 * 
 * Query params:
 * - profileId: Get specific profile by ID
 * - userId: Get profile by user ID (for authenticated users)
 * 
 * Without params: Returns first profile (for demo/testing)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');
    const userId = searchParams.get('userId');
    
    let query = supabase
      .from('user_lifestyle_profiles')
      .select('*');
    
    if (profileId) {
      query = query.eq('id', profileId);
    } else if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false }).limit(1).single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No profile found
        return NextResponse.json({
          success: true,
          profile: null,
          message: 'No profile found',
        });
      }
      throw error;
    }
    
    return NextResponse.json({
      success: true,
      profile: rowToProfile(data),
    });
    
  } catch (error: any) {
    console.error('[Profile API] GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/recommender/profile
 * 
 * Create or update a life profile.
 * 
 * Body:
 * - profileId?: string - If provided, updates existing profile
 * - userId?: string - Associate with user
 * - household?: {...}
 * - lifestyle?: {...}
 * - constraints?: {...}
 * - tradeoffs?: {...}
 * - propertyPreferences?: {...}
 * - intakeCompleted?: boolean
 * - intakeStep?: number
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId, userId, ...profileData } = body;
    
    console.log('[Profile API] POST request:', { profileId, userId, hasData: !!profileData });
    
    // Transform to database row format
    const row = profileToRow(profileData, userId);
    
    let result;
    
    if (profileId) {
      // Update existing profile
      const { data, error } = await supabase
        .from('user_lifestyle_profiles')
        .update(row)
        .eq('id', profileId)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
      
      console.log('[Profile API] Updated profile:', profileId);
    } else {
      // Create new profile
      const { data, error } = await supabase
        .from('user_lifestyle_profiles')
        .insert(row)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
      
      console.log('[Profile API] Created profile:', result.id);
    }
    
    return NextResponse.json({
      success: true,
      profile: rowToProfile(result),
      message: profileId ? 'Profile updated' : 'Profile created',
    });
    
  } catch (error: any) {
    console.error('[Profile API] POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save profile' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/recommender/profile?profileId=xxx
 * 
 * Delete a profile
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');
    
    if (!profileId) {
      return NextResponse.json(
        { success: false, error: 'profileId is required' },
        { status: 400 }
      );
    }
    
    const { error } = await supabase
      .from('user_lifestyle_profiles')
      .delete()
      .eq('id', profileId);
    
    if (error) throw error;
    
    console.log('[Profile API] Deleted profile:', profileId);
    
    return NextResponse.json({
      success: true,
      message: 'Profile deleted',
    });
    
  } catch (error: any) {
    console.error('[Profile API] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete profile' },
      { status: 500 }
    );
  }
}

