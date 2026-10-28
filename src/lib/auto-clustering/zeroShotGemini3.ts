/**
 * Shared Zero-Shot Clustering Helper
 * 
 * Uses Gemini 3 Pro Preview to cluster photos in a single pass (zero-shot).
 * This is the PRIMARY clustering method used by the production pipeline.
 */

import { createClient } from '@supabase/supabase-js';
import { convertSupabaseUrlToBase64 } from '@/lib/photo-storage';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
const API_ENDPOINT = 'aiplatform.googleapis.com';
const MODEL_ID = 'gemini-3-pro-preview';
const GENERATE_CONTENT_API = 'streamGenerateContent';

export interface ZeroShotCluster {
  cluster_name: string;
  photo_indices: number[];
  room_type?: string;
  description?: string;
  confidence?: number;
}

export interface ZeroShotResult {
  clusters: ZeroShotCluster[];
  excluded_content?: {
    type: string;
    photo_indices: number[];
    reason: string;
  }[];
  reasoning?: string;
  photo_urls?: string[]; // Maps imageParts array index to photo URL
  photo_indices_mapping?: number[]; // Maps imageParts array index to original photo index
}

export interface ZeroShotRunConfig {
  listingId: string;
  temperature: number;                // e.g. 0.7
  promptVariant: 'visual-priority';  // only this variant in production
}

/**
 * Build listing context string from listing data
 */
function buildListingContext(listing: any, scrapedData: any): string {
  return `
PROPERTY CONTEXT:
${listing ? `
BASIC INFO:
- Title: ${listing.title || scrapedData.title || 'N/A'}
- Price: ${listing.price_eur || scrapedData.price || 'N/A'}€
- City: ${listing.city || scrapedData.city || 'N/A'}
- Address: ${listing.address || scrapedData.address || 'N/A'}
- Property Type: ${listing.property_type || scrapedData.propertyType || 'N/A'}
- Year Built: ${listing.year_built || scrapedData.yearBuilt || 'N/A'}
- Floor: ${listing.floor_number || scrapedData.floor || 'N/A'}

SIZE & ROOMS:
- Constructed Area: ${scrapedData.areas?.constructed || listing.area || 'N/A'} m²
- Useful Area: ${scrapedData.areas?.useful || 'N/A'} m²
- Bedrooms: ${scrapedData.bedrooms || listing.rooms || 'N/A'}
- Bathrooms: ${scrapedData.bathrooms || listing.bathrooms || 'N/A'}

FEATURES:
${scrapedData.roomsAndAmenities ? `- Rooms & Amenities: ${scrapedData.roomsAndAmenities}` : ''}
${scrapedData.additionalFeatures && scrapedData.additionalFeatures.length > 0 
  ? `- Additional Features: ${scrapedData.additionalFeatures.join(', ')}` 
  : ''}
${scrapedData.orientation ? `- Orientation: ${scrapedData.orientation}` : ''}
${scrapedData.energyRating ? `- Energy Rating: ${scrapedData.energyRating}` : ''}
${scrapedData.communityFee ? `- Community Fee: ${scrapedData.communityFee}€/month` : ''}

DESCRIPTION:
${scrapedData.description || 'No description available'}
` : 'No listing data available'}
`;
}

/**
 * Build the refined visual-priority prompt
 */
