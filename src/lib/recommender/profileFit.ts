import type {LifeProfile} from '@/types/recommender';
import type {UserFitProfile} from './fitScoringV2';

export function convertToUserFitProfile(profile: LifeProfile): UserFitProfile {
  // Map LifeProfile weights to FitScoring V2 weights
  const weights: Partial<Record<string, number>> = {};

  // Natural light
  if (profile.lifestyle.mustHaves.some(m => m.toLowerCase().includes('luz') || m.toLowerCase().includes('light'))) {
    weights.natural_light_intensity = 2.0;
    weights.light_distribution = 1.5;
  }

  // Quiet
  if (profile.lifestyle.dealbreakers.some(d => d.toLowerCase().includes('ruido') || d.toLowerCase().includes('noise'))) {
    weights.neighborhood_quietness = 2.0;
    weights.street_exposure = 1.5;
  }

  // Outdoor space
  if (profile.lifestyle.mustHaves.some(m => m.toLowerCase().includes('terraza') || m.toLowerCase().includes('jardín'))) {
    weights.outdoor_space_quality = 2.0;
  }

  // WFH
  if (profile.household.workSituation === 'remote') {
    weights.wfh_potential = 2.0;
    weights.natural_light_intensity = Math.max(weights.natural_light_intensity || 1, 1.5);
  }

  // Condition
  if (profile.constraints.renovationAppetite === 'turnkey') {
    weights.renovation_state = 2.0;
    weights.signs_of_aging = 1.5;
  }

  return {
    weights,
    dealbreakers: {
      cubicle_bathroom: profile.lifestyle.dealbreakers.some(d =>
        d.toLowerCase().includes('baño pequeño') || d.toLowerCase().includes('cubicle')
      ),
      mezzanine_ladder: profile.lifestyle.dealbreakers.some(d =>
        d.toLowerCase().includes('altillo') || d.toLowerCase().includes('mezzanine')
      ),
      needs_full_renovation: profile.constraints.renovationAppetite === 'turnkey',
      ground_floor_exposed: profile.lifestyle.dealbreakers.some(d =>
        d.toLowerCase().includes('bajo') || d.toLowerCase().includes('ground floor')
      ),
      is_house_share: true, // Most users don't want shared
      no_natural_light: true, // Universal dealbreaker
    },
    must_haves: {},
    has_children: profile.household.children.length > 0,
    planning_children: false, // Would need explicit flag in profile
    has_pets: profile.household.pets.length > 0,
    works_from_home: profile.household.workSituation === 'remote',
    living_alone: profile.household.adults === 1,
    has_mobility_needs: false, // Would need explicit flag
    has_vision_impairment: false,
    is_elderly: false,
  };
}
