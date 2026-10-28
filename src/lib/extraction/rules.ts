/**
 * 🧠 LEO.CASA EXTRACTION INTELLIGENCE
 * 
 * This file is the SINGLE SOURCE OF TRUTH for "What" and "How" we scrape.
 * 
 * IT CONTROLS:
 * 1. The Schema (What fields exist)
 * 2. Idealista Parsing Rules (Selectors, Regex, Keywords) for Client & Server
 * 3. Universal AI Instructions (Prompts) for Gemini
 * 
 * TO ADD A NEW FIELD:
 * 1. Add it to `ListingSchema` (conceptually)
 * 2. Add keywords to `PARSING_RULES.booleans` or `enums` (for Idealista)
 * 3. Add it to `UNIVERSAL_PROMPT_TEMPLATE` (for AI)
 */

export const PARSING_RULES = {
  idealista: {
    // BASIC INFO
    title: { selectors: ['.main-info__title-main'] },
    location: { selectors: ['.main-info__title-minor'] },
    price: { selectors: ['.info-data-price', '.main-info__price', '.price'], cleaner: 'price' },
    description: { selectors: ['.comment .adCommentsLanguage p', '.detail-description'] },
    
    // CONTACT
    phone: { selectors: ['.phone', '.icon-phone', '.btn-phone', '.contact-phones'], cleaner: 'phone' },
    reference: { selectors: ['.txt-ref', '.reference', '.info-data-reference'] },
    
    // STATS (Regex applied to combined text of features)
    stats: {
      bedrooms: /(\d+)\s*(?:bed|hab|dorm|habitac|schlafzimmer|chambres)/i,
      bathrooms: /(\d+)\s*(?:bath|bañ|aseo|badezimmer|salles de bain)/i,
      m2_built: /(\d+(?:\.\d+)?)\s*(?:m²|m2|construidos|built)/i,
      m2_useful: /(\d+(?:\.\d+)?)\s*(?:m²|m2)\s*(?:útiles|useful)/i,
      floor_number: /(?:planta|floor|étage|stock)\s*(\d+)|(\d+)(?:º|ª|th|nd|rd|st)?\s*(?:planta|floor|étage|stock)/i,
    },

    // BOOLEANS / FEATURES (Keywords to search in combined text)
    // Multilingual Support: ES, EN, DE, FR
    booleans: {
      has_elevator: ['ascensor', 'elevator', 'lift', 'aufzug', 'ascenseur'],
      is_exterior: ['exterior', 'aussen', 'extérieur'],
      has_terrace: ['terraza', 'terrace', 'terrasse'],
      has_balcony: ['balcón', 'balcon', 'balcony', 'balkon'],
      has_pool: ['piscina', 'pool', 'schwimmbad', 'piscine'],
      has_garage: ['garaje', 'garage', 'parking', 'stellplatz', 'parkplatz'],
      has_garden: ['jardín', 'jardin', 'garden', 'garten'],
      has_air_conditioning: ['aire acondicionado', 'air conditioning', 'a/c', 'klimaanlage', 'climatisation'],
      has_wardrobes: ['armarios empotrados', 'built-in wardrobes', 'fitted wardrobes', 'einbauschränke', 'placards'],
      is_accessible: ['acceso movilidad reducida', 'accessible', 'reduced mobility', 'barrierefrei', 'accessibilité réduite'],
      has_storage: ['trastero', 'storage room', 'cellar', 'abstellraum', 'keller', 'cave', 'débarras'],
    },

    // ENUMS
    enums: {
      condition: [
        { value: 'new', keywords: ['obra nueva', 'new development', 'neubau', 'construction neuve'] },
        { value: 'renovate', keywords: ['a reformar', 'to renovate', 'renovierungsbedürftig', 'à rénover'] },
        { value: 'good', keywords: ['buen estado', 'good condition', 'guter zustand', 'bon état'] }
      ],
      floor_level: [
        { value: 'ground', keywords: ['bajo', 'ground floor', 'planta baja', 'erdgeschoss', 'rez-de-chaussée'] },
        { value: 'top', keywords: ['ático', 'penthouse', 'dachgeschoss', 'dernier étage'] },
        { value: 'intermediate', keywords: ['planta', 'floor', 'stock', 'etage', 'étage'] }
      ],
      housing_situation: [
        { value: 'rented', keywords: ['alquilado', 'rented', 'con inquilinos', 'with tenants', 'vermietet', 'loué'] },
        { value: 'bare_ownership', keywords: ['nuda propiedad', 'bare ownership', 'nacktes eigentum', 'nue-propriété'] },
        { value: 'squatted', keywords: ['okupado', 'squatted', 'ilegally occupied', 'besetzt', 'squatté'] },
        { value: 'auction', keywords: ['subasta', 'auction', 'versteigerung', 'enchères'] },
        { value: 'free', keywords: [] } // Default fallback
      ],
      property_subtype: [
        { value: 'penthouse', keywords: ['ático', 'penthouse', 'dachwohnung'] },
        { value: 'duplex', keywords: ['dúplex', 'duplex', 'maisonette'] },
        { value: 'studio', keywords: ['estudio', 'studio', '1-zimmer-wohnung'] },
        { value: 'chalet_detached', keywords: ['chalet independiente', 'detached house', 'villa', 'einfamilienhaus', 'maison individuelle'] },
        { value: 'chalet_semi', keywords: ['chalet pareado', 'semi-detached', 'doppelhaushälfte', 'maison jumelée'] },
        { value: 'chalet_terraced', keywords: ['chalet adosado', 'terraced house', 'reihenhaus', 'maison mitoyenne'] },
        { value: 'rustic', keywords: ['finca rústica', 'country house', 'rustic property', 'landhaus', 'maison de campagne'] }
      ],
      ad_origin: [
        { value: 'bank', keywords: ['de banco', 'bank owned', 'procedente de entidad bancaria', 'bankeigentum', 'propriété bancaire'] }
      ]
    }
  }
};

