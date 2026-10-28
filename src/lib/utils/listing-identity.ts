/**
 * Listing Identity & Deduplication Utilities
 * 
 * Shared logic for normalizing and matching listings to enforce Single Source of Truth.
 */

/**
 * Normalizes a property reference number for consistent matching.
 * Removes prefixes like "Ref:", special characters, and whitespace.
 * 
 * @param ref Raw reference string (e.g., "Ref: 123-AB", "Reference #456")
 * @returns Normalized string (e.g., "123AB", "456") or empty string if invalid
 */
export function normalizeReference(ref: string | null | undefined): string {
  if (!ref || typeof ref !== 'string') return '';
  
  // 1. Remove common prefixes (case insensitive)
  let cleaned = ref.replace(/^(ref|reference|referencia|id)[:\.]?\s*/i, '');
  
  // 2. Remove all non-alphanumeric characters (spaces, dashes, dots, hashtags)
  cleaned = cleaned.replace(/[^a-zA-Z0-9]/g, '');
  
  // 3. Standardize to uppercase
  cleaned = cleaned.toUpperCase();
  
  // 4. Filter out too short references which might be junk
  if (cleaned.length < 2) return '';
  
  return cleaned;
}

/**
 * Checks if two listings are likely the same property based on Price and City.
 * Used as a safety check when matching by Reference Number.
 * 
 * @param candidatePrice Price of the existing listing in DB
 * @param inputPrice Price of the new listing being ingested
 * @param candidateCity City of the existing listing
 * @param inputCity City of the new listing
 * @returns boolean - True if they are likely the same property
 */
export function areListingsCompatible(
  candidatePrice: number | null | undefined,
  inputPrice: number | null | undefined,
  candidateCity: string | null | undefined,
  inputCity: string | null | undefined
): boolean {
  // 1. City Check (Strict)
  // If both have cities, they must match (case-insensitive)
  if (candidateCity && inputCity) {
    const city1 = candidateCity.trim().toLowerCase();
    const city2 = inputCity.trim().toLowerCase();
    // Simple equality check for now. Could be fuzzy in future if needed.
    if (city1 !== city2) return false;
  }

  // 2. Price Check (Fuzzy - 5% tolerance)
  // If either price is missing/zero, we can't validate by price, so we rely on Reference + City.
  // However, to be safe, if both have prices, they MUST match within tolerance.
  if (candidatePrice && inputPrice && candidatePrice > 0 && inputPrice > 0) {
    const diff = Math.abs(candidatePrice - inputPrice);
    const percentDiff = diff / inputPrice;
    
    // If price differs by more than 5%, assume it's a different listing (or significantly changed)
    // We treat significant price change as "different" for safety in auto-linking?
    // Actually, for deduplication, we want to catch it even if price changed slightly.
    // 5% is a reasonable threshold for "same listing, minor update".
    // If it's 50% different, it might be a mistake or different unit.
    if (percentDiff > 0.05) return false;
  }

  return true;
}

