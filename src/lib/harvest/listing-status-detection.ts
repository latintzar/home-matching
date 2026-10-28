/**
 * Listing Status Detection Utility
 * 
 * Shared module for detecting:
 * 1. Sale status (sold, leased, reserved, active)
 * 2. Furnished status
 * 3. Removed/unavailable status
 * 
 * Used by all harvest lambdas to ensure consistent status tracking.
 */

export type SaleStatus = 'active' | 'sold' | 'leased' | 'reserved' | 'removed';

export interface StatusDetectionResult {
  saleStatus: SaleStatus;
  statusSignal: string;
  isFurnished: boolean | null;  // null = unknown
  furnishedSignal: string | null;
}

// ============================================================
// SALE STATUS DETECTION PATTERNS
// ============================================================

interface StatusPattern {
  pattern: RegExp;
  status: SaleStatus;
  signal: string;
}

// English patterns (Lucas Fox, aProperties, international sites)
const ENGLISH_STATUS_PATTERNS: StatusPattern[] = [
  // Sold patterns
  { pattern: /\b(apartment|house|villa|penthouse|property|flat)\s+sold\b/i, status: 'sold', signal: 'html_property_sold' },
  { pattern: /<span[^>]*class="[^"]*sold[^"]*"[^>]*>/i, status: 'sold', signal: 'html_sold_class' },
  { pattern: /<span[^>]*>\s*Sold\s*<\/span>/i, status: 'sold', signal: 'html_sold_badge' },
  { pattern: /\bstatus["']?\s*:\s*["']?sold/i, status: 'sold', signal: 'json_status_sold' },
  
  // Leased/Rented patterns
  { pattern: /\b(apartment|house|villa|penthouse|property|flat)\s+(leased|rented)\b/i, status: 'leased', signal: 'html_property_leased' },
  { pattern: /<span[^>]*class="[^"]*leased[^"]*"[^>]*>/i, status: 'leased', signal: 'html_leased_class' },
  { pattern: /<span[^>]*>\s*(Leased|Rented)\s*<\/span>/i, status: 'leased', signal: 'html_leased_badge' },
  { pattern: /\bstatus["']?\s*:\s*["']?(leased|rented)/i, status: 'leased', signal: 'json_status_leased' },
  
  // Reserved patterns
  { pattern: /<span[^>]*>\s*Reserved\s*<\/span>/i, status: 'reserved', signal: 'html_reserved_badge' },
  { pattern: /\bstatus["']?\s*:\s*["']?reserved/i, status: 'reserved', signal: 'json_status_reserved' },
];

// Spanish patterns (Tecnocasa, Don Piso, Century21, Remax, etc.)
const SPANISH_STATUS_PATTERNS: StatusPattern[] = [
  // Vendido (Sold)
  { pattern: /\bvendido\b/i, status: 'sold', signal: 'html_vendido' },
  { pattern: /<span[^>]*class="[^"]*vendido[^"]*"[^>]*>/i, status: 'sold', signal: 'html_vendido_class' },
  { pattern: /\bestado["']?\s*:\s*["']?vendido/i, status: 'sold', signal: 'json_estado_vendido' },
  { pattern: /\bstatus["']?\s*:\s*["']?VENDUTO/i, status: 'sold', signal: 'json_status_venduto' },  // Tecnocasa Italian
  
  // Alquilado (Leased/Rented)
  { pattern: /\balquilado\b/i, status: 'leased', signal: 'html_alquilado' },
  { pattern: /\bya\s+alquilado\b/i, status: 'leased', signal: 'html_ya_alquilado' },
  { pattern: /\bactualmente\s+alquilado\b/i, status: 'leased', signal: 'html_actualmente_alquilado' },
  { pattern: /<span[^>]*class="[^"]*alquilado[^"]*"[^>]*>/i, status: 'leased', signal: 'html_alquilado_class' },
  { pattern: /\bestado["']?\s*:\s*["']?alquilado/i, status: 'leased', signal: 'json_estado_alquilado' },
  { pattern: /\bstatus["']?\s*:\s*["']?AFFITTATO/i, status: 'leased', signal: 'json_status_affittato' },  // Tecnocasa Italian
  
  // Reservado (Reserved)
  { pattern: /\breservado\b(?!\s+todos)/i, status: 'reserved', signal: 'html_reservado' },  // Exclude "reservados todos los derechos"
  { pattern: /<span[^>]*class="[^"]*reservado[^"]*"[^>]*>/i, status: 'reserved', signal: 'html_reservado_class' },
  { pattern: /\bestado["']?\s*:\s*["']?reservado/i, status: 'reserved', signal: 'json_estado_reservado' },
  
  // No disponible (Not available)
  { pattern: /\bno\s+disponible\b/i, status: 'removed', signal: 'html_no_disponible' },
  { pattern: /\binmueble\s+no\s+disponible\b/i, status: 'removed', signal: 'html_inmueble_no_disponible' },
];

// ============================================================
// FURNISHED DETECTION PATTERNS
// ============================================================

interface FurnishedPattern {
  pattern: RegExp;
  isFurnished: boolean;
  signal: string;
}

const FURNISHED_PATTERNS: FurnishedPattern[] = [
  // Spanish - Furnished
  { pattern: /\bamueblado\b/i, isFurnished: true, signal: 'html_amueblado' },
  { pattern: /\bcon\s+muebles\b/i, isFurnished: true, signal: 'html_con_muebles' },
  { pattern: /\btotalmente\s+amueblado\b/i, isFurnished: true, signal: 'html_totalmente_amueblado' },
  { pattern: /["']?furnitured["']?\s*:\s*["']?(true|1|yes|si|sí)["']?/i, isFurnished: true, signal: 'json_furnitured_true' },
  { pattern: /["']?amueblado["']?\s*:\s*["']?(true|1|yes|si|sí)["']?/i, isFurnished: true, signal: 'json_amueblado_true' },
  
  // Spanish - Unfurnished
  { pattern: /\bsin\s+amueblar\b/i, isFurnished: false, signal: 'html_sin_amueblar' },
  { pattern: /\bsin\s+muebles\b/i, isFurnished: false, signal: 'html_sin_muebles' },
  { pattern: /\bno\s+amueblado\b/i, isFurnished: false, signal: 'html_no_amueblado' },
  { pattern: /["']?furnitured["']?\s*:\s*["']?(false|0|no)["']?/i, isFurnished: false, signal: 'json_furnitured_false' },
  { pattern: /["']?amueblado["']?\s*:\s*["']?(false|0|no)["']?/i, isFurnished: false, signal: 'json_amueblado_false' },
  
  // English - Furnished
  { pattern: /\bfurnished\b/i, isFurnished: true, signal: 'html_furnished' },
  { pattern: /\bfully\s+furnished\b/i, isFurnished: true, signal: 'html_fully_furnished' },
  
  // English - Unfurnished
  { pattern: /\bunfurnished\b/i, isFurnished: false, signal: 'html_unfurnished' },
];

// ============================================================
// DETECTION FUNCTIONS
// ============================================================

/**
 * Detect sale status from HTML content
 */
export function detectSaleStatus(html: string): { status: SaleStatus; signal: string } {
  // Check English patterns first, then Spanish
  const allPatterns = [...ENGLISH_STATUS_PATTERNS, ...SPANISH_STATUS_PATTERNS];
  
  for (const { pattern, status, signal } of allPatterns) {
    if (pattern.test(html)) {
      return { status, signal };
    }
  }
  
  return { status: 'active', signal: 'no_status_detected' };
}

/**
 * Detect furnished status from HTML content
 */
export function detectFurnishedStatus(html: string): { isFurnished: boolean | null; signal: string | null } {
  for (const { pattern, isFurnished, signal } of FURNISHED_PATTERNS) {
    if (pattern.test(html)) {
      return { isFurnished, signal };
    }
  }
  
  return { isFurnished: null, signal: null };
}

/**
 * Combined detection - returns all status info
 */
export function detectListingStatus(html: string): StatusDetectionResult {
  const { status: saleStatus, signal: statusSignal } = detectSaleStatus(html);
  const { isFurnished, signal: furnishedSignal } = detectFurnishedStatus(html);
  
  return {
    saleStatus,
    statusSignal,
    isFurnished,
    furnishedSignal,
  };
}

/**
 * Detect from Tecnocasa embedded JSON (special case)
 * The :estate prop contains structured data
 */
export function detectFromTecnocasaJson(estateData: any): StatusDetectionResult {
  let saleStatus: SaleStatus = 'active';
  let statusSignal = 'json_estate';
  
  // Check status field (Italian: ATTIVO, VENDUTO, AFFITTATO)
  const status = estateData?.agency?.status || estateData?.status_internal;
  if (status) {
    if (/venduto/i.test(status)) {
      saleStatus = 'sold';
      statusSignal = 'json_status_venduto';
    } else if (/affittato/i.test(status)) {
      saleStatus = 'leased';
      statusSignal = 'json_status_affittato';
    }
  }
  
  // Check description for status keywords
  const description = estateData?.description || '';
  if (/vendido/i.test(description)) {
    saleStatus = 'sold';
    statusSignal = 'json_desc_vendido';
  } else if (/alquilado/i.test(description) || /actualmente\s+alquilado/i.test(description)) {
    saleStatus = 'leased';
    statusSignal = 'json_desc_alquilado';
  }
  
  // Check furnished from features
  let isFurnished: boolean | null = null;
  let furnishedSignal: string | null = null;
  
  const furnitured = estateData?.features?.furnitured;
  if (furnitured !== null && furnitured !== undefined) {
    isFurnished = Boolean(furnitured);
    furnishedSignal = 'json_features_furnitured';
  }
  
  return {
    saleStatus,
    statusSignal,
    isFurnished,
    furnishedSignal,
  };
}

/**
 * Merge status from HTML detection with existing tracking data
 */
export function mergeStatusWithTracking(
  htmlStatus: StatusDetectionResult,
  existingStatus?: SaleStatus,
  existingSignal?: string
): { status: SaleStatus; signal: string } {
  // If HTML detected a non-active status, use it
  if (htmlStatus.saleStatus !== 'active') {
    return {
      status: htmlStatus.saleStatus,
      signal: htmlStatus.statusSignal,
    };
  }
  
  // If existing status is 'removed' (from sitemap detection), keep it
  if (existingStatus === 'removed') {
    return {
      status: 'removed',
      signal: existingSignal || 'not_in_sitemap',
    };
  }
  
  // Default to active
  return {
    status: 'active',
    signal: htmlStatus.statusSignal || 'in_sitemap',
  };
}

// ============================================================
// HTTP STATUS-BASED DETECTION
// ============================================================

/**
 * Detect listing status from HTTP response status code
 * Use this when fetching a detail page to determine if listing was removed
 * 
 * @param statusCode - HTTP status code from fetch response
 * @param previouslyKnown - Whether we had this listing in our database before
 * @returns Status detection result or null if status code doesn't indicate removal
 */
export function detectFromHttpStatus(
  statusCode: number,
  previouslyKnown: boolean = false
): { status: SaleStatus; signal: string } | null {
  // 404 Not Found - listing page doesn't exist
  if (statusCode === 404) {
    return {
      status: 'removed',
      signal: previouslyKnown ? 'http_404_previously_known' : 'http_404_not_found',
    };
  }
  
  // 410 Gone - explicitly removed
  if (statusCode === 410) {
    return {
      status: 'removed',
      signal: 'http_410_gone',
    };
  }
  
  // 301/302 redirects to homepage or listing-not-found page often mean removed
  // (Note: Caller should check redirect target - this is just the signal)
  
  // Other status codes don't indicate removal
  return null;
}

/**
 * Common redirect patterns that indicate a listing was removed
 * Use with the final URL after following redirects
 */
export function isRemovedRedirect(finalUrl: string, originalUrl: string): { status: SaleStatus; signal: string } | null {
  // Skip if no redirect happened
  if (finalUrl === originalUrl) return null;
  
  const finalLower = finalUrl.toLowerCase();
  
  // Common "listing not found" redirect patterns
  const removedPatterns = [
    /\/404\b/,
    /\/not-?found/i,
    /\/error/i,
    /\/inmueble-?no-?disponible/i,
    /\/property-?not-?found/i,
    /\/listing-?removed/i,
    /\/no-?disponible/i,
  ];
  
  for (const pattern of removedPatterns) {
    if (pattern.test(finalLower)) {
      return {
        status: 'removed',
        signal: 'redirect_to_removed_page',
      };
    }
  }
  
  // Redirect to homepage often means listing removed
  // Check if final URL is just the domain root
  try {
    const originalHost = new URL(originalUrl).hostname;
    const finalParsed = new URL(finalUrl);
    if (finalParsed.hostname === originalHost && 
        (finalParsed.pathname === '/' || finalParsed.pathname === '')) {
      return {
        status: 'removed',
        signal: 'redirect_to_homepage',
      };
    }
  } catch {
    // URL parsing failed, skip this check
  }
  
  return null;
}
