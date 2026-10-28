export interface LifestyleProfile {
  anchors: {
    location: { lat: number; lng: number; address?: string };
    type: "work" | "gym" | "social" | "family" | "other";
    transport_mode: "driving" | "transit" | "cycling" | "walking";
    max_duration_minutes: number;
    frequency_per_week: number;
  }[];
  vibe: {
    amenity_type: string;
    importance: "must_have" | "nice_to_have";
    specifics: string[];
  }[];
  property_dna?: {
    floor_level?: "ground" | "intermediate" | "top";
    has_elevator?: boolean;
    is_exterior?: boolean;
    has_terrace?: boolean;
    has_balcony?: boolean;
    has_pool?: boolean;
    has_garage?: boolean;
    has_garden?: boolean;
    condition?: "new" | "good" | "renovate";
    min_bedrooms?: number;
    min_bathrooms?: number;
  };
}

export interface HexScore {
  hexId: string;
  center: { lat: number; lng: number };
  scores: {
    commute: number;
    vibe: number;
    total: number;
  };
  commuteDetails: Record<string, number>; // anchor_index -> minutes
  vibeDetails: Record<string, number>; // amenity_type -> count
}

