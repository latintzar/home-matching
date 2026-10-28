/**
 * ⚠️ DEPRECATED: This orchestrator is deprecated and no longer maintained.
 * 
 * Use instead:
 * - `/orchestrate-basic-package` - For Basic Package (property intelligence)
 * - `/orchestrate-d-to-r3` - For Upgrade Package (renovation intelligence)
 * 
 * This old orchestrator uses deprecated endpoints and pipeline structure.
 * It is kept for reference only and should not be used in production.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params; // Await params as per Next.js 15+ warning
    console.warn(`⚠️ DEPRECATED: Using deprecated orchestrator. Use /orchestrate-basic-package or /orchestrate-d-to-r3 instead.`);
    console.log(`🚀 Starting full renovation intelligence pipeline for listing ${listingId}`);

    // Set up SSE response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const sendUpdate = (message: string, data?: any) => {
          const update = JSON.stringify({ message, data, timestamp: new Date().toISOString() });
          controller.enqueue(encoder.encode(`data: ${update}\n\n`));
        };

        const runPipeline = async () => {
          try {
            sendUpdate('Pipeline started', { listingId });

            // Step 1: Generate renovation tiers
            sendUpdate('Step 1/7: Generating renovation tiers...');
            const tierResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://127.0.0.1:3000'}/api/listings/${listingId}/renovation/generate-tiers`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            
            if (!tierResponse.ok) {
              throw new Error(`Tier generation failed: ${tierResponse.statusText}`);
            }
            
            const tierData = await tierResponse.json();
            sendUpdate('Step 1/7: Renovation tiers generated', { tiers: tierData.tiers });

            // Step 2: Generate search terms
            sendUpdate('Step 2/7: Generating search terms...');
            const searchTermsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://127.0.0.1:3000'}/api/listings/${listingId}/renovation/search-terms`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            
            if (!searchTermsResponse.ok) {
              throw new Error(`Search terms generation failed: ${searchTermsResponse.statusText}`);
            }
            
            const searchTermsData = await searchTermsResponse.json();
            sendUpdate('Step 2/7: Search terms generated', { searchTerms: searchTermsData.searchTerms });

            // Step 3: Perform custom search
            sendUpdate('Step 3/7: Performing market research...');
            const searchResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://127.0.0.1:3000'}/api/listings/${listingId}/renovation/search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            
            if (!searchResponse.ok) {
              throw new Error(`Custom search failed: ${searchResponse.statusText}`);
            }
            
            const searchData = await searchResponse.json();
            sendUpdate('Step 3/7: Market research completed', { searchResults: searchData.searchResults });

            // Step 4: Process credibility
            sendUpdate('Step 4/7: Processing credibility and extracting prices...');
            const credibilityResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://127.0.0.1:3000'}/api/listings/${listingId}/renovation/process-credibility`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            
            if (!credibilityResponse.ok) {
              throw new Error(`Credibility processing failed: ${credibilityResponse.statusText}`);
            }
            
            const credibilityData = await credibilityResponse.json();
            sendUpdate('Step 4/7: Credibility processing completed', { processedResults: credibilityData.processedResults });

            // Step 5: Finalize prices
            sendUpdate('Step 5/7: Finalizing prices based on market research...');
            const priceResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://127.0.0.1:3000'}/api/listings/${listingId}/renovation/finalize-prices`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            
            if (!priceResponse.ok) {
              throw new Error(`Price finalization failed: ${priceResponse.statusText}`);
            }
            
            const priceData = await priceResponse.json();
            sendUpdate('Step 5/7: Prices finalized', { tiers: priceData.tiers });

            // Step 6: Generate style prompts
            sendUpdate('Step 6/7: Generating style prompts for image generation...');
            const styleResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://127.0.0.1:3000'}/api/listings/${listingId}/renovation/generate-style-prompts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            
            if (!styleResponse.ok) {
              throw new Error(`Style prompt generation failed: ${styleResponse.statusText}`);
            }
            
            const styleData = await styleResponse.json();
            sendUpdate('Step 6/7: Style prompts generated', { tiers: styleData.tiers });

            // Step 7: Generate images (optional - can be run separately)
            sendUpdate('Step 7/7: Ready for image generation...');
            sendUpdate('Pipeline completed successfully!', { 
              listingId,
              completedAt: new Date().toISOString(),
              nextStep: 'Image generation can be run separately using the existing endpoint'
            });

          } catch (error) {
            console.error('❌ Pipeline error:', error);
            sendUpdate('Pipeline failed', { 
              error: error instanceof Error ? error.message : 'Unknown error',
              listingId 
            });
          } finally {
            controller.close();
          }
        };

        runPipeline();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('❌ Server error:', error);
    return NextResponse.json(
      { error: `Server error: ${error}` },
      { status: 500 }
    );
  }
}
