/**
 * Fetch-and-Dump Pattern Implementation
 * 
 * Key insight: We DON'T store photos. We store URLs and fetch on-demand.
 * 
 * Why:
 * - Agencies already host photos on CDNs
 * - Storing 650k × 20 photos × 500KB = 6.5TB = €550/month
 * - Fetching on-demand = €0/month
 * 
 * How it works:
 * 1. Harvest stores original photo URLs in DynamoDB
 * 2. When user views property, we fetch photos from agency URLs
 * 3. For AI analysis (WPA), we fetch photos just-in-time
 * 4. Photos are never persisted to our storage
 * 
 * Edge cases:
 * - Agency removes photo: Show placeholder, mark listing for re-crawl
 * - Agency blocks us: Use rotating user-agents, respect robots.txt
 * - Slow CDN: Add timeout, show loading state
 */

import { getListing, getListingByUrl, Listing } from './dynamodb';

// Default timeout for photo fetches (5 seconds)
const PHOTO_FETCH_TIMEOUT = 5000;

// User agents to rotate (avoid blocking)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

/**
 * Get a random user agent
 */
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Fetch a single photo from its original URL
 */
export async function fetchPhoto(url: string): Promise<{
  success: boolean;
  data?: ArrayBuffer;
  contentType?: string;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PHOTO_FETCH_TIMEOUT);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'image/*',
        'Referer': new URL(url).origin,
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    return { success: true, data, contentType };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'Timeout' };
    }
    return { success: false, error: error.message };
  }
}

/**
 * Fetch photo as base64 (for AI analysis)
 */
export async function fetchPhotoAsBase64(url: string): Promise<{
  success: boolean;
  base64?: string;
  mimeType?: string;
  error?: string;
}> {
  const result = await fetchPhoto(url);
  
  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }
  
  const base64 = Buffer.from(result.data).toString('base64');
  return { 
    success: true, 
    base64, 
    mimeType: result.contentType || 'image/jpeg',
  };
}

/**
 * Fetch multiple photos in parallel (with concurrency limit)
 */
export async function fetchPhotos(
  urls: string[], 
  concurrency = 5
): Promise<Map<string, { success: boolean; base64?: string; error?: string }>> {
  const results = new Map<string, { success: boolean; base64?: string; error?: string }>();
  
  // Process in batches
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const result = await fetchPhotoAsBase64(url);
        return { url, result };
      })
    );
    
    for (const { url, result } of batchResults) {
      results.set(url, result);
    }
  }
  
  return results;
}

/**
 * Get photos for a listing from DynamoDB (returns URLs, not images)
 */
export async function getListingPhotoUrls(
  identifier: string | { domain: string; listingId: string }
): Promise<string[]> {
  let listing: Listing | null;
  
  if (typeof identifier === 'string') {
    // Identifier is a URL
    listing = await getListingByUrl(identifier);
  } else {
    // Identifier is domain + listingId
    listing = await getListing(identifier.domain, identifier.listingId);
  }
  
  if (!listing) {
    return [];
  }
  
  return listing.image_urls || [];
}

/**
 * Fetch all photos for a listing (for WPA analysis)
 */
export async function fetchListingPhotos(
  identifier: string | { domain: string; listingId: string },
  maxPhotos = 30
): Promise<{ url: string; base64: string; mimeType: string }[]> {
  const urls = await getListingPhotoUrls(identifier);
  const limitedUrls = urls.slice(0, maxPhotos);
  
  const results = await fetchPhotos(limitedUrls);
  
  const photos: { url: string; base64: string; mimeType: string }[] = [];
  
  for (const [url, result] of results) {
    if (result.success && result.base64) {
      photos.push({
        url,
        base64: result.base64,
        mimeType: 'image/jpeg', // Assume JPEG for now
      });
    }
  }
  
  return photos;
}

/**
 * Check if a photo URL is still valid (HEAD request)
 */
export async function isPhotoUrlValid(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': getRandomUserAgent(),
      },
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Proxy endpoint for frontend to fetch photos
 * (Avoids CORS issues when displaying photos from agency CDNs)
 */
export function getPhotoProxyUrl(originalUrl: string): string {
  const encoded = encodeURIComponent(originalUrl);
  return `/api/photo-proxy?url=${encoded}`;
}

export default {
  fetchPhoto,
  fetchPhotoAsBase64,
  fetchPhotos,
  getListingPhotoUrls,
  fetchListingPhotos,
  isPhotoUrlValid,
  getPhotoProxyUrl,
};

