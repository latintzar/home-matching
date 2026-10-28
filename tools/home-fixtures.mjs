/** Authored example inputs. Prices are fictional purchase amounts in EUR. */
export const fixtureVersion = 'authored-home-matching-v1';
export const scoreKeys = [
  'natural_light_intensity', 'light_distribution', 'cross_ventilation',
  'ceiling_height', 'window_quality', 'entrance_experience',
  'kitchen_living_relationship', 'bathroom_privacy', 'bedroom_seclusion',
  'flow_for_entertaining', 'furniture_feasibility', 'two_person_living',
  'escape_room_potential', 'counter_space', 'appliance_quality',
  'kitchen_storage', 'cooking_ventilation', 'bathroom_functionality',
  'bedroom_size_fit', 'closet_storage', 'morning_light_bedroom',
  'renovation_state', 'signs_of_aging', 'kitchen_modernity',
  'bathroom_modernity', 'cozy_corner_potential', 'wfh_potential',
  'outdoor_space_quality', 'balcony_security', 'storage_total',
  'guest_hosting', 'view_quality', 'street_exposure',
  'floor_level_safety', 'building_position',
];

export function exampleAnalysis(id, overrides, extras = {}) {
  return {
    listing_id: id,
    scores: {...Object.fromEntries(scoreKeys.map(name => [name, 65])), ...overrides},
    flags: {
      has_cubicle_bathroom: false, has_mezzanine: false,
      needs_full_renovation: false, ground_floor_exposed: false,
      is_house_share: false, no_natural_light: false,
      no_kitchen: false, no_bathroom: false,
    },
    safety_flags: {
      child_hazards: [], elderly_hazards: [],
      accessibility_issues: [], pet_hazards: [],
    },
    standouts: [], concerns: [], confidence: 'high',
    scoredAt: '2000-01-01T00:00:00.000Z',
    ...extras,
  };
}

const common = {
  weights: {}, dealbreakers: {is_house_share: true}, must_haves: {},
  has_children: false, planning_children: false, has_pets: false,
  works_from_home: false, living_alone: false, has_mobility_needs: false,
  has_vision_impairment: false, is_elderly: false,
};

export const profiles = {
  homeOffice: {
    ...common, works_from_home: true,
    weights: {
      wfh_potential: 2, natural_light_intensity: 1.5,
      outdoor_space_quality: 0, neighborhood_quietness: 2,
      neighborhood_wfh: 2,
    },
  },
  outdoorSpace: {
    ...common, has_pets: true,
    weights: {
      wfh_potential: 0, natural_light_intensity: 2,
      outdoor_space_quality: 2, neighborhood_quietness: 0,
      neighborhood_wfh: 0,
    },
  },
};

export const prefilterProfile = {
  budget: {max: 260000}, preferredLocations: ['Ciudad Ejemplo'],
  avoidLocations: [], minSqm: 60, minBedrooms: 2,
};

export const homes = [
  {
    listing: {
      id: 'synthetic-courtyard', title: 'Courtyard example',
      price: 210000, sqm: 72, bedrooms: 2, bathrooms: 1,
      city: 'Ciudad Ejemplo', neighborhood: 'Patio',
    },
    wpa: exampleAnalysis('synthetic-courtyard', {
      natural_light_intensity: 70, wfh_potential: 95,
      outdoor_space_quality: 10, street_exposure: 90,
    }, {standouts: ['Dedicated workspace']}),
    neighborhood: {scores: {
      quietness: 95, safety_overall: 75, digital_nomad: 90, family_friendly: 70,
    }},
  },
  {
    listing: {
      id: 'synthetic-terrace', title: 'Terrace example',
      price: 245000, sqm: 65, bedrooms: 2, bathrooms: 1,
      city: 'Ciudad Ejemplo', neighborhood: 'Terraza',
    },
    wpa: exampleAnalysis('synthetic-terrace', {
      natural_light_intensity: 95, wfh_potential: 35,
      outdoor_space_quality: 95, street_exposure: 60,
    }, {standouts: ['Bright terrace'], concerns: ['Street noise']}),
    neighborhood: {scores: {
      quietness: 60, safety_overall: 75, digital_nomad: 60, family_friendly: 70,
    }},
  },
  {
    listing: {
      id: 'synthetic-share', title: 'Shared-home example',
      price: 180000, sqm: 68, bedrooms: 2, bathrooms: 1,
      city: 'Ciudad Ejemplo', neighborhood: 'Centro',
    },
    wpa: exampleAnalysis('synthetic-share', {
      natural_light_intensity: 85, wfh_potential: 70, outdoor_space_quality: 40,
    }, {flags: {
      has_cubicle_bathroom: false, has_mezzanine: false,
      needs_full_renovation: false, ground_floor_exposed: false,
      is_house_share: true, no_natural_light: false,
      no_kitchen: false, no_bathroom: false,
    }}),
    neighborhood: {scores: {
      quietness: 70, safety_overall: 75, digital_nomad: 70, family_friendly: 70,
    }},
  },
];

export function freezeTree(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') freezeTree(child);
  }
  return Object.freeze(value);
}
