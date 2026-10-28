import { NextRequest, NextResponse } from 'next/server';
import { calculateFitScore } from '@/lib/lifestyle/fit-scoring';

/**
 * POST /api/lifestyle/fit-score
 * 
 * Calculates fit score for a listing based on stored analysis + user preferences
 * Uses Gemini 2.5 Flash Lite for cost-effective scoring
 * 
 * Input:
 * {
 *   "listing_id": 12345,
 *   "user_preferences": {
 *     "property_preferences": { ... },
 *     "lifestyle_dna": { ... }
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { listing_id, user_preferences } = body;

    if (!listing_id || !user_preferences) {
      return NextResponse.json(
        { error: 'listing_id and user_preferences are required' },
        { status: 400 }
      );
    }

    console.log(`🎯 Calculating fit score for listing ${listing_id}`);

    const startTime = Date.now();
    
    // Use shared library function
    const result = await calculateFitScore({
      listing_id,
      user_preferences
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ Fit score calculated: ${result.fit_score}/100 in ${duration}ms`);

    return NextResponse.json({
      success: true,
      listing_id,
      ...result,
      response_time_ms: duration
    });

  } catch (error: any) {
    console.error('❌ Fit scoring error:', error);
    
    // Handle specific errors
    if (error.message?.includes('No analysis found')) {
      return NextResponse.json(
        { error: error.message }, 
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Fit scoring failed'
      },
      { status: 500 }
    );
  }
}

