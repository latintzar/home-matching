import { NextRequest } from 'next/server';
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

// NOTE: text_analysis_results stays in Supabase (not migrated to DynamoDB)
// Listing/cluster data could use data-adapter in future
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: listingId } = await params;
    console.log(`📊 Fetching complete Text Analysis results for listing ${listingId}`);

    // Get all Text Analysis results
    const { data: textResults, error: textError } = await supabase
      .from('text_analysis_results')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: true });

    if (textError) {
      console.error('Failed to fetch Text Analysis results:', textError);
      return Response.json({ error: 'Failed to fetch Text Analysis results' }, { status: 500 });
    }

    // Get listing data
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return Response.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Normalize listing data immediately
    const normalized = normalizeScrapedData(listing.scraped_data || {}, listing.source_url || '');

    // Get valid photos (excluding Excluded and Floorplans clusters)
    const { fetchValidListingPhotos } = await import('@/lib/photo-storage');
    let uniquePhotos: any[] = [];
    try {
      const validPhotos = await fetchValidListingPhotos(listingId, supabase as any);
    // Deduplicate photos by URL to prevent showing the same photo multiple times
      uniquePhotos = Array.from(
        new Map(validPhotos.map((photo: any) => [photo.url, photo])).values()
      );
    } catch (error) {
      console.error('Failed to fetch valid photos:', error);
    }

    // Get manual photo clusters to associate cluster names with photos
    const { data: clusters } = await supabase
      .from('clusters')
      .select('*')
      .eq('listing_id', listingId)
      .order('display_order', { ascending: true });

    // Create a map of photo URL to cluster name
    const photoToClusterMap = new Map<string, string>();
    if (clusters) {
      clusters.forEach(cluster => {
        cluster.photo_urls?.forEach((url: string) => {
          photoToClusterMap.set(url, cluster.cluster_name);
        });
      });
    }

    // Organize results by phase
    const resultsByPhase = textResults.reduce((acc, result) => {
      acc[result.phase] = result;
      return acc;
    }, {} as Record<string, any>);

    // Extract data from each phase
    const aFacts = resultsByPhase.a_facts?.results || {};
    const b1Categorization = resultsByPhase.b1_categorization?.results || {};
    const b2Merge = resultsByPhase.b2_merge?.results || {};
    const b3Snippets = resultsByPhase.b3_snippets?.results || {};
    const integratedSummary = resultsByPhase.integrated_summary?.results || {};
    const integratedDiagnostic = resultsByPhase.listing_diagnostic?.results || {};
    const cUnknowns = resultsByPhase.c_unknowns?.results || {};

    // Format for PropertyDetails component using Normalized Data
    const propertyData = {
      // Basic info - FROM NORMALIZED DATA (SINGLE SOURCE OF TRUTH)
      title: normalized.title || listing.title,
      city: normalized.city || 'Unknown City',
      address: normalized.address || 'Dirección no disponible',
      listingRef: normalized.reference || listing.reference_number || null, // Added reference
      lat: normalized.lat,
      lng: normalized.lng,
      price: normalized.price_eur,
      
      // Area logic: prefer constructed, fallback to useful (already handled by normalizer)
      constructedArea: normalized.areas.constructed,
      usefulArea: normalized.areas.useful,
      
      // New Idealista-Aligned Filters
      property_subtype: normalized.property_subtype,
      housing_situation: normalized.housing_situation,
      ad_origin: normalized.ad_origin,
      condition: normalized.condition,
      floor_level: normalized.floor_level,
      
      // Booleans
      has_elevator: normalized.has_elevator,
      has_terrace: normalized.has_terrace,
      has_balcony: normalized.has_balcony,
      has_pool: normalized.has_pool,
      has_garage: normalized.has_garage,
      has_garden: normalized.has_garden,
      has_storage: normalized.has_storage,
      has_air_conditioning: normalized.has_air_conditioning,
      has_wardrobes: normalized.has_wardrobes,
      is_accessible: normalized.is_accessible,
      is_exterior: normalized.is_exterior,
      
      bedrooms: normalized.bedrooms,
      bathrooms: normalized.bathrooms,
      sourceUrl: normalized.source_url,
      
      // Rooms and amenities - formatted for display
      roomsAndAmenities: normalized.roomsAndAmenities || (() => {
        const parts = [];
        if (normalized.bedrooms) parts.push(`${normalized.bedrooms} hab`);
        if (normalized.bathrooms) parts.push(`${normalized.bathrooms} baños`);
        return parts.length > 0 ? parts.join(' | ') : null;
      })(),
      
      // Photos - get from listing_photos table, deduplicate by URL, and map to cluster names
      photos: uniquePhotos.map(photo => ({
        url: photo.url,
        tag: photoToClusterMap.get(photo.url) || photo.caption || undefined,
        photoNumber: photo.display_order || photo.photo_number || 0
      })),
      
      // Description
      description: normalized.description,
      
      // Additional features
      additionalFeatures: normalized.additionalFeatures || [],
      
      // Text Analysis results - use key_takeaways from integrated diagnostic, fallback to integrated_summary
      headlines: integratedDiagnostic.key_takeaways?.map((takeaway: string) => ({ text: takeaway })) || integratedSummary.bullets?.map((bullet: string) => ({ text: bullet })) || [],
      categorySnippets: b3Snippets.categorySnippets || {},
      categoryUnknowns: cUnknowns.categoryUnknowns || {}, // New category-specific unknowns
      
      // Additional metadata
      views: [], // Could be extracted from claims if needed
      floor: null, // Could be extracted from claims if needed
      year: null // Could be extracted from claims if needed
    };

    // Calculate summary stats
    const summary = {
      totalPhases: Object.keys(resultsByPhase).length,
      completedPhases: Object.values(resultsByPhase).filter((r: any) => r.status === 'completed').length,
      claimsCount: aFacts.claims?.length || 0,
      categoriesCount: Object.keys(b2Merge.mergedCategories?.categories || {}).length,
      headlinesCount: integratedDiagnostic.key_takeaways?.length || integratedSummary.bullets?.length || 0,
      unknownsCount: cUnknowns.totalUnknowns || 0,
      photosCount: uniquePhotos.length
    };

    console.log(`📊 Text Analysis Results Summary:`, summary);

    return Response.json({
      success: true,
      data: propertyData,
      summary
    });

  } catch (error) {
    console.error('Text Analysis Results error:', error);
    return Response.json({
      error: `Failed to fetch text analysis results: ${(error as any)?.message || 'unknown error'}`
    }, { status: 500 });
  }
}
