import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface PropertyDetailsData {
  // Basic property data
  title?: string | null;
  city?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  propertyType?: string | null;
  price?: number | null;
  year?: number | null;
  constructedArea?: number | null;
  usefulArea?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  views?: string[] | null;
  roomsAndAmenities?: string | null;
  floor?: string | null;
  
  // Text Analysis pipeline data
  headlines?: { text: string }[] | null;
  categorySnippets?: Record<string, { text: string }[]> | null;
  unknownsChecklist?: string[] | null;
  contextualFollowups?: string[] | null;
  
  // Photos from Text Analysis results
  photos?: { url: string; tag: string; clusterName?: string; photoNumber?: number }[] | null;
  
  // Pipeline status
  pipelineStatus?: {
    scraping: boolean;
    textAnalysis: boolean;
    clustering: boolean;
    analysis: boolean;
  };
}

export function usePropertyDetailsData(listingId: string | null) {
  const [data, setData] = useState<PropertyDetailsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!listingId) {
      setData(null);
      return;
    }
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log(`🔍 Fetching complete property details for listing ${listingId}`);
        
        // Fetch all data in parallel
        const [listingResult, textResultsResult, manualClustersResult] = await Promise.all([
          // Basic listing data
          supabase
            .from('listings')
            .select('*')
            .eq('id', listingId)
            .single(),
          
          // Text analysis results
          supabase
            .from('text_analysis_results')
            .select('*')
            .eq('listing_id', listingId)
            .order('created_at', { ascending: true }),
          
          // Clusters (production clusters from auto-clustering)
          supabase
            .from('clusters')
            .select('*')
            .eq('listing_id', listingId)
            .order('created_at', { ascending: true })
        ]);

        // Check for errors
        if (listingResult.error) {
          throw new Error(`Failed to fetch listing: ${listingResult.error.message}`);
        }
        
        if (textResultsResult.error) {
          throw new Error(`Failed to fetch text analysis results: ${textResultsResult.error.message}`);
        }
        
        if (manualClustersResult.error) {
          throw new Error(`Failed to fetch room clusters: ${manualClustersResult.error.message}`);
        }

        const listing = listingResult.data;
        const textResults = textResultsResult.data || [];
        const roomClusters = manualClustersResult.data || [];

        // Get photos from database
        const { data: photosData } = await supabase
          .from('listing_photos')
          .select('*')
          .eq('listing_id', listingId)
          .order('display_order', { ascending: true });
        
        const photos = photosData?.map((photo: any, index: number) => ({
          url: photo.url,
          tag: photo.tag,
          photoNumber: photo.photo_number || index + 1
        })) || [];

        // Extract text analysis data
        const headlines = textResults.find(r => r.phase === 'listing_diagnostic')?.results?.key_takeaways || textResults.find(r => r.phase === 'integrated_summary')?.results?.bullets || [];
        const categorySnippets = textResults.find(r => r.phase === 'b3_snippets')?.results?.categorySnippets || {};
        const unknownsChecklist = textResults.find(r => r.phase === 'c_unknowns')?.results?.unknownsChecklist || [];

        // Determine pipeline status
        const pipelineStatus = {
          scraping: !!listing,
          textAnalysis: textResults.length > 0,
          clustering: roomClusters.length > 0,
          analysis: false // TODO: Check analysis_results table
        };

        // Extract data from scraped_data JSONB
        const scrapedData = (listing as any).scraped_data || {};
        const bedroomsFromScraped = scrapedData.bedrooms ? parseInt(scrapedData.bedrooms, 10) : null;
        const bathroomsFromScraped = scrapedData.bathrooms ? parseFloat(scrapedData.bathrooms) : null;
        const areas = scrapedData.areas || {};
        const constructedAreaFromScraped = areas.constructed ? parseFloat(areas.constructed) : null;
        const usefulAreaFromScraped = areas.useful ? parseFloat(areas.useful) : null;

        // Transform to PropertyDetailsData format
        const propertyDetailsData: PropertyDetailsData = {
          // Basic property data
          title: listing.title,
          city: listing.city,
          address: listing.address,
          lat: listing.lat,
          lng: listing.lng,
          propertyType: listing.property_type,
          price: listing.price_eur ? parseFloat(listing.price_eur) : 0,
          year: listing.year_built,
          constructedArea: constructedAreaFromScraped,
          usefulArea: usefulAreaFromScraped,
          bedrooms: bedroomsFromScraped,
          bathrooms: bathroomsFromScraped,
          views: [], // Not in listings table yet
          roomsAndAmenities: scrapedData.roomsAndAmenities || null,
          floor: listing.floor_number?.toString() || null,
          
          // Text analysis pipeline data
          headlines,
          categorySnippets,
          unknownsChecklist,
          
          // Photos
          photos,
          
          // Pipeline status
          pipelineStatus
        };

        console.log(`✅ Property details loaded: ${photos.length} photos, ${textResults.length} text analysis phases, ${roomClusters.length} clusters`);
        setData(propertyDetailsData);
        
      } catch (err) {
        console.error('Error fetching property details:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [listingId]);

  return { data, loading, error };
}