function buildPrompt(listingContext: string, imageCount: number): string {
  const visualPriorityInstruction = `

IMPORTANT: PRIORITIZE VISUAL CONTINUITY OF EACH PHYSICAL SPACE

- Scan ALL photos and group images that share the same shell: flooring, wall finishes, ceiling height and fixed architectural elements (walls, doors, columns, windows).
- Use repeating visual patterns and textures (floor tile patterns, wood grain, rugs/carpets, upholstery fabrics, wall patterns) as strong evidence that photos belong to the same room/space.
- If a photo shows only a corner or sub-zone of a room (for example, a sitting area, reading corner or desk), but the shell and fixed elements clearly match another cluster, treat it as part of that room's cluster instead of creating a separate micro-cluster.
- Treat a continuous open-plan area (no solid walls or doors, same flooring and walls) as ONE physical space, even if furniture or usage zones (seating, dining, work corner) change.
- Do NOT create separate clusters only because the furniture changes. Only split spaces when there is a clear physical separation (different room, different flooring, a wall or doorway, clearly different finishes).
- For each photo, focus on the primary interior space in the foreground. Background views or distant exterior scenery should not change the room/space classification.
- Photos that mainly show external views (landscapes, sea, city, sky, etc.) with little or no interior should be excluded as type "view" in "excluded_content", not grouped with interior rooms or terraces.
- When a photo could belong to more than one cluster, assign it to the cluster whose other photos have the closest visual match in the shell (flooring, walls, structure).
- Only merge photos into the same cluster when the physical space is clearly the same (continuous shell and no separating wall/door). Do not merge separate bedrooms, bathrooms or clearly distinct rooms even if they share similar decor.
- If floorplan images are present, use them only as visual hints to understand how rooms connect and where they are located. The floorplan itself must stay in "excluded_content" as type "floorplan", and if the floorplan conflicts with the photos, follow the photos.
`;

  return `You are an expert at analyzing property photos and organizing them into logical room clusters.

${listingContext}

TASK: Analyze all ${imageCount} photos and cluster them into logical groups representing different rooms/spaces in the property.

PHOTOS: Photos are indexed from 0 to ${imageCount - 1}. Analyze each photo carefully.

CLUSTERING RULES:
1. Group photos that show the SAME room or space together.
2. Use descriptive cluster names in Spanish (e.g., "Salón", "Cocina", "Dormitorio Principal", "Baño", "Terraza").
3. Be precise – if two photos show different angles of the same room, they belong together.
4. If a photo shows multiple areas inside ONE continuous open-plan space (same flooring/walls, no solid separation), treat them as the same room/space and assign the photo to that combined cluster. If a photo shows two clearly different rooms separated by a doorway or strong boundary, assign it only to the main room in the foreground.
5. Exclude non-property-content photos in "excluded_content": external views (landscapes, sea, city, sky), pure view shots from windows or terraces, floorplans, certificates, documents. Floorplan images may be used as hints to understand the layout and how rooms connect, but must remain excluded and should not be assigned to any room/space cluster.
6. Create separate clusters for different rooms even if they are similar (e.g., "Dormitorio 1" vs "Dormitorio 2"). In open-plan spaces, furniture-based zones (seating, dining, study corners) can be merged into one cluster when they share a continuous shell, and small sub-zones inside a room should not become their own cluster. Only treat infrastructure-heavy service zones (for example, cooking, bathing, laundry, with fixed cabinets, appliances, sinks or sanitaryware) as a separate cluster when clearly visible.
7. Outdoor spaces should be separate: "Terraza", "Jardín", "Balcón", etc.
${visualPriorityInstruction}
OUTPUT FORMAT (JSON):
{
  "clusters": [
    {
      "cluster_name": "Salón",
      "photo_indices": [0, 1, 2],
      "room_type": "living_room",
      "description": "Main living room with modern furniture",
      "confidence": 0.95
    },
    ...
  ],
  "excluded_content": [
    {
      "type": "view",
      "photo_indices": [15],
      "reason": "External marina view without property content"
    },
    ...
  ],
  "reasoning": "Brief explanation of clustering decisions"
}

Return ONLY valid JSON, no markdown formatting.`;
}

/**
 * Run Gemini 3 zero-shot clustering
 */
