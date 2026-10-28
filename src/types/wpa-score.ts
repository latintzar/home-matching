/** Original 35-dimension WPA contract, shared by provider routes and pure fit scoring. */
export interface WPAScores {
  listing_id: string;
  
  // === LIGHT & AIR (5 dimensions) ===
  scores: {
    natural_light_intensity: number | null;      // 0-100: Overall brightness
    light_distribution: number | null;           // 0-100: Even across rooms
    cross_ventilation: number | null;            // 0-100: Airflow potential
    ceiling_height: number | null;               // 0-100: Height impression
    window_quality: number | null;               // 0-100: Window size/type
    
    // === LAYOUT & FLOW (8 dimensions) ===
    entrance_experience: number | null;          // 0-100: First impression
    kitchen_living_relationship: number | null;  // 0-100: Open plan vs separate
    bathroom_privacy: number | null;             // 0-100: Not off living areas
    bedroom_seclusion: number | null;            // 0-100: Away from noise
    flow_for_entertaining: number | null;        // 0-100: Social gatherings
    furniture_feasibility: number | null;        // 0-100: Room shapes/sizes
    two_person_living: number | null;            // 0-100: Space for couple
    escape_room_potential: number | null;        // 0-100: Private retreat
    
    // === KITCHEN (4 dimensions) ===
    counter_space: number | null;                // 0-100: Prep area
    appliance_quality: number | null;            // 0-100: Appliance modernity
    kitchen_storage: number | null;              // 0-100: Cabinets/pantry
    cooking_ventilation: number | null;          // 0-100: Range hood/window
    
    // === BATHROOM & BEDROOM (4 dimensions) ===
    bathroom_functionality: number | null;       // 0-100: Layout/fixtures
    bedroom_size_fit: number | null;             // 0-100: King bed + furniture
    closet_storage: number | null;               // 0-100: Built-in closets
    morning_light_bedroom: number | null;        // 0-100: East-facing?
    
    // === CONDITION (4 dimensions) ===
    renovation_state: number | null;             // 0-100: Move-in ready vs needs work
    signs_of_aging: number | null;               // 0-100: Wear visible
    kitchen_modernity: number | null;            // 0-100: Kitchen age
    bathroom_modernity: number | null;           // 0-100: Bathroom age
    
    // === COMFORT & LIFESTYLE (6 dimensions) ===
    cozy_corner_potential: number | null;        // 0-100: Reading nook spots
    wfh_potential: number | null;                // 0-100: Home office space
    outdoor_space_quality: number | null;        // 0-100: Balcony/terrace
    balcony_security: number | null;             // 0-100: For pets/kids
    storage_total: number | null;                // 0-100: Overall storage
    guest_hosting: number | null;                // 0-100: Guest bedroom/sofa
    
    // === VIEWS & EXPOSURE (4 dimensions) ===
    view_quality: number | null;                 // 0-100: What you see
    street_exposure: number | null;              // 0-100: Noise/privacy risk (inverted)
    floor_level_safety: number | null;           // 0-100: Ground floor risk (inverted)
    building_position: number | null;            // 0-100: Interior vs exterior
  };
  
  // Binary flags (dealbreaker checks)
  flags: {
    has_cubicle_bathroom: boolean;
    has_mezzanine: boolean;
    needs_full_renovation: boolean;
    ground_floor_exposed: boolean;
    is_house_share: boolean;
    no_natural_light: boolean;
    no_kitchen: boolean;
    no_bathroom: boolean;
  };
  
  // Safety flags for special populations
  safety_flags: {
    child_hazards: string[];      // "steep stairs", "unfenced balcony"
    elderly_hazards: string[];    // "no elevator", "slippery floors"
    accessibility_issues: string[]; // "narrow doorways", "steps throughout"
    pet_hazards: string[];        // "small balcony gap", "no outdoor access"
  };
  
  // Standouts and concerns (from description, refined)
  standouts: string[];
  concerns: string[];
  
  // Confidence based on description quality
  confidence: 'high' | 'medium' | 'low';
  scoredAt: string;
}
