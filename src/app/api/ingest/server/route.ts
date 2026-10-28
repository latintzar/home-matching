import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { normalizeScrapedData } from '@/lib/scraper-normalizer';
import { parseIdealistaHtml } from '@/lib/extraction/adapters/server';
import { extractUniversalData } from '@/lib/extraction/adapters/ai';
import { fetchWithScrapfly } from '@/lib/extraction/providers/scrapfly';
import { storeListingPhotos } from '@/lib/photo-storage';
import { normalizeReference, areListingsCompatible } from '@/lib/utils/listing-identity';

// Service key client for admin operations
const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Helper for CORS
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

// ----------------------------------------------------------------------------
// UTILITIES
// ----------------------------------------------------------------------------

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

async function createAfterPhotoSlots(listingId: string, photoCount: number): Promise<void> {
  const tiers = ['livable', 'comfortable', 'competitive'];
  const greyPlaceholder = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PC9zdmc+";
  
  console.log(`🎯 Creating ${photoCount} after photo slots for each tier (${tiers.length} tiers)`);
  
  for (let i = 0; i < photoCount; i++) {
    for (const tier of tiers) {
      try {
        const { error } = await supabaseService
          .from('after_photos')
          .upsert({
            listing_id: parseInt(listingId),
            tier: tier,
            index: i,
            url: greyPlaceholder,
            created_at: new Date().toISOString()
          }, {
            onConflict: 'listing_id,tier,index'
          });

        if (error) console.error(`❌ Failed to create slot for ${tier}[${i}]:`, error);
      } catch (error) {
        console.error(`❌ Error creating slot for ${tier}[${i}]:`, error);
      }
    }
  }
}