/**
 * Shared Regexes for cleaning titles/addresses
 */
export const ADDRESS_CLEANING_REGEXES = [
  /^(?:piso|ático|casa|chalet|apartamento|dúplex|estudio|loft|planta baja|tríplex|villa|finca rústica) (?:en venta|en alquiler) (?:en|a|por) /i,
  /^(?:piso|ático|casa|chalet|apartamento|dúplex|estudio|loft|planta baja|tríplex|villa|finca rústica) (?:en venta|en alquiler)/i,
  /^(?:flat(?:\s*\/\s*apartment)?|apartment|house|villa|chalet|penthouse|studio|duplex) (?:for sale|for rent|to rent) (?:in|at) /i,
];

/**
 * Shared Utility Functions (Pure Logic)
 */
export const Parsers = {
  cleanText: (text: string | null | undefined) => text ? text.replace(/\s+/g, ' ').trim() : '',
  
  cleanPrice: (text: string | null | undefined) => {
    if (!text) return 0;
    const clean = text.replace(/[^\d]/g, '');
    return parseInt(clean) || 0;
  },

  cleanAddress: (title: string) => {
    let cleaned = title;
    for (const regex of ADDRESS_CLEANING_REGEXES) {
      if (regex.test(cleaned)) {
        cleaned = cleaned.replace(regex, '').trim();
        break;
      }
    }
    return cleaned;
  }
};

/**
 * UNIVERSAL AI PROMPT GENERATOR
 * This generates the instructions for Gemini when scraping non-Idealista sites.
 */
export const generateUniversalPrompt = (url: string, imageCandidates: string[], htmlContent: string) => `
You are a Universal Multilingual Property Scraper.
Extract structured real estate data from the following property listing HTML.
Support English, Spanish, German, Catalan, French, etc.

URL: ${url}

IMAGE CANDIDATES:
${JSON.stringify(imageCandidates)}

HTML CONTENT:
${htmlContent}

TASK:
Extract the following fields. If a field is missing, use null.
- title: The main property title
- price_eur: Numeric price (e.g. 250000)
- description: Full property description (deduplicated, concise)
- m2_built: Constructed area in m²
- m2_useful: Useful/net area in m²
- bedrooms: Number of bedrooms
- bathrooms: Number of bathrooms
- city: City name
- address: Best available address (Street, Number, City)
- lat: Latitude (if found in maps/data)
- lng: Longitude (if found in maps/data)
- main_image_url: Best main image URL
- image_urls: Array of all valid property photos (exclude agents/logos)
- amenities: List of features (Elevator, Pool, Terrace, Garage, etc.)
- listing_type: 'sale' | 'rent' | 'rent_to_own'
- reference: Property reference ID
- agency_name: Real estate agency name
- agency_logo_url: Agency logo URL
- agency_phone: Agency phone
- agency_email: Agency email
- agent_name: Individual agent name
- agent_photo_url: Agent photo URL
- agent_phone: Agent phone
- whatsapp: WhatsApp number/link

ADVANCED FILTERS (Matches Idealista Standard):
- property_subtype: 'flat', 'penthouse', 'duplex', 'studio', 'chalet_detached', 'chalet_semi', 'chalet_terraced', 'rustic'
- housing_situation: 'free' (default), 'rented' (with tenants), 'bare_ownership' (nuda propiedad), 'squatted' (okupado), 'auction'
- ad_origin: 'standard', 'bank' (owned by bank)
- floor_level: 'ground', 'intermediate', 'top'
- condition: 'new', 'good', 'renovate'

IMPORTANT: Detect these values even if they appear in German (e.g. 'Bankeigentum'), French (e.g. 'Nue-propriété'), or other languages. Map them to the standard English keys above.

BOOLEANS:
- has_elevator: boolean
- is_exterior: boolean
- has_terrace: boolean
- has_balcony: boolean
- has_pool: boolean
- has_garage: boolean
- has_garden: boolean
- has_storage: boolean
- has_air_conditioning: boolean
- has_wardrobes: boolean
- is_accessible: boolean

OUTPUT JSON ONLY.
`;
