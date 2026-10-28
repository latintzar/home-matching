import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseIdealistaHtml } from '@/lib/extraction/adapters/server';
import { extractUniversalData } from '@/lib/extraction/adapters/ai';
import { normalizeScrapedData } from '@/lib/scraper-normalizer';
import { storeFileInSupabase } from '@/lib/photo-storage';
import { normalizeReference, areListingsCompatible } from '@/lib/utils/listing-identity';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

// Initialize Supabase Admin Client to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = lazySupabaseClient(supabaseUrl, supabaseServiceKey!);

// Helper to set CORS headers
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*', 
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(req: Request) {
  const startTime = Date.now();
  console.log('🚀 [Ingest] Start Processing...');
  
  try {
    const body = await req.json();
    const { url, html, images, timestamp, userId, extractedMetadata, useUniversalAI } = body;

    if (!url || !html || !images) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400, headers: corsHeaders() }
      );
    }

    console.log(`📦 [Ingest] Payload received. HTML size: ${html.length} chars. Images: ${images.length}`);

    // 1. Save Raw Data (Try with images, fallback without if timeout)
    let rawId = null;
    try {
        console.time('raw_insert');
        const { data: rawData, error: rawError } = await supabaseAdmin.from('raw_listings').insert({
          url,
          html,
          images, // Array of base64 strings (Huge payload)
          created_at: new Date(timestamp || Date.now()).toISOString(),
          user_id: userId || null,
        }).select('id').single(); // Optimize: Only select ID
        console.timeEnd('raw_insert');

        if (rawError) throw rawError;
        rawId = rawData.id;
    } catch (rawError: any) {
        console.warn('⚠️ Failed to save raw_listings with images (likely timeout). Retrying without images...', rawError.message);
        // Fallback: Save without images so we at least have the HTML and metadata
        try {
            const { data: rawDataFallback } = await supabaseAdmin.from('raw_listings').insert({
              url,
              html,
              images: [], // Empty array
              created_at: new Date(timestamp || Date.now()).toISOString(),
              user_id: userId || null,
            }).select('id').single();
            rawId = rawDataFallback?.id;
        } catch (fallbackError) {
            console.error('❌ Critical: Failed to save raw_listings even without images:', fallbackError);
            // Non-blocking error? No, we probably want to continue extraction even if raw fails.
            // return NextResponse.json({ error: 'Database error' }, { status: 500, headers: corsHeaders() });
        }
    }

    // 2. SERVER-SIDE PARSING
    let robustData = extractedMetadata || {}; 
    
    try {
        if (url.includes('idealista')) {
            console.log('🦁 Running Server-Side Robust Idealista Parser...');
            console.time('parsing');
            const parsed = parseIdealistaHtml(html);
            console.timeEnd('parsing');
            robustData = { ...robustData, ...parsed };
            console.log(`✅ Server-Side Parsing Complete.`);
        } else if (useUniversalAI) {
            console.log('🧠 Running Universal AI Extraction (Gemini Flash Lite)...');
            // This sacrifices speed for quality (approx 2-4s)
            const parsed = await extractUniversalData(html, url);
            robustData = { ...robustData, ...parsed };
            console.log(`✅ Universal AI Extraction Complete: ${parsed.title}`);
        }
    } catch (parseErr) {
        console.warn('⚠️ Server-side parsing failed, using client metadata:', parseErr);
    }

    // 3. Normalize Data (Shared Logic)
    const normalized = normalizeScrapedData(robustData, url);

    // Calculate expected photos count for the "Waiter"
    const expectedPhotosCount = normalized.photo_urls ? normalized.photo_urls.length : 0;

    // 4. Create Listing (Idempotent - check if exists first)
    // We want to avoid creating duplicate rows for the same URL to save analysis costs
    let listingId: number | null = null;
    let isNewListing = true;
    
    console.time('deduplication');
    // Level 1: URL Check
    const { data: existingListing } = await supabaseAdmin
        .from('listings')
        .select('id')
        .eq('source_url', url)
        .single();

    if (existingListing) {
        console.log(`✅ Level 1 Deduplication: URL Match found (ID: ${existingListing.id})`);
        listingId = existingListing.id;
        isNewListing = false;
    }

    // Level 2: Reference Check (If no URL match)
    if (isNewListing) {
        const normRef = normalizeReference(normalized.reference);
        
        if (normRef) {
            // Find candidates with same reference
            const { data: candidates } = await supabaseAdmin
                .from('listings')
                .select('id, price_eur, city')
                .eq('reference_number', normRef);

            if (candidates && candidates.length > 0) {
                for (const candidate of candidates) {
                    // Safety Check: Price & City must be compatible
                    const isCompatible = areListingsCompatible(
                        candidate.price_eur,
                        normalized.price_eur,
                        candidate.city,
                        normalized.city
                    );

                    if (isCompatible) {
                        console.log(`✅ Level 2 Deduplication: Reference Match found (ID: ${candidate.id}, Ref: ${normRef})`);
                        listingId = candidate.id;
                        isNewListing = false;
                        break; // Stop at first valid match
                    }
                }
            }
        }
    }

    if (listingId) {
        console.log(`✅ Listing already exists/matched (ID: ${listingId})`);
        console.timeEnd('deduplication');
        
        // Update the existing listing with fresh scraped data (optional but good for freshness)
        // We perform an update to refresh the timestamp and data
        await supabaseAdmin.from('listings').update({
            title: normalized.title,
            price_eur: normalized.price_eur || 0,
            scraped_data: normalized,
            reference_number: normalized.reference, // Ensure raw ref is stored
            pipeline_checkpoints: {
                status: 'scraped', // Reset to scraped to trigger re-analysis if needed
                photos_expected: expectedPhotosCount,
                photos_status: (images && images.length > 0) ? 'uploaded' : (expectedPhotosCount > 0 ? 'uploading' : 'complete')
            },
            updated_at: new Date().toISOString()
        }).eq('id', listingId);
        
    } else {
        // Create new listing
    const { data: listingData, error: listingError } = await supabaseAdmin.from('listings').insert({
      source_url: url,
      title: normalized.title || 'Imported Property', 
      address: normalized.address || 'Pending Analysis',
      city: normalized.city || '-',
      region: normalized.region || '-', 
      price_eur: normalized.price_eur || 0,
      scraped_data: normalized, // Stores full normalized object
      lat: normalized.lat || null,
      lng: normalized.lng || null,
      reference_number: normalized.reference || null,

      // Core Fields (Restored for performance)
      bedrooms: normalized.bedrooms,
      bathrooms: normalized.bathrooms,
      sqm: normalized.areas?.constructed || normalized.areas?.useful || null,

      // Pipeline Flags
      pipeline_checkpoints: {
          status: 'scraped',
          photos_expected: expectedPhotosCount,
          photos_status: (images && images.length > 0) ? 'uploaded' : (expectedPhotosCount > 0 ? 'uploading' : 'complete')
      },
      
      // New Idealista Filters
      property_subtype: normalized.property_subtype,
      housing_situation: normalized.housing_situation,
      ad_origin: normalized.ad_origin,
      
      // Booleans
      has_elevator: normalized.has_elevator,
      has_terrace: normalized.has_terrace,
      has_balcony: normalized.has_balcony,
      has_pool: normalized.has_pool,
      has_parking: normalized.has_garage,
      has_garden: normalized.has_garden,
      has_storage: normalized.has_storage,
      has_air_conditioning: normalized.has_air_conditioning,
      has_wardrobes: normalized.has_wardrobes,
      is_accessible: normalized.is_accessible,
      orientation: normalized.is_exterior ? 'Exterior' : 'Interior',
      property_condition: normalized.condition,
      floor_number: normalized.floor_number,
      floor_level: normalized.floor_level,
      balcony_orientation: normalized.balcony_orientation,
      terrace_orientation: normalized.terrace_orientation,
    }).select('id').single();

    if (listingError) {
      console.error('Supabase error (listings):', listingError);
      return NextResponse.json({ error: listingError.message }, { status: 500, headers: corsHeaders() });
        }
        listingId = listingData.id;
        console.timeEnd('deduplication');
    }

    if (!listingId) {
        throw new Error("Failed to resolve listing ID");
    }

    // 5. Upload Photos to Storage & Link (Parallel)
    // Only upload if we have new images OR if it's a new listing
    // Ideally we'd check if photos exist, but checking storage is slow.
    // A simple optimization: If existingListing was found, we might skip photo upload 
    // unless we want to force refresh. For now, we'll skip if existing.
    
    if (images && images.length > 0 && !existingListing) {
        console.log(`📸 Uploading ${images.length} base64 photos to Supabase Storage for listing ${listingId}...`);
        
        // We limit concurrency to avoid network saturation? No, Promise.all is fine for 30 items.
        const uploadPromises = images.map(async (base64Str: string, idx: number) => {
            try {
                if (!base64Str || typeof base64Str !== 'string') return null;

                // Strip header to get pure base64
                const base64Data = base64Str.replace(/^data:image\/\w+;base64,/, "");
                const nodeBuffer = Buffer.from(base64Data, 'base64');
                // Convert Node.js Buffer to ArrayBuffer
                const arrayBuffer = nodeBuffer.buffer.slice(
                    nodeBuffer.byteOffset,
                    nodeBuffer.byteOffset + nodeBuffer.byteLength
                );
                
                // Get extension
                const mimeMatch = base64Str.match(/^data:(image\/\w+);base64,/);
                const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
                const ext = mimeType.split('/')[1] || 'jpg';
                
                const filename = `extension_${idx}.${ext}`;
                
                // Upload
                const result = await storeFileInSupabase(
                    arrayBuffer,
                    mimeType,
                    listingId.toString(),
                    filename
                );
                
                if (result.success && result.supabaseUrl) {
                    return {
                        listing_id: listingId,
                        url: result.supabaseUrl, // The Storage URL!
                        display_order: idx,
                        photo_type: 'general',
                        filename: filename
                    };
                }
            } catch (e) {
                console.error(`Failed to upload photo ${idx}:`, e);
            }
            return null;
        });
        
        const validPhotos = (await Promise.all(uploadPromises)).filter(Boolean);
        
        if (validPhotos.length > 0) {
            const { error: photosError } = await supabaseAdmin.from('listing_photos').insert(validPhotos);
            if (photosError) {
                console.error('Failed to link photos:', photosError);
            } else {
                console.log(`✅ Linked ${validPhotos.length} photos to listing ${listingId}`);
            }
        }
    } 
    // OPTIMIZATION: Removed blocking server-side download. 
    // The extension now handles background uploads (Phase 2) and ListingEditor shows fallback URLs instantly.
    // This ensures the API responds < 500ms.
    /* else if (robustData.photos && robustData.photos.length > 0) {
        // ...
    } */

    const endTime = Date.now();
    console.log(`⏱️ [Ingest] Total Time: ${endTime - startTime}ms`);

    return NextResponse.json({ ok: true, id: listingId }, { headers: corsHeaders() });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