// ----------------------------------------------------------------------------
// MAIN HANDLER
// ----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, listingIdOverride, preview } = body;

    if (!url) {
      return NextResponse.json({ error: 'Missing URL' }, { status: 400, headers: corsHeaders() });
    }

    console.log(`🌍 Ingest Server received URL: ${url} ${preview ? '(Preview)' : ''}`);

    // 1. CHECK FOR EXISTING LISTING (By URL)
    // We defer creation until AFTER scraping to check Reference as well (Level 2 Deduplication)
    let listingId: number | null = null;
    let isNewListing = true;
    
    if (!preview) {
        if (listingIdOverride) {
            console.log(`💾 Using override listing ID: ${listingIdOverride}`);
            listingId = parseInt(String(listingIdOverride));
            isNewListing = false;
        } else {
            // Check if listing with this URL already exists
            const { data: existingListing } = await supabaseService
                .from('listings')
                .select('id')
                .eq('source_url', url)
                .single();

            if (existingListing) {
                console.log(`✅ Level 1 Deduplication: URL Match found (ID: ${existingListing.id})`);
                listingId = existingListing.id;
                isNewListing = false;
            }
        }
    }

    // 2. FETCH HTML (Strategy: Direct -> Scrapfly)
    let htmlContent = '';
    const isIdealista = url.includes('idealista.com');

    try {
        console.log('🏎️ Attempting Direct Fetch...');
        const directRes = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36' }
        });
        
        if (directRes.ok) {
            const text = await directRes.text();
            // Anti-bot check
            if (isIdealista && (text.includes('captcha') || text.includes('challenge') || text.length < 2000)) {
                throw new Error('Anti-bot detected');
            }
            htmlContent = text;
            console.log('✅ Direct fetch successful!');
        } else {
            throw new Error(`Status ${directRes.status}`);
        }
    } catch (e) {
        console.warn(`⚠️ Direct fetch failed, switching to Scrapfly Provider: ${(e as Error).message}`);
        try {
            htmlContent = await fetchWithScrapfly(url);
        } catch (scrapflyErr) {
            console.error('❌ Scrapfly failed:', scrapflyErr);
            throw new Error('All fetch strategies failed. Please use the Extension.');
        }
    }

    // 3. PARSE CONTENT (Strategy: Idealista Adapter vs Universal AI Adapter)
    let scrapedData: any = {};
    let photos: any[] = [];
    
    if (isIdealista) {
        console.log('🦁 Using Server-Side Idealista Adapter...');
        const parsed = parseIdealistaHtml(htmlContent);
        scrapedData = parsed;
        photos = parsed.photos || [];
    } else {
        console.log('🧠 Using Universal AI Adapter (Gemini Flash Lite)...');
        const parsed = await extractUniversalData(htmlContent, url);
        scrapedData = parsed;
        // Map AI image_urls to photo object structure
        if (parsed.image_urls) {
            photos = parsed.image_urls.map((u, i) => ({ url: u, tag: 'general' }));
        }
    }

    // 4. NORMALIZE
    const normalized = normalizeScrapedData(scrapedData, url);

    if (preview) {
        return NextResponse.json({ success: true, data: normalized, photos }, { headers: corsHeaders() });
    }

    // 5. LEVEL 2 DEDUPLICATION (Reference Check)
    // Only run if we haven't found a match yet
    if (isNewListing && !listingId) {
        const normRef = normalizeReference(normalized.reference);
        
        if (normRef) {
            // Find candidates with same reference
            const { data: candidates } = await supabaseService
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
                    } else {
                        console.log(`⚠️ Reference Match ignored due to incompatibility (ID: ${candidate.id})`);
                    }
                }
            }
        }
    }

    // 6. DB UPSERT (Update or Insert)
    const commonFields = {
        title: normalized.title,
        address: normalized.address,
        city: normalized.city,
        region: normalized.city,
        price_eur: normalized.price_eur,
        scraped_data: normalized,
        reference_number: normalized.reference, // Store raw ref, normalized is for search

        // Core Fields (Restored for performance)
        bedrooms: normalized.bedrooms,
        bathrooms: normalized.bathrooms,
        sqm: normalized.areas?.constructed || normalized.areas?.useful || 0,

        // New Filters
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
        
        updated_at: new Date().toISOString()
    };

    if (listingId) {
        // UPDATE EXISTING
        console.log(`💾 Updating listing ${listingId}...`);
        const { error: updateError } = await supabaseService.from('listings').update({
            ...commonFields,
            pipeline_checkpoints: { status: 'scraping' } // Reset status to trigger pipeline if needed? Or maybe 'ready'?
            // Keeping 'scraping' status implies it's active.
    }).eq('id', listingId);

    if (updateError) throw updateError;
    } else {
        // INSERT NEW
        console.log('💾 Creating new listing record...');
        const { data: newListing, error: createError } = await supabaseService.from('listings').insert({
            source_url: url,
            pipeline_checkpoints: { status: 'scraping' },
            created_at: new Date().toISOString(),
            ...commonFields
        }).select().single();
        
        if (createError) throw new Error(createError.message);
        listingId = newListing.id;
    }

    // 5. HANDLE PHOTOS (Supabase Storage)
    if (photos.length > 0 && listingId) {
        console.log(`📸 Storing ${photos.length} photos...`);
        const storageResults = await storeListingPhotos(
            photos.map((p, i) => ({ 
                url: p.url, 
                filename: `${sanitizeFilename(p.tag || 'photo')}_${i+1}.jpg` 
            })),
            listingId.toString()
        );
        
        const successful = storageResults.filter(r => r.success);
        if (successful.length > 0) {
            await supabaseService.from('listing_photos').insert(
                successful.map((r, i) => ({
                    listing_id: listingId,
                    url: r.supabaseUrl!,
                    original_url: r.originalUrl,
                    display_order: i,
                    photo_type: 'general',
                    filename: r.filename
                }))
            );
            await createAfterPhotoSlots(listingId.toString(), successful.length);
        }
    }

    return NextResponse.json({ success: true, listingId, data: normalized }, { headers: corsHeaders() });

  } catch (error: any) {
    console.error('Ingest Server Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}
