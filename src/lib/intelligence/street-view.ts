import { callGeminiRest, GeminiImageInput } from '../gemini-rest-client';

const SCRAPINGDOG_API_KEY = process.env.SCRAPINGDOG_API_KEY;
const SCRAPINGDOG_IMAGE_SEARCH_URL = 'https://api.scrapingdog.com/google/images';

export interface StreetViewAnalysis {
  images: string[];
  analysis: {
    maintenance_condition: string;
    security_features: string[];
    commercial_activity: string[];
    vibe_score: number;
    summary: string;
  };
}

export class StreetViewDetective {
  
  /**
   * Search for street/neighborhood images using ScrapingDog Google Image Search
   * Replaces expensive Google Street View API calls
   * 
   * @param lat - Latitude
   * @param lng - Longitude  
   * @param address - Full address string
   * @param city - City name
   * @param radius - Not used (kept for API compatibility)
   */
  async surveyNeighborhood(lat: number, lng: number, address: string, city: string, radius: number = 200): Promise<string[]> {
    if (!SCRAPINGDOG_API_KEY) {
      console.warn('⚠️ SCRAPINGDOG_API_KEY not set - skipping street image search');
      return [];
    }

    try {
      // Build search query - try multiple variations to get good coverage
      const streetName = address.split(',')[0]?.trim() || '';
      const queries = [
        `street view ${streetName} ${city}`,
        `${streetName} ${city} neighborhood`,
        `${streetName} ${city} exterior`,
        `${city} ${streetName} building facade`
      ];

      const allImageUrls: string[] = [];

      // Search each query and collect image URLs
      for (const query of queries) {
        try {
          const params = new URLSearchParams({
            api_key: SCRAPINGDOG_API_KEY,
            query: query,
            results: '10', // Get top 10 images per query
            country: 'es', // Spain
          });

          const response = await fetch(`${SCRAPINGDOG_IMAGE_SEARCH_URL}?${params.toString()}`);
          
          if (!response.ok) {
            console.warn(`⚠️ ScrapingDog image search failed for query "${query}": ${response.status}`);
            continue;
          }

          const data = await response.json();
          
          // Extract image URLs from ScrapingDog response
          // ScrapingDog image search typically returns: { images: [{ url, title, ... }] } or { image_results: [...] }
          if (data.images && Array.isArray(data.images)) {
            const urls = data.images
              .map((img: any) => img.url || img.link || img.src || img.image)
              .filter((url: string) => url && (url.startsWith('http://') || url.startsWith('https://')));
            
            allImageUrls.push(...urls);
            console.log(`✅ Found ${urls.length} images for query: "${query}"`);
          } else if (data.image_results && Array.isArray(data.image_results)) {
            // Alternative response structure
            const urls = data.image_results
              .map((item: any) => item.image || item.url || item.link)
              .filter((url: string) => url && (url.startsWith('http://') || url.startsWith('https://')));
            
            allImageUrls.push(...urls);
            console.log(`✅ Found ${urls.length} images (via image_results) for query: "${query}"`);
          } else if (data.organic_data && Array.isArray(data.organic_data)) {
            // Fallback: if structure is different, try organic_data
            const urls = data.organic_data
              .map((item: any) => item.url || item.link || item.image_url || item.image)
              .filter((url: string) => url && (url.startsWith('http://') || url.startsWith('https://')));
            
            allImageUrls.push(...urls);
            console.log(`✅ Found ${urls.length} images (via organic_data) for query: "${query}"`);
          } else {
            console.warn(`⚠️ Unexpected ScrapingDog response structure for query "${query}":`, Object.keys(data));
          }
        } catch (error) {
          console.error(`❌ Error searching images for "${query}":`, error);
          continue;
        }
      }

      // Remove duplicates and limit to reasonable number (max 20 images)
      const uniqueUrls = Array.from(new Set(allImageUrls)).slice(0, 20);
      
      console.log(`📸 Collected ${uniqueUrls.length} unique street/neighborhood images via ScrapingDog`);
      return uniqueUrls;

    } catch (error) {
      console.error('❌ Street image search failed:', error);
      return [];
        }
    }

  /**
   * Analyze street/neighborhood images using Gemini Vision
   * Same analysis logic as before, but now works with images from Google Image Search
   */
  async analyzeVibe(imageUrls: string[]): Promise<StreetViewAnalysis['analysis']> {
    const images: GeminiImageInput[] = [];
    
    // Download and convert images to base64 (limit to 8 for analysis)
    await Promise.all(imageUrls.slice(0, 8).map(async (url) => { 
      try {
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          if (!res.ok) {
            console.warn(`⚠️ Failed to fetch image ${url}: ${res.status}`);
            return;
          }
          const buffer = await res.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          
          // Detect MIME type from response or default to jpeg
          const contentType = res.headers.get('content-type') || 'image/jpeg';
          const mimeType = contentType.startsWith('image/') ? contentType : 'image/jpeg';
          
          images.push({ mimeType: mimeType as "image/jpeg" | "image/gif" | "image/png" | "image/webp", data: base64 });
      } catch (e) {
          console.error(`❌ Failed to fetch image ${url}:`, e);
      }
    }));

    if (images.length === 0) {
      console.warn('⚠️ No images available for analysis');
      return {
        maintenance_condition: 'No images available', 
        security_features: [], 
        commercial_activity: [], 
        vibe_score: 0, 
        summary: 'Street/neighborhood analysis could not be performed (no images found).'
    };
    }

    const prompt = `
      Role: Expert Spanish Building Surveyor and Urban Sociologist.
      Task: Analyze these street/neighborhood images of a property area.
      Look for: Fachada Condition, Security, Commercial Nuisance, Gentrification, Building Maintenance.
      Output JSON with fields: maintenance_condition, security_features (list), commercial_activity (list), vibe_score (1-10), summary.
    `;

    const schema = {
        type: 'object',
        properties: {
            maintenance_condition: { type: 'string' },
            security_features: { type: 'array', items: { type: 'string' } },
            commercial_activity: { type: 'array', items: { type: 'string' } },
            vibe_score: { type: 'number' },
            summary: { type: 'string' }
        },
        required: ['maintenance_condition', 'security_features', 'commercial_activity', 'vibe_score', 'summary']
    };

    try {
      const response = await callGeminiRest(prompt, {
        model: 'gemini-2.5-flash', 
        responseSchema: schema,
        responseMimeType: 'application/json',
        images: images
      });
      
      if (response.success && response.text) {
          return JSON.parse(response.text);
      }
      
      throw new Error(response.error || 'No response text');

    } catch (error) {
      console.error('❌ Street/neighborhood image analysis failed:', error);
      return {
        maintenance_condition: 'Analysis Failed',
        security_features: [],
        commercial_activity: [],
        vibe_score: 5,
        summary: 'Analysis failed - unable to process images.'
      };
    }
  }
}
