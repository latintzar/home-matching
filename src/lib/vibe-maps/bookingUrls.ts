/**
 * Booking URL Generator (S.4 & S.5)
 * 
 * Generates Airbnb and Booking.com search URLs for accommodation
 * with support for guests, dates, and budget filters
 * 
 * @see docs/agentic-maps/tests/s-5-generate-booking-platform-urls.md
 */

export interface BookingURLs {
  airbnb: string;
  booking: string;
}

export interface BookingURLParams {
  areaName: string;
  city: string;
  checkin?: string;  // YYYY-MM-DD format
  checkout?: string; // YYYY-MM-DD format
  guests?: number;   // Number of guests
  priceTier?: 1 | 2 | 3;  // 1=budget, 2=mid-range, 3=luxury
}

/**
 * Generate Airbnb and Booking.com search URLs for an area
 * Now includes guests and price filters!
 * 
 * @example
 * ```ts
 * const urls = generateBookingURLs({
 *   areaName: 'Shibuya',
 *   city: 'Tokyo',
 *   checkin: '2024-03-15',
 *   checkout: '2024-03-18',
 *   guests: 4,
 *   priceTier: 2
 * });
 * ```
 */
export function generateBookingURLs({ 
  areaName, 
  city, 
  checkin, 
  checkout,
  guests,
  priceTier
}: BookingURLParams): BookingURLs {
  // Combine location for search
  const location = `${areaName} ${city}`;
  
  // Build Airbnb URL
  // Airbnb params: checkin, checkout, adults, price_min, price_max
  const airbnbParams: string[] = [];
  if (checkin) airbnbParams.push(`checkin=${checkin}`);
  if (checkout) airbnbParams.push(`checkout=${checkout}`);
  if (guests) airbnbParams.push(`adults=${guests}`);
  
  // Airbnb price filters (per night in USD - approximate)
  if (priceTier === 1) {
    airbnbParams.push('price_max=100');
  } else if (priceTier === 3) {
    airbnbParams.push('price_min=200');
  }
  // priceTier 2 (mid-range) = no filter, show all
  
  let airbnbUrl = `https://www.airbnb.com/s/${encodeURIComponent(location)}/homes`;
  if (airbnbParams.length > 0) {
    airbnbUrl += `?${airbnbParams.join('&')}`;
  }
  
  // Build Booking.com URL
  // Booking params: checkin, checkout, group_adults, nflt (filters)
  const bookingParams: string[] = [
    `ss=${encodeURIComponent(location).replace(/%20/g, '+')}`
  ];
  if (checkin) bookingParams.push(`checkin=${checkin}`);
  if (checkout) bookingParams.push(`checkout=${checkout}`);
  if (guests) bookingParams.push(`group_adults=${guests}`);
  
  // Booking.com price class filter
  // class=1 (1 star), class=2 (2 star), class=3 (3 star), class=4 (4 star), class=5 (5 star)
  if (priceTier === 1) {
    bookingParams.push('nflt=class%3D1%3Bclass%3D2%3Bclass%3D3');  // 1-3 star
  } else if (priceTier === 3) {
    bookingParams.push('nflt=class%3D4%3Bclass%3D5');  // 4-5 star
  }
  // priceTier 2 = no filter
  
  const bookingUrl = `https://www.booking.com/searchresults.html?${bookingParams.join('&')}`;
  
  return {
    airbnb: airbnbUrl,
    booking: bookingUrl
  };
}

/**
 * Extract travel details from user query
 * Parses out number of guests and budget hints
 */
export function extractTravelDetails(query: string): { guests?: number; budgetHint?: 'budget' | 'mid' | 'luxury' } {
  const result: { guests?: number; budgetHint?: 'budget' | 'mid' | 'luxury' } = {};
  
  // Extract number of people
  // Patterns: "4 people", "for 2", "couple" (2), "family" (4), "group of 6", "with my parents" (3)
  const peoplePatterns = [
    /(\d+)\s*(?:people|persons|guests|adults)/i,
    /(?:for|with)\s*(\d+)/i,
    /group\s*of\s*(\d+)/i,
  ];
  
  for (const pattern of peoplePatterns) {
    const match = query.match(pattern);
    if (match) {
      result.guests = parseInt(match[1], 10);
      break;
    }
  }
  
  // Special cases
  if (!result.guests) {
    if (/\bcouple\b/i.test(query)) result.guests = 2;
    else if (/\bsolo\b/i.test(query)) result.guests = 1;
    else if (/\bfamily\b/i.test(query)) result.guests = 4;
    else if (/\bwith my parents\b/i.test(query)) result.guests = 3;
    else if (/\bwith parents\b/i.test(query)) result.guests = 3;
  }
  
  // Extract budget hints
  const budgetWords = ['budget', 'cheap', 'affordable', 'backpack', 'hostel'];
  const luxuryWords = ['luxury', 'upmarket', 'upscale', 'fancy', 'splurge', 'five star', '5 star', 'boutique'];
  
  const queryLower = query.toLowerCase();
  if (budgetWords.some(w => queryLower.includes(w))) {
    result.budgetHint = 'budget';
  } else if (luxuryWords.some(w => queryLower.includes(w))) {
    result.budgetHint = 'luxury';
  }
  
  return result;
}

/**
 * Price tier display helper
 * Converts numeric price tier (1-3) to emoji display
 */
export function getPriceTierDisplay(priceTier: number): string {
  switch (priceTier) {
    case 1: return '💰';
    case 2: return '💰💰';
    case 3: return '💰💰💰';
    default: return '💰💰';
  }
}

/**
 * Price tier label
 */
export function getPriceTierLabel(priceTier: number): string {
  switch (priceTier) {
    case 1: return 'budget';
    case 2: return 'mid-range';
    case 3: return 'luxury';
    default: return 'mid-range';
  }
}

/**
 * Price tier color (for visual distinction)
 */
export function getPriceTierColor(priceTier: number): string {
  switch (priceTier) {
    case 1: return '#22c55e';  // Green - budget
    case 2: return '#f59e0b';  // Amber - mid-range  
    case 3: return '#a855f7';  // Purple - luxury
    default: return '#f59e0b';
  }
}

