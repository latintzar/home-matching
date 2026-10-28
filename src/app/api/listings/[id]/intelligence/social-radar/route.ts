import { NextRequest, NextResponse } from 'next/server';
import { generateAndSaveIntelligence } from '@/lib/intelligence/orchestrator';
import { createClient } from '@supabase/supabase-js';
import { PIPELINE_VERSIONS, isCacheValid } from '@/lib/pipeline-versions';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const listingId = id; // Keep as string for text ID column
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get('force_refresh') === 'true';

    console.log(`🔍 [SocialRadar] Fetching listing ${listingId}`);

    // 1. Fetch Listing Coordinates & Address (and check cache)
    const { data: listing, error } = await supabase
        .from('listings')
        .select('lat, lng, address, social_intelligence, updated_at')
        .eq('id', listingId)
        .single();

    if (error) {
        console.error(`❌ [SocialRadar] DB Error:`, error);
    }

    if (error || !listing) {
        return NextResponse.json({ 
            success: false, 
            error: error ? `DB Error: ${error.message}` : 'Listing not found (null data)',
            details: error,
            listingId: listingId
        }, { status: 404 });
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh && listing.social_intelligence && isCacheValid(listing.social_intelligence._version, PIPELINE_VERSIONS.INTELLIGENCE)) {
        console.log(`✅ [SocialRadar] Using cached intelligence data v${listing.social_intelligence._version}`);
        return NextResponse.json({
            success: true,
            cached: true,
            data: listing.social_intelligence,
            updated_at: listing.updated_at
        });
    }
    
    if (!forceRefresh && listing.social_intelligence && !isCacheValid(listing.social_intelligence._version, PIPELINE_VERSIONS.INTELLIGENCE)) {
        console.log(`🔄 [SocialRadar] Cache stale (v${listing.social_intelligence._version} → v${PIPELINE_VERSIONS.INTELLIGENCE}), regenerating...`);
    }

    console.log(`✅ [SocialRadar] Found listing:`, listing);
    console.log(`🔄 [SocialRadar] ${forceRefresh ? 'Force refresh' : 'No cache found'}, generating new intelligence...`);

    // If coordinates are missing, try to geocode or fail
    if (!listing.lat || !listing.lng) {
             console.warn(`⚠️ [SocialRadar] No coordinates for ${listingId}. Skipping intelligence.`);
             return NextResponse.json({ success: false, error: 'Listing has no coordinates' }, { status: 400 });
    }

    // Extract city from address string (fallback)
    let city = 'Unknown';
    if (listing.address) {
        const parts = listing.address.split(',');
        if (parts.length > 1) city = parts[parts.length - 2].trim();
    }

    // 2. Run Intelligence Orchestrator
    const result = await generateAndSaveIntelligence(
        parseInt(listingId), 
        listing.address || 'Unknown Address', 
        listing.lat, 
        listing.lng, 
        city
    );

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    console.error('Social Radar API Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as any).message || 'Internal Server Error' 
    }, { status: 500 });
  }
}
