import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export const dynamic = 'force-dynamic';

type Tier = 'estandar' | 'optimo' | 'plus';

/**
 * GET /api/listings/[id]/after/evolution
 * 
 * Fetches evolution images for all rooms showing the progression
 * from furniture-free to final after-image, element by element.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const { searchParams } = new URL(request.url);
    const tier = (searchParams.get('tier') || 'estandar') as Tier;

    if (!['estandar', 'optimo', 'plus'].includes(tier)) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_tier',
          details: 'Tier must be: estandar, optimo, or plus'
        },
        { status: 400 }
      );
    }

    console.log(`📸 Fetching evolution images for listing ${listingId}, tier ${tier}`);

    // Fetch all clusters
    const { data: allClusters, error: clustersError } = await supabase
      .from('clusters')
      .select('id, cluster_name, selected_photo_url')
      .eq('listing_id', listingId.toString())
      .order('display_order');

    // Filter out excluded clusters using helper function
    const { isClusterExcluded } = await import('@/lib/photo-storage');
    const clusters = [];
    for (const c of (allClusters || [])) {
      const isExcluded = await isClusterExcluded(c.cluster_name, listingId);
      if (!isExcluded) {
        clusters.push(c);
      }
    }

    if (clustersError || !clusters || clusters.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'clusters_not_found',
          details: 'No room clusters found.'
        },
        { status: 404 }
      );
    }

    // Fetch renovation prompts to know which elements were applied
    const { data: prompts } = await supabase
      .from('renovation_prompts')
      .select('room_id, element_id')
      .eq('listing_id', listingId.toString())
      .eq('tier', tier)
      .order('element_id');

    // Group prompts by room
    const roomElementsMap = new Map<string, Array<{ element_id: string; index: number }>>();
    for (const prompt of prompts || []) {
      if (prompt.element_id && prompt.room_id) {
        if (!roomElementsMap.has(prompt.room_id)) {
          roomElementsMap.set(prompt.room_id, []);
        }
        const elements = roomElementsMap.get(prompt.room_id)!;
        elements.push({
          element_id: prompt.element_id,
          index: elements.length + 1
        });
      }
    }

    // Build evolution data for each room
    const evolutionData: Array<{
      room_id: string;
      room_name: string;
      steps: Array<{
        step: number;
        element_id: string | null;
        label: string;
        url: string;
      }>;
    }> = [];

    for (const cluster of clusters) {
      const roomId = `cluster_${cluster.id}`;
      const elements = roomElementsMap.get(roomId) || [];
      
      const steps: Array<{
        step: number;
        element_id: string | null;
        label: string;
        url: string;
      }> = [];

      // Step 0: Furniture-free
      const safeRoomId = roomId.replace(/[^a-zA-Z0-9_]/g, '_');
      const furnitureFreePath = `${listingId}/after/${tier}/evolution/${safeRoomId}_element_0_furniture_free.jpg`;
      const { data: furnitureFreeUrl } = supabase.storage
        .from('property-images')
        .getPublicUrl(furnitureFreePath);
      
      steps.push({
        step: 0,
        element_id: null,
        label: 'Furniture-Free',
        url: furnitureFreeUrl.publicUrl
      });

      // Steps 1-N: Each element
      for (const { element_id, index } of elements) {
        const safeElementId = element_id.replace(/[^a-zA-Z0-9_]/g, '_');
        const elementPath = `${listingId}/after/${tier}/evolution/${safeRoomId}_element_${index}_${safeElementId}.jpg`;
        const { data: elementUrl } = supabase.storage
          .from('property-images')
          .getPublicUrl(elementPath);
        
        steps.push({
          step: index,
          element_id: element_id,
          label: `Element ${index}: ${element_id}`,
          url: elementUrl.publicUrl
        });
      }

      evolutionData.push({
        room_id: roomId,
        room_name: cluster.cluster_name || `Room ${cluster.id}`,
        steps
      });
    }

    return NextResponse.json({
      success: true,
      listing_id: listingId,
      tier,
      rooms: evolutionData
    });

  } catch (error: any) {
    console.error('❌ Error fetching evolution images:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'internal_error',
        details: error.message
      },
      { status: 500 }
    );
  }
}

