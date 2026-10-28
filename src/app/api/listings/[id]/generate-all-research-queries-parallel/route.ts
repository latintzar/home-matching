import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    console.log(`🚀 Starting parallel research query generation for listing ${listingId}`);

    const tiers = ['estandar', 'optimo', 'plus'];
    const categories = ['costs', 'timings', 'permits', 'laws_regulations', 'norms_standards', 'market_practices', 'incentives'];
    
    // Create all 21 combinations (3 tiers × 7 categories)
    const combinations = tiers.flatMap(tier => 
      categories.map(category => ({ tier, category }))
    );

    console.log(`📋 Generating ${combinations.length} research query sets in parallel`);

    // Execute all requests in parallel
    const promises = combinations.map(async ({ tier, category }) => {
      try {
        const response = await fetch(
          `http://localhost:3000/api/listings/${listingId}/renovation-research-queries/${tier}/${category}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const result = await response.json();
        
        if (!response.ok) {
          console.error(`❌ Failed ${tier}/${category}:`, result);
          return {
            tier,
            category,
            success: false,
            error: result.error || 'Unknown error'
          };
        }

        console.log(`✅ Generated ${tier}/${category}: ${result.total_queries || 0} queries`);
        return {
          tier,
          category,
          success: true,
          work_items: result.work_items?.length || 0,
          total_queries: result.total_queries || 0
        };
      } catch (error) {
        console.error(`❌ Error generating ${tier}/${category}:`, error);
        return {
          tier,
          category,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Wait for all requests to complete
    const results = await Promise.all(promises);

    // Analyze results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalQueries = successful.reduce((sum, r) => sum + (r.total_queries || 0), 0);
    const totalWorkItems = successful.reduce((sum, r) => sum + (r.work_items || 0), 0);

    console.log(`🎉 Parallel generation completed:`);
    console.log(`   ✅ Successful: ${successful.length}/${combinations.length}`);
    console.log(`   ❌ Failed: ${failed.length}/${combinations.length}`);
    console.log(`   📊 Total work items: ${totalWorkItems}`);
    console.log(`   🔍 Total queries: ${totalQueries}`);

    return NextResponse.json({
      success: true,
      message: 'Parallel research query generation completed',
      data: {
        listing_id: listingId,
        total_combinations: combinations.length,
        successful: successful.length,
        failed: failed.length,
        total_work_items: totalWorkItems,
        total_queries: totalQueries,
        results: results,
        failed_details: failed.length > 0 ? failed : undefined
      }
    });

  } catch (error) {
    console.error('Parallel research query generation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    console.log(`📊 Checking research query status for listing ${listingId}`);

    const tiers = ['estandar', 'optimo', 'plus'];
    const categories = ['costs', 'timings', 'permits', 'laws_regulations', 'norms_standards', 'market_practices', 'incentives'];
    
    // Check status of all combinations
    const statusChecks = tiers.flatMap(tier => 
      categories.map(async (category) => {
        try {
          const response = await fetch(
            `http://localhost:3000/api/listings/${listingId}/renovation-research-queries/${tier}/${category}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );

          const result = await response.json();
          
          return {
            tier,
            category,
            exists: response.ok,
            work_items: result.work_items?.length || 0,
            total_queries: result.work_items?.reduce((sum: number, item: any) => sum + (item.queries?.length || 0), 0) || 0,
            created_at: result.created_at
          };
        } catch (error) {
          return {
            tier,
            category,
            exists: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    const statusResults = await Promise.all(statusChecks);
    const existing = statusResults.filter(r => r.exists);
    const missing = statusResults.filter(r => !r.exists);
    const totalQueries = existing.reduce((sum, r) => sum + (r.total_queries || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        listing_id: listingId,
        total_combinations: statusResults.length,
        existing: existing.length,
        missing: missing.length,
        total_queries: totalQueries,
        status: statusResults,
        missing_details: missing.length > 0 ? missing : undefined
      }
    });

  } catch (error) {
    console.error('Error checking research query status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