export async function runZeroShotGemini3(
  config: ZeroShotRunConfig
): Promise<ZeroShotResult> {
  const { listingId, temperature } = config;

  console.log(`🔍 [ZeroShot] Starting for listing ${listingId}`);

  if (!API_KEY) {
    throw new Error('API key not found. Set GEMINI_API_KEY or GOOGLE_CLOUD_API_KEY');
  }

  // Fetch all photos
  console.log(`📸 [ZeroShot] Fetching photos from listing_photos table...`);
  const { data: photos, error: photosError } = await supabase
    .from('listing_photos')
    .select('url, display_order')
    .eq('listing_id', listingId)
    .order('display_order');

  if (photosError) {
    console.error(`❌ [ZeroShot] Failed to fetch photos from DB:`, photosError);
    throw new Error(`Failed to fetch photos: ${photosError.message}`);
  }

  console.log(`📸 [ZeroShot] Found ${photos?.length || 0} photos in listing_photos table`);

  // Fetch full listing with scraped_data
  console.log(`📋 [ZeroShot] Fetching listing data...`);
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('*, scraped_data')
    .eq('id', listingId)
    .single();

  if (listingError) {
    console.warn(`⚠️ [ZeroShot] Failed to fetch listing: ${listingError.message}`);
  }

  const scrapedData = (listing as any)?.scraped_data || {};
  console.log(`📋 [ZeroShot] Scraped data keys:`, Object.keys(scrapedData));
  console.log(`📋 [ZeroShot] photo_urls length:`, scrapedData.photo_urls?.length || 0);
  console.log(`📋 [ZeroShot] photos length:`, scrapedData.photos?.length || 0);
  
  // Fallback: If no photos in listing_photos, try scraped_data.photo_urls or scraped_data.photos (Extension path)
  let finalPhotos = photos || [];
  let isBase64Source = false;

  // Check both photo_urls (normalizer format) and photos (legacy format)
  const scrapedPhotos = scrapedData.photo_urls || scrapedData.photos || scrapedData.image_urls || [];
  
  if (finalPhotos.length === 0 && Array.isArray(scrapedPhotos) && scrapedPhotos.length > 0) {
    console.log(`ℹ️ [ZeroShot] No photos in listing_photos, using ${scrapedPhotos.length} photos from scraped_data (Extension source)`);
    finalPhotos = scrapedPhotos
      .filter((p: string) => {
        if (!p) return false;
        // Reject SVGs
        if (p.startsWith('data:image/svg') || p.includes('.svg')) return false;
        // Reject obvious non-image data if it's not likely a photo
        if (p.startsWith('data:application/pdf')) return false;
        return true;
      })
      .map((p: string, idx: number) => ({
        url: p, // This might be base64
        display_order: idx
      }));
    
    console.log(`ℹ️ [ZeroShot] Filtered to ${finalPhotos.length} valid photos (removed SVGs/bad formats)`);
    isBase64Source = true;
  }

  if (finalPhotos.length === 0) {
    console.error(`❌ [ZeroShot] No photos found. DB photos: ${photos?.length || 0}, scraped photos: ${scrapedPhotos.length}`);
    throw new Error(`No photos found for this listing. Checked listing_photos table (${photos?.length || 0} photos) and scraped_data (${scrapedPhotos.length} photos)`);
  }

  console.log(`✅ [ZeroShot] Using ${finalPhotos.length} photos for clustering`);

  const listingContext = buildListingContext(listing, scrapedData);

  // Convert all photos to base64 in parallel (or prepare existing base64)
  const photoConversions = await Promise.all(
    finalPhotos.map(async (photo, idx) => {
      try {
        let base64: string | null = null;
        
        if (isBase64Source && photo.url.startsWith('data:')) {
          // It's a data URI (image/jpeg, application/octet-stream, etc), strip the prefix
          const parts = photo.url.split(',');
          if (parts.length > 1) {
            base64 = parts[1];
          } else {
            // Fallback if no comma found but starts with data: (unlikely valid but safe)
            base64 = photo.url.replace(/^data:.*?;base64,/, '');
          }
        } else if (isBase64Source && !photo.url.startsWith('http')) {
           // Assume it's raw base64 without prefix if it's not http
           base64 = photo.url;
        } else {
          // Standard URL fetch
          base64 = await convertSupabaseUrlToBase64(photo.url);
        }

        // IMPORTANT: For visibility mapping, we need the original URL or base64 reference
        // If we're using base64, `photo.url` contains the full data URI
        const resultUrl = isBase64Source ? photo.url : photo.url;

        return { idx, base64, url: resultUrl, success: true };
      } catch (error) {
        console.warn(`⚠️ Failed to convert photo ${idx}:`, error);
        return { idx, base64: null, url: isBase64Source ? `photo-${idx}` : photo.url, success: false };
      }
    })
  );

  const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
  const photoUrls: string[] = [];
  const photoIndices: number[] = [];

  photoConversions.forEach(({ idx, base64, url, success }) => {
    if (success && base64 && url) {
      imageParts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64,
        },
      });
      photoUrls.push(url);
      photoIndices.push(idx);
    }
  });

  if (imageParts.length === 0) {
    throw new Error('Failed to convert any photos to base64');
  }

  // Build prompt
  const prompt = buildPrompt(listingContext, imageParts.length);

  // Build request body
  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          ...imageParts,
        ],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens: 50000,
      topP: 0.95,
      thinkingConfig: {
        thinkingLevel: 'HIGH',
      },
      responseMimeType: 'application/json',
    },
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'OFF',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'OFF',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'OFF',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'OFF',
      },
    ],
  };

  const url = `https://${API_ENDPOINT}/v1/publishers/google/models/${MODEL_ID}:${GENERATE_CONTENT_API}?key=${encodeURIComponent(API_KEY)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const rawResponse = await response.text();

  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = JSON.parse(rawResponse);
    } catch {}
    throw new Error(errorData.error?.message || `HTTP ${response.status}`);
  }

  // Parse stream response
  let responseArray: any[];
  try {
    responseArray = JSON.parse(rawResponse);
    if (!Array.isArray(responseArray)) {
      responseArray = [responseArray];
    }
  } catch (parseError) {
    throw new Error(`Failed to parse response: ${parseError}`);
  }

  // Extract text from all chunks
  let responseText = '';
  for (const chunk of responseArray) {
    const candidates = chunk?.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate?.content?.parts || [];
      for (const part of parts) {
        if (part?.text) {
          responseText += part.text;
        }
      }
    }
  }

  if (!responseText) {
    throw new Error('Empty response from Gemini 3 Pro Preview');
  }

  // Parse JSON
  const cleanText = responseText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  const zeroShotResult: ZeroShotResult = JSON.parse(cleanText);

  // Add photo URLs mapping so endpoints can map indices to URLs
  zeroShotResult.photo_urls = photoUrls;
  zeroShotResult.photo_indices_mapping = photoIndices;

  return zeroShotResult;
}

