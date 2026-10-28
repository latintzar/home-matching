import { callGeminiRest } from '@/lib/gemini-rest-client';
import { getModelForTask } from '@/lib/model-registry';
import * as cheerio from 'cheerio';
import { generateUniversalPrompt } from '@/lib/extraction/rules';

export interface UniversalScrapeResult {
  title?: string;
  price_eur?: number;
  description?: string;
  listing_type?: 'sale' | 'rent';
  m2_built?: number;
  m2_useful?: number;
  bedrooms?: number;
  bathrooms?: number;
  city?: string;
  address?: string;
  lat?: number;
  lng?: number;
  main_image_url?: string;
  image_urls?: string[];
  amenities?: string[];
  additionalFeatures?: string[];
  reference?: string;
  agency?: {
    name?: string;
    logo_url?: string;
    phone?: string;
    email?: string;
  };
  contact?: {
    name?: string;
    phone?: string;
    whatsapp?: string;
    photo_url?: string;
  };
  // Raw extracted data for debugging
  raw?: any;
  // Booleans and Enums
  has_elevator?: boolean;
  is_exterior?: boolean;
  has_terrace?: boolean;
  has_balcony?: boolean;
  has_pool?: boolean;
  has_garage?: boolean;
  has_garden?: boolean;
  has_storage?: boolean;
  has_air_conditioning?: boolean;
  has_wardrobes?: boolean;
  is_accessible?: boolean;
}

/**
 * Extracts structured data from any property listing HTML using Gemini AI.
 * Uses the fastest available model ('text_analysis') for speed.
 */
export async function extractUniversalData(html: string, url: string): Promise<UniversalScrapeResult> {
  const $ = cheerio.load(html);

  // 1. Reduce HTML to essential content to save tokens and speed up processing
  // Remove scripts, styles, SVGs, and comments
  $('script, style, svg, link, meta, noscript, iframe, footer, nav, .cookie-banner, .popup').remove();
  
  // Helper to get density of text
  const getDensity = (el: any) => {
    const textLen = $(el).text().trim().length;
    const htmlLen = $(el).html()?.length || 1;
    return textLen / htmlLen;
  };

  // Try to find the main content container
  let contentHtml = '';
  const mainCandidates = $('main, article, .main-content, #main, .listing-detail, .property-details');
  
  if (mainCandidates.length > 0) {
    contentHtml = mainCandidates.first().html() || '';
  } else {
    // Fallback: Body but cleaned
    contentHtml = $('body').html() || '';
  }

  // Truncate if too large (approx 100k chars is plenty for Gemini Flash)
  if (contentHtml.length > 100000) {
    contentHtml = contentHtml.substring(0, 100000);
  }

  // 2. Extract Image Candidates separately (cheerio is faster/reliable for this)
  const imageCandidates: string[] = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy');
    if (src && !src.startsWith('data:') && src.length > 10) {
      // Absolute URL
      const fullUrl = src.startsWith('http') ? src : new URL(src, url).toString();
      
      // Filter small icons/trackers
      const width = parseInt($(el).attr('width') || '0');
      const height = parseInt($(el).attr('height') || '0');
      
      if ((!width && !height) || (width > 200 && height > 200)) {
         if (!imageCandidates.includes(fullUrl)) imageCandidates.push(fullUrl);
      }
    }
  });
  
  // Limit candidates
  const topImgCandidates = imageCandidates.slice(0, 20);

  // 3. Prompt Gemini using Shared Intelligence
  const prompt = generateUniversalPrompt(url, topImgCandidates, contentHtml);

  const result = await callGeminiRest(prompt, {
    model: getModelForTask('text_analysis'), // Uses Flash Lite for speed
    temperature: 0.1,
    responseMimeType: 'application/json'
  });

  if (!result.success || !result.text) {
    console.error('Gemini extraction failed:', result.error);
    return {};
  }

  try {
    const data = JSON.parse(result.text);
    
    // Normalize boolean flags if Gemini returned strings
    const normalizeBool = (val: any) => {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') return val.toLowerCase() === 'true';
        return false;
    };

    return {
      ...data,
      has_elevator: normalizeBool(data.has_elevator),
      is_exterior: normalizeBool(data.is_exterior),
      has_terrace: normalizeBool(data.has_terrace),
      has_balcony: normalizeBool(data.has_balcony),
      has_pool: normalizeBool(data.has_pool),
      has_garage: normalizeBool(data.has_garage),
      has_garden: normalizeBool(data.has_garden),
      has_storage: normalizeBool(data.has_storage),
      has_air_conditioning: normalizeBool(data.has_air_conditioning),
      has_wardrobes: normalizeBool(data.has_wardrobes),
      is_accessible: normalizeBool(data.is_accessible),
      raw: data
    };
  } catch (e) {
    console.error('Failed to parse Gemini response:', e);
    return {};
  }
}

