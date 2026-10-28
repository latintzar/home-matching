import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    console.log(`🔄 Starting SEQUENTIAL curation for all tiers and categories for listing ${listingId}`);

    const tiers = ['estandar', 'optimo', 'plus'];
    const categories = ['costs', 'timings', 'permits', 'laws_regulations', 'norms_standards', 'market_practices', 'incentives'];

    const results = [];
    let completed = 0;
    const total = tiers.length * categories.length;

    // Determine current server origin dynamically (supports any port/env)
    const { origin } = new URL(request.url);

    // Run each endpoint sequentially, one after another
    for (const tier of tiers) {
      for (const category of categories) {
        completed++;
        // Convert underscores to hyphens for URL (routes use hyphens)
        const categoryUrl = category.replace(/_/g, '-');
        const endpoint = `${origin}/api/listings/${listingId}/renovation-research-curate-${categoryUrl}/${tier}`;
        
        console.log(`📋 [${completed}/${total}] Running ${tier}/${category}...`);
        
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          const data = await response.json();
          
          const result = {
            tier,
            category,
            success: response.ok,
            status: response.status,
            data: data
          };
          
          results.push(result);
          
          if (response.ok) {
            console.log(`✅ [${completed}/${total}] ${tier}/${category} completed successfully`);
          } else {
            console.log(`❌ [${completed}/${total}] ${tier}/${category} failed: ${data.error || 'Unknown error'}`);
          }
          
        } catch (error) {
          const result = {
            tier,
            category,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
          
          results.push(result);
          console.log(`❌ [${completed}/${total}] ${tier}/${category} failed: ${result.error}`);
        }
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    console.log(`✅ Sequential curation completed: ${successful} successful, ${failed} failed`);

    return NextResponse.json({
      success: true,
      message: `Sequential curation completed for ${total} combinations`,
      summary: {
        total,
        successful,
        failed,
        results: results
      }
    });

  } catch (error) {
    console.error('Error in sequential curation:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
