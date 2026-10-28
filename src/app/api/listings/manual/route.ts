import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeScrapedData } from '@/lib/scraper-normalizer';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('📝 Creating manual listing...');
    console.log('📦 Payload:', JSON.stringify(body, null, 2));

    // 1. Normalize Data (Even though it comes from our form, this ensures types)
    // Pass a dummy URL for source
    const normalized = normalizeScrapedData(body, 'manual_entry');
    
    // Debug: Log normalized region
    console.log('📍 Normalized region:', normalized.region);
    console.log('📍 Normalized city:', normalized.city);

    // 2. Prepare Database Record
    const listingData = {
      title: normalized.title || 'Untitled Property',
      price_eur: normalized.price_eur || 0,
      source_url: 'manual_entry',
      reference_number: normalized.reference || null, // Added reference
      scraped_data: normalized,
      address: normalized.address || 'Unknown Address',
      city: normalized.city || 'Unknown City',
      region: (normalized.region && normalized.region.trim()) || (normalized.city && normalized.city.trim()) || 'Unknown Region', // Region is NOT NULL, use city as fallback
      country: normalized.country || 'Spain',
      lat: normalized.lat || null,
      lng: normalized.lng || null,
      agent_notes: body.notes || null, // Buyer Agent's Notes
      
      // Core Fields (Restored for performance)
      bedrooms: normalized.bedrooms ?? null,
      bathrooms: normalized.bathrooms ?? null,
      sqm: normalized.areas?.constructed || normalized.areas?.useful || null,

      // New Idealista Filters
      property_subtype: normalized.property_subtype,
      housing_situation: normalized.housing_situation,
      ad_origin: normalized.ad_origin,
      
      // Booleans
      has_elevator: normalized.has_elevator,
      has_terrace: normalized.has_terrace,
      has_balcony: normalized.has_balcony,
      has_pool: normalized.has_pool,
      has_parking: normalized.has_garage, // Map garage -> parking column
      has_garden: normalized.has_garden,
      has_storage: normalized.has_storage,
      has_air_conditioning: normalized.has_air_conditioning,
      has_wardrobes: normalized.has_wardrobes,
      is_accessible: normalized.is_accessible,
      orientation: normalized.is_exterior ? 'Exterior' : 'Interior', // Rough mapping
      property_condition: normalized.condition, // Map condition -> property_condition
      floor_number: normalized.floor_number,
      floor_level: normalized.floor_level,
      balcony_orientation: normalized.balcony_orientation,
      terrace_orientation: normalized.terrace_orientation,
      
      updated_at: new Date().toISOString(),
      pipeline_checkpoints: { status: 'manual_entry' }
    };

    // Preserve source_url if provided (for updates)
    if (body.source_url && body.source_url !== 'manual_entry') {
        listingData.source_url = body.source_url;
    }

    console.log('💾 Inserting/Updating DB:', JSON.stringify(listingData, null, 2));

    // 3. Insert or Update
    const { id: updateId } = body;
    let targetId;

    if (updateId) {
        console.log(`🔄 Updating listing ${updateId}...`);
        // Don't update source_url if it's already set correctly in DB, unless explicit override?
        // listingData already has the correct logic above.
        
        const { error } = await supabase
          .from('listings')
          .update(listingData)
          .eq('id', updateId);
        
        if (error) {
            console.error('❌ Database Update Error:', error);
            throw new Error(`Database error: ${error.message}`);
        }
        targetId = updateId;
        console.log(`✅ Updated listing ${targetId}`);
    } else {
    const { data: newListing, error } = await supabase
      .from('listings')
      .insert(listingData)
      .select('id')
      .single();

    if (error) {
      console.error('❌ Database Insert Error:', error);
      throw new Error(`Database error: ${error.message} (Code: ${error.code}, Details: ${error.details})`);
        }
        targetId = newListing.id;
        console.log(`✅ Created listing ${targetId}`);
    }

    console.log(`✅ Manual operation successful: ${targetId}`);

    // 4. Insert Photo URLs into listing_photos table (for orchestrator to find)
    const photoUrls = body.photo_urls || normalized.photo_urls || [];
    if (photoUrls.length > 0) {
      console.log(`📸 Inserting ${photoUrls.length} photo URLs into listing_photos...`);
      
      // First, clear any existing photos for this listing (in case of update)
      await supabase
        .from('listing_photos')
        .delete()
        .eq('listing_id', targetId);
      
      // Insert new photos
      const photoRecords = photoUrls.map((url: string, index: number) => ({
        listing_id: targetId,
        url: url,
        display_order: index,
        photo_type: 'general',
        created_at: new Date().toISOString()
      }));
      
      const { error: photosError } = await supabase
        .from('listing_photos')
        .insert(photoRecords);
      
      if (photosError) {
        console.warn(`⚠️ Failed to insert photos: ${photosError.message}`);
      } else {
        console.log(`✅ Inserted ${photoUrls.length} photos into listing_photos`);
      }
    }

    // 5. Handle Agency / Agent Upsert
    if (normalized.agency && normalized.agency.name) {
      console.log(`🤝 Processing agency: ${normalized.agency.name}`);
      try {
        const { data: agent, error: agentError } = await supabase
          .from('agents')
          .upsert({ 
            name: normalized.agency.name,
            logo_url: normalized.agency.logo_url,
            phone: normalized.agency.phone,
            email: normalized.agency.email,
            whatsapp: normalized.agency.whatsapp
          }, { onConflict: 'name' })
          .select('id')
          .single();

        if (agentError) {
          console.warn('⚠️ Failed to upsert agent:', agentError);
        } else if (agent) {
          // Only update if agent.id is valid
          if (agent.id) {
            const { error: updateError } = await supabase
            .from('listings')
            .update({ agent_id: agent.id })
            .eq('id', targetId);
              
            if (updateError) {
                console.warn('⚠️ Failed to link agent to listing:', updateError);
            } else {
          console.log(`✅ Linked agent ${agent.id} to listing`);
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ Error processing agency:', e);
      }
    }

    return NextResponse.json({
      success: true,
      listingId: targetId,
      data: normalized
    });

  } catch (error: any) {
    console.error('❌ Manual Entry Error:', error);
    console.error('❌ Error Stack:', error.stack);
    console.error('❌ Error Details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Unknown error', 
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    }, { status: 500 });
  }
}
