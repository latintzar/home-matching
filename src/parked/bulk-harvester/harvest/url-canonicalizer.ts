/**
 * URL Canonicalizer
 * 
 * Normalizes URLs for deduplication and consistent storage.
 * Handles: www prefix, trailing slashes, query params, tracking params, fragments.
 */

/**
 * Canonicalize a URL for consistent storage/comparison
 */
export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // 1. Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();
    
    // 2. Remove www prefix (treat www.example.com = example.com)
    parsed.hostname = parsed.hostname.replace(/^www\./, '');
    
    // 3. Remove trailing slash from path (except root)
    if (parsed.pathname !== '/') {
      parsed.pathname = parsed.pathname.replace(/\/$/, '');
    }
    
    // 4. Remove tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid',
      'mc_cid', 'mc_eid', '_ga', '_gl',
      'ref', 'source', 'campaign'
    ];
    const params = new URLSearchParams(parsed.search);
    trackingParams.forEach(p => params.delete(p));
    
    // 5. Sort remaining query parameters (for consistent hashing)
    const sortedParams = new URLSearchParams([...params].sort());
    parsed.search = sortedParams.toString();
    
    // 6. Remove fragment (hash)
    parsed.hash = '';
    
    // 7. Force HTTPS
    parsed.protocol = 'https:';
    
    return parsed.toString();
  } catch {
    // If URL is invalid, return as-is
    return url;
  }
}

/**
 * Extract domain from URL (without www)
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Generate a hash key for S3 storage
 */
export function urlToHashKey(url: string): string {
  const canonical = canonicalizeUrl(url);
  // Simple hash using built-in
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    const char = canonical.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate S3 key for storing HTML
 */
export function urlToS3Key(url: string): string {
  const domain = extractDomain(url);
  const hash = urlToHashKey(url);
  return `html/${domain}/${hash}.html.gz`;
}

/**
 * Check if two URLs are the same after canonicalization
 */
export function urlsAreSame(url1: string, url2: string): boolean {
  return canonicalizeUrl(url1) === canonicalizeUrl(url2);
}

/**
 * Deduplicate a list of URLs
 */
export function deduplicateUrls(urls: string[]): string[] {
  const seen = new Map<string, string>();
  
  for (const url of urls) {
    const canonical = canonicalizeUrl(url);
    if (!seen.has(canonical)) {
      seen.set(canonical, url);
    }
  }
  
  return Array.from(seen.values());
}

// CLI for testing
if (require.main === module) {
  const testUrls = [
    'https://www.example.es/piso-madrid-123/',
    'https://example.es/piso-madrid-123',
    'http://www.EXAMPLE.es/piso-madrid-123?utm_source=google',
    'https://example.es/piso-madrid-123#photos',
  ];
  
  console.log('URL Canonicalization Test:\n');
  for (const url of testUrls) {
    console.log(`Original:  ${url}`);
    console.log(`Canonical: ${canonicalizeUrl(url)}`);
    console.log(`S3 Key:    ${urlToS3Key(url)}`);
    console.log();
  }
  
  console.log('All same URL?', testUrls.every(u => urlsAreSame(u, testUrls[0])));
  console.log('Deduplicated:', deduplicateUrls(testUrls));
}

