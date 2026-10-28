import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    console.log(`🔄 Starting parallel curation for all tiers and categories for listing ${listingId}`);

    const tiers = ['estandar', 'optimo', 'plus'];
    const categories = ['costs', 'timings', 'permits', 'laws_regulations', 'norms_standards', 'market_practices', 'incentives'];

    // Determine current server origin dynamically (supports any port/env)
    const { origin } = new URL(request.url);

    // Create all endpoint URLs
    const endpoints = [];
    for (const tier of tiers) {
      for (const category of categories) {
        // Convert underscores to hyphens for URL (routes use hyphens)
        const categoryUrl = category.replace(/_/g, '-');
        endpoints.push({
          tier,
          category,
          url: `${origin}/api/listings/${listingId}/renovation-research-curate-${categoryUrl}/${tier}`
        });
      }
    }

    console.log(`📋 Running ${endpoints.length} curation endpoints in parallel`);

    // Execute all endpoints in parallel
    const results = await Promise.allSettled(
      endpoints.map(async ({ tier, category, url }) => {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          const data = await response.json();
          
          return {
            tier,
            category,
            success: response.ok,
            status: response.status,
            data: data
          };
        } catch (error) {
          return {
            tier,
            category,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    // Process results
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    console.log(`✅ Parallel curation completed: ${successful} successful, ${failed} failed`);

    return NextResponse.json({
      success: true,
      message: `Parallel curation completed for ${endpoints.length} combinations`,
      summary: {
        total: endpoints.length,
        successful,
        failed,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { error: 'Promise rejected' })
      }
    });

  } catch (error) {
    console.error('Error in parallel curation:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}