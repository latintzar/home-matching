/**
 * eTLD+1 extraction utilities
 * 
 * Extracts the "registrable domain" (eTLD+1) from a domain/hostname.
 * Example: "sub.example.co.uk" -> "example.co.uk"
 */

/**
 * Simple eTLD+1 extraction (handles common cases)
 * For production, consider using 'tldts' or 'psl' libraries
 */
export function getEtld1(domain: string): string {
  const parts = domain.toLowerCase().split('.');
  
  // Handle common known eTLDs
  const knownEtlds = [
    'co.uk', 'com.au', 'co.za',
    'gov.uk', 'ac.uk', 'edu.au',
    'com.cn', 'org.cn'
  ];
  
  // Check if it ends with a known eTLD
  for (const etld of knownEtlds) {
    if (domain.toLowerCase().endsWith(`.${etld}`)) {
      const withoutEtld = domain.toLowerCase().replace(`.${etld}`, '');
      const mainPart = withoutEtld.split('.').pop();
      return `${mainPart}.${etld}`;
    }
  }
  
  // Default: take last 2 parts for .com, .org, .es, etc.
  if (parts.length <= 2) {
    return domain.toLowerCase();
  }
  
  // For subdomains like "sub.example.com" -> "example.com"
  return parts.slice(-2).join('.');
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch {
    // If URL parsing fails, try basic extraction
    const match = url.match(/https?:\/\/([^\/]+)/);
    return match ? match[1].toLowerCase() : url;
  }
}

