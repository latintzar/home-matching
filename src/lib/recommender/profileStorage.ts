import type {LifeProfile} from '@/types/recommender';

export function rowToProfile(row: any): LifeProfile {
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
      maxBudget: row.max_budget || row.budget_max || 400000,
      maxCommuteMinutes: row.max_commute_minutes || 30,
      commuteDestination: row.commute_destination || row.work_location || '',
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
      minBedrooms: row.min_bedrooms || row.bedrooms_min || 2,
      minBathrooms: row.min_bathrooms || row.bathrooms_min || 1,
      minSqm: row.min_sqm || 60,
      preferredLocations: row.preferred_locations || row.preferred_areas || [],
      avoidLocations: row.avoid_locations || [],
    },
    intakeCompleted: row.intake_completed || false,
    intakeStep: row.intake_step || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
