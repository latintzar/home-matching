export interface NormalizedScrapedListing {
  title: string | null;
  description: string | null;

  // Core numbers (The "Truth")
  bedrooms: number | null;
  bathrooms: number | null;
  areas: {
    constructed: number | null;
    useful: number | null;
  };
  price_eur: number | null;

  // Transaction details
  listing_type: 'sale' | 'rent' | 'rent_to_own' | null;
  price_period: 'total' | 'month' | null;

  // Idealista-Aligned Filters (New)
  property_subtype?: string | null; // e.g. 'flat', 'penthouse', 'chalet_detached'
  housing_situation?: string | null; // e.g. 'free', 'rented', 'bare_ownership'
  ad_origin?: string | null; // e.g. 'standard', 'bank'
  
  // Explicit Booleans (New)
  has_elevator?: boolean;
  has_terrace?: boolean;
  has_balcony?: boolean;
  has_pool?: boolean;
  has_garage?: boolean;
  has_garden?: boolean;
  has_storage?: boolean;
  has_air_conditioning?: boolean;
  has_wardrobes?: boolean;
  is_accessible?: boolean;
  is_exterior?: boolean;
  condition?: string | null; // 'new', 'good', 'renovate'
  floor_level?: string | null; // 'ground', 'intermediate', 'top'
  floor_number?: number | null;
  balcony_orientation?: string | null; // 'street', 'back', 'unknown'
  terrace_orientation?: string | null; // 'street', 'back', 'unknown'

  // Location (Granularity varies)
  city: string | null;
  neighborhood: string | null;
  address: string | null; // Full address if available
  region: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  autocomplete_query?: string | null; // Optimized query for Google Places (e.g. stripped of "near beach")

  // Display / Fluff
  roomsAndAmenities: string | null; // The "Tagline" (e.g. "3 hab | 2 baños | Terraza")
  additionalFeatures: string[] | null;

  // Metadata
  source_url: string;
  scraped_at: string;
  reference: string | null;
  
  // Agency Branding
  agency?: {
    name: string | null;
    logo_url: string | null;
    phone: string | null;
    email: string | null;
    agent_name: string | null; // Specific agent name if different from agency
    agent_photo_url: string | null; // Specific agent photo
    agent_phone: string | null; // Specific agent phone
    whatsapp: string | null; // WhatsApp number/link (priority)
  } | null;

  // Photos (URL references for fallback display)
  photo_urls?: string[];

  // Fallback for anything else
  raw_metadata?: Record<string, any>;
}
