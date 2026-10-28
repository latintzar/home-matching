import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import * as turf from '@turf/turf';
import { calculateFitScore } from '@/lib/lifestyle/fit-scoring';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sweetSpot, filters } = body; // sweetSpot is GeoJSON Feature or Geometry

    if (!sweetSpot) {
      return NextResponse.json({ error: 'Sweet Spot GeoJSON is required' }, { status: 400 });
    }

    console.log('🔍 Starting Recommendation Filter...');
    console.log(`📍 Filter Config: City=${filters?.city || 'Any'}, Price=${filters?.minPrice || 0}-${filters?.maxPrice || 'Any'}`);

    // 1. Base Query - Fetch candidates from DB
    // Use top-level indexed columns for efficient filtering
    let query = supabase
      .from('listings')
      .select(`
        id, 
        title, 
        price_eur, 
        lat, 
        lng, 
        city, 
        description,
        scraped_data,
        bedrooms,
        bathrooms,
        sqm,
        has_elevator,
        has_terrace,
        has_balcony,
        has_parking,
        has_pool,
        has_air_conditioning,
        floor_level,
        orientation,
        property_condition,
        photos:listing_photos(url)
      `)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .eq('listing_status', 'active'); // Only active listings

    // 2. Apply Optional DB Filters (Pre-filtering)
    if (filters?.city) {
      query = query.ilike('city', `%${filters.city}%`);
    }
    
    // Enhanced Filters (from Property Preferences)
    if (filters?.property_preferences) {
        const prefs = filters.property_preferences;
        
        if (prefs.max_price) query = query.lte('price_eur', prefs.max_price);
        
        // Efficient DB Filtering on Top-Level Columns
        if (prefs.min_bedrooms) query = query.gte('bedrooms', prefs.min_bedrooms);
        if (prefs.min_bathrooms) query = query.gte('bathrooms', prefs.min_bathrooms);
        if (prefs.min_area) query = query.gte('sqm', prefs.min_area);

        // Booleans
        if (prefs.must_have_elevator) query = query.eq('has_elevator', true);
        if (prefs.must_have_terrace) query = query.eq('has_terrace', true);
        if (prefs.must_have_balcony) query = query.eq('has_balcony', true);
        if (prefs.must_have_parking) query = query.eq('has_parking', true);
        if (prefs.must_have_pool) query = query.eq('has_pool', true);
        if (prefs.must_have_air_conditioning) query = query.eq('has_air_conditioning', true);
        
        // Enums
        if (prefs.min_floor_level && prefs.min_floor_level.length > 0) {
            query = query.in('floor_level', prefs.min_floor_level);
        }
        if (prefs.orientation_preference && prefs.orientation_preference.length > 0) {
            query = query.in('orientation', prefs.orientation_preference);
        }
        if (prefs.condition_preference && prefs.condition_preference.length > 0) {
            query = query.in('property_condition', prefs.condition_preference);
        }
    } else {
        // Fallback to legacy filters
        if (filters?.minPrice) query = query.gte('price_eur', filters.minPrice);
        if (filters?.maxPrice) query = query.lte('price_eur', filters.maxPrice);
    }
    
    // Limit initial fetch to prevent memory issues (e.g., 2000 candidates)
    const { data: candidates, error } = await query.limit(2000);

    if (error) {
      console.error('❌ Database fetch error:', error);
      throw error;
    }

    console.log(`📥 Fetched ${candidates.length} candidates from DB. Running spatial filter...`);

    // 3. In-Memory Filtering (Only Spatial remaining)
    const geometry = sweetSpot.type === 'Feature' ? sweetSpot.geometry : sweetSpot;
    
    const recommendedListings = candidates.filter(listing => {
      // Spatial Check
      if (!listing.lat || !listing.lng) return false;
      
      const pt = turf.point([Number(listing.lng), Number(listing.lat)]);
      let isInside = false;
      try {
        isInside = turf.booleanPointInPolygon(pt, geometry);
      } catch (e) {
        console.warn(`⚠️ Spatial check error for listing ${listing.id}:`, e);
        return false;
      }
      
      return isInside;
    });

    console.log(`✅ Filter complete. ${recommendedListings.length} listings matched Sweet Spot.`);

    // 4. Check analysis status and Calculate Fit Scores
    const listingIds = recommendedListings.map(l => l.id);
    
    // Fetch both analysis existence AND the actual analysis data
    const { data: analyses, error: analysisCheckError } = await supabase
      .from('whole_property_analysis')
      .select('listing_id, analysis_data')
      .in('listing_id', listingIds);

    // Map analysis data by listing_id for quick lookup
    const analysisMap = new Map();
    (analyses || []).forEach(a => {
      analysisMap.set(a.listing_id, a.analysis_data);
    });

    // Track which listings need analysis
    const listingsNeedingAnalysis: number[] = [];
    
    // Prepare for parallel fit scoring
    const fitScorePromises: Promise<any>[] = [];
    const fitScoreMap = new Map();

    // 5. Process listings: Calculate scores or mark pending
    recommendedListings.forEach(l => {
      const analysisData = analysisMap.get(l.id);
      
      if (analysisData) {
        // We have analysis -> Calculate Fit Score immediately
        // Only run if we have enough info in filters to score against
        if (filters?.property_preferences || filters?.lifestyle_dna) {
          fitScorePromises.push(
            calculateFitScore({
              listing_id: l.id,
              user_preferences: {
                property_preferences: filters.property_preferences,
                lifestyle_dna: filters.lifestyle_dna
              },
              analysis_data: analysisData,
              listing_data: l // Pass listing data to avoid re-fetching
            })
            .then(score => fitScoreMap.set(l.id, score))
            .catch(err => console.warn(`⚠️ Fit scoring failed for ${l.id}:`, err))
          );
        }
      } else {
        listingsNeedingAnalysis.push(l.id);
      }
    });

    // Wait for all fit scores to calculate (Gemini Flash Lite is fast)
    if (fitScorePromises.length > 0) {
      console.log(`🧠 Calculating fit scores for ${fitScorePromises.length} cached listings...`);
      await Promise.all(fitScorePromises);
    }

    // 6. Format Response with analysis status and fit scores
    const formattedListings = recommendedListings.map(l => {
      const hasAnalysis = analysisMap.has(l.id);
      const fitScore = fitScoreMap.get(l.id);

      return {
        id: l.id,
        title: l.title,
        price: l.price_eur,
        location: { lat: l.lat, lng: l.lng, city: l.city },
        features: {
          bed: l.bedrooms || 0,
          bath: l.bathrooms || 0,
          sqm: l.sqm || 0
        },
        thumbnail: l.photos && Array.isArray(l.photos) && l.photos.length > 0 ? l.photos[0].url : null,
        match_type: 'sweet_spot',
        analysis_status: hasAnalysis ? 'cached' : 'pending',
        fit_score: fitScore || null // Include fit score if calculated
      };
    });

    // 6. Trigger async analysis for missing listings (don't block response)
    if (listingsNeedingAnalysis.length > 0) {
      console.log(`📸 Triggering analysis for ${listingsNeedingAnalysis.length} new listings...`);
      
      // Fire-and-forget: Trigger analysis in background
      listingsNeedingAnalysis.forEach(listingId => {
        // Use fetch to trigger analysis endpoint asynchronously
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000'}/api/listings/${listingId}/analysis/whole-property`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }).catch(err => {
          console.warn(`⚠️ Failed to trigger analysis for listing ${listingId}:`, err);
        });
      });
    }

    console.log(`📊 Analysis status: ${analysisMap.size} cached, ${listingsNeedingAnalysis.length} pending`);

    return NextResponse.json({
      success: true,
      count: formattedListings.length,
      total_candidates: candidates.length,
      analysis_summary: {
        cached: analysisMap.size,
        pending: listingsNeedingAnalysis.length
      },
      listings: formattedListings
    });

  } catch (error: any) {
    console.error('❌ Recommendation engine failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

