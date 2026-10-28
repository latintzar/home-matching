import { NormalizedScrapedListing } from '@/types/scraped-listing';

/**
 * Normalizes raw scraped data into canonical NormalizedScrapedListing shape.
 * 
 * This ensures:
 * - Both robust and universal scrapers produce the same structure
 * - PropertyDetails and A-C pipeline always know what to expect
 * - Partial data is handled gracefully (all fields nullable)
 * 
 * @param raw - Raw scraped data (can be from Idealista, Fotocasa, or Gemini extraction)
 * @param sourceUrl - Original URL that was scraped
 * @returns Normalized scraped listing data
 */
export function normalizeScrapedData(
  raw: any,
  sourceUrl: string
): NormalizedScrapedListing {
  if (!raw) {
    console.warn('normalizeScrapedData received null raw data');
    return {
      title: null, description: null, bedrooms: null, bathrooms: null,
      areas: { constructed: null, useful: null },
      price_eur: null, listing_type: null, price_period: null,
      city: null, neighborhood: null, address: null, region: null, country: 'Spain',
      lat: null, lng: null, roomsAndAmenities: null, additionalFeatures: null,
      source_url: sourceUrl, scraped_at: new Date().toISOString(), raw_metadata: {},
      reference: null, photo_urls: []
    };
  }

  // Extract structured bed/bath from roomsAndAmenities if missing
  const extractBedBath = (roomsStr: string | null): { bedrooms: number | null; bathrooms: number | null } => {
    if (!roomsStr) return { bedrooms: null, bathrooms: null };
    const bedMatch = roomsStr.match(/(\d+)\s*(?:hab|habitaciones?|dormitorios?)/i);
    const bathMatch = roomsStr.match(/(\d+)\s*baños?/i);
    return {
      bedrooms: bedMatch ? parseInt(bedMatch[1]) : null,
      bathrooms: bathMatch ? parseInt(bathMatch[1]) : null
    };
  };

  // If bedrooms/bathrooms missing but roomsAndAmenities exists, try to extract
  const bedBathFromRooms = extractBedBath(raw.roomsAndAmenities);
  
  // Normalize areas object
  const areas = {
    constructed: raw.areas?.constructed ?? raw.m2_built ?? raw.sqm ?? raw.constructedArea ?? raw.constructed_area ?? null,
    useful: raw.areas?.useful ?? raw.usefulArea ?? raw.useful_area ?? null
  };

  // Normalize location fields
  const city = raw.city ?? null;
  const neighborhood = raw.neighborhood ?? raw.barrio ?? null;
  const address = raw.address ?? raw.location ?? null;
  const region = raw.region ?? raw.community ?? null;
  const country = raw.country ?? 'Spain';

  // Comprehensive filter to remove redundant features already captured in structured fields
  const isRedundantFeature = (feature: string): boolean => {
    const lower = feature.toLowerCase();
    
    // 1. Boolean amenities (already captured in has_* fields)
  const booleanKeywords = [
    'ascensor', 'elevator', 'lift', 'aufzug', 'ascenseur',
    'terraza', 'terrace', 'terrasse',
    'balcon', 'balcón', 'balcony', 'balkon',
    'piscina', 'pool', 'schwimmbad', 'piscine',
    'garaje', 'garage', 'parking', 'parkplatz',
    'jardin', 'jardín', 'garden', 'garten',
    'trastero', 'storage', 'abstellraum', 'débarras', 'cave',
    'aire acondicionado', 'air conditioning', 'klimaanlage', 'climatisation',
    'armarios empotrados', 'built-in wardrobes', 'fitted wardrobes', 'einbauschränke', 'placards',
    'exterior', 'outer', 'aussen', 'extérieur'
  ];
    if (booleanKeywords.some(k => lower.includes(k))) return true;
    
    // 2. Area/size info (already in areas.constructed/areas.useful)
    const areaPatterns = [
      /\d+\s*m[²2]\s*(?:construidos?|built|bebaut)/i,
      /\d+\s*m[²2]\s*(?:útiles?|useful|nützlich)/i,
      /\d+\s*m[²2]\s*(?:superficie|area|fläche)/i,
      /\d+\s*m[²2]/i, // Generic m² pattern (if it's just a number + m²)
    ];
    if (areaPatterns.some(p => p.test(feature))) return true;
    
    // 3. Bedroom/bathroom counts (already in bedrooms/bathrooms)
    const roomPatterns = [
      /\d+\s*(?:hab|habitaciones?|dormitorios?|bedrooms?|schlafzimmer)/i,
      /\d+\s*baños?/i,
      /\d+\s*bathrooms?/i,
      /\d+\s*badezimmer/i,
    ];
    if (roomPatterns.some(p => p.test(feature))) return true;
    
    // 4. Condition info (already in condition field)
    const conditionPatterns = [
      /segunda\s+mano/i,
      /buen\s+estado/i,
      /nuevo|new|neu|nouveau/i,
      /renovar|renovate|renovieren|rénover/i,
      /reformar|refurbish/i,
      /estado\s+de\s+conservación/i,
    ];
    if (conditionPatterns.some(p => p.test(feature))) return true;
    
    // 5. Floor level info (already in floor_level/floor_number)
    const floorPatterns = [
      /bajo|ground|erdgeschoss|rez-de-chaussée/i,
      /interior|inner|intérieur/i,
      /exterior|outer|aussen|extérieur/i,
      /planta\s+\d+/i,
      /floor\s+\d+/i,
      /piso\s+\d+/i,
    ];
    if (floorPatterns.some(p => p.test(feature))) return true;
    
    // 6. Year built (could be captured but not critical to filter)
    const yearPatterns = [
      /construido\s+en\s+\d{4}/i,
      /built\s+in\s+\d{4}/i,
      /año\s+\d{4}/i,
    ];
    if (yearPatterns.some(p => p.test(feature))) return true;
    
    return false;
  };

  // Normalize additionalFeatures array
  const additionalFeatures = Array.isArray(raw.additionalFeatures) 
    ? raw.additionalFeatures
        .filter((f: any) => f && typeof f === 'string')
        .filter((f: string) => !isRedundantFeature(f))
    : null;

  // Determine listing type and price period
  const titleLower = (raw.title || '').toLowerCase();
  const urlLower = (sourceUrl || '').toLowerCase();
  const priceStr = String(raw.price_eur || raw.price || '');
  
  let listing_type: 'sale' | 'rent' | 'rent_to_own' | null = 'sale'; // Default to sale
  let price_period: 'total' | 'month' | null = 'total';

  const rentKeywords = ['alquiler', 'rent', 'louer', 'miete', 'lloguer'];
  
  if (
    rentKeywords.some(k => titleLower.includes(k)) || 
    rentKeywords.some(k => urlLower.includes(k)) ||
    raw.listing_type === 'rent'
  ) {
    listing_type = 'rent';
    price_period = 'month';
  }
  
  if (priceStr.includes('/mo') || priceStr.includes('/mes')) {
     price_period = 'month';
  }

  // Deduplicate description (e.g. if text repeats the same paragraph)
  const cleanDescription = (desc: string | null): string | null => {
    if (!desc) return null;
    const clean = desc.trim();
    if (clean.length < 50) return clean; // Too short to dedupe

    // Check if the second half is identical to the first half (simple concatenation)
    const mid = Math.floor(clean.length / 2);
    const firstHalf = clean.substring(0, mid);
    const secondHalf = clean.substring(mid);
    
    // Fuzzy check: if first half is roughly repeated
    // Or split by paragraphs and unique them
    const paragraphs = clean.split(/\n+/).map(p => p.trim()).filter(Boolean);
    const uniqueParagraphs = Array.from(new Set(paragraphs));
    
    return uniqueParagraphs.join('\n\n');
  };

  return {
    title: raw.title || null,
    description: cleanDescription(raw.description) || null,
    
    // Prefer explicit bed/bath, fallback to extracted from roomsAndAmenities
    bedrooms: raw.bedrooms ?? bedBathFromRooms.bedrooms,
    bathrooms: raw.bathrooms ?? bedBathFromRooms.bathrooms,
    
    areas,
    price_eur: raw.price_eur ?? raw.price ?? null,
    
    listing_type,
    price_period,
    
    city,
    neighborhood,
    address,
    region,
    country,
    lat: raw.lat ?? raw.latitude ?? null,
    lng: raw.lng ?? raw.longitude ?? raw.lon ?? null,
    autocomplete_query: raw.autocomplete_query ?? raw.google_places_query ?? null,
    
    // Pass-through Idealista Filters
    property_subtype: raw.property_subtype ?? null,
    housing_situation: raw.housing_situation ?? null,
    ad_origin: raw.ad_origin ?? null,
    
    // Pass-through Booleans & Enums
    has_elevator: raw.has_elevator,
    has_terrace: raw.has_terrace,
    has_balcony: raw.has_balcony,
    has_pool: raw.has_pool,
    has_garage: raw.has_garage,
    has_garden: raw.has_garden,
    has_storage: raw.has_storage,
    has_air_conditioning: raw.has_air_conditioning,
    has_wardrobes: raw.has_wardrobes,
    is_accessible: raw.is_accessible,
    is_exterior: raw.is_exterior,
    condition: raw.condition,
    floor_level: raw.floor_level,
    floor_number: raw.floor_number ?? null,
    balcony_orientation: raw.balcony_orientation ?? null,
    terrace_orientation: raw.terrace_orientation ?? null,
    
    roomsAndAmenities: raw.roomsAndAmenities ?? null,
    additionalFeatures,
    
    // PHOTOS: CRITICAL FIX - Pass through photo URLs for Instant Mode
    photo_urls: Array.isArray(raw.photo_urls)
      ? raw.photo_urls.filter((url: any) => url && typeof url === 'string')
      : Array.isArray(raw.photos) 
      ? raw.photos.map((p: any) => typeof p === 'string' ? p : p.url)
      : Array.isArray(raw.image_urls)
        ? raw.image_urls
        : (raw.main_image_url ? [raw.main_image_url] : []),
    
    source_url: sourceUrl,
    scraped_at: new Date().toISOString(),
    reference: raw.reference || raw.reference_number || raw.ref || raw.id || null,
    raw_metadata: raw.raw_metadata || {},
    agency: (raw.agency?.name || raw.agency_name || raw.agencyName || raw.agency?.logo_url || raw.agency_logo_url) ? {
        name: raw.agency?.name || raw.agency_name || raw.agencyName || null,
        logo_url: raw.agency?.logo_url || raw.agency_logo_url || raw.agency?.original_logo_url || null,
        phone: raw.agency?.phone || raw.agency_phone || null,
        email: (raw.agency?.email || raw.agency_email || '').includes('@idealista.com') || (raw.agency?.email || raw.agency_email || '').includes('@fotocasa.es') ? null : (raw.agency?.email || raw.agency_email || null),
        agent_name: raw.agency?.agent_name || raw.agent_name || null,
        agent_photo_url: raw.agency?.agent_photo_url || raw.agent_photo_url || null,
        agent_phone: raw.agency?.agent_phone || raw.agent_phone || null,
        whatsapp: raw.agency?.whatsapp || raw.whatsapp || null
    } : null
  };
}
