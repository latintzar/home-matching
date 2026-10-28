import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    console.log(`🚀 Generating all missing research queries for listing ${listingId}`);
    
    const tiers = ['estandar', 'optimo', 'plus'];
    const categories = ['costs', 'timings', 'permits', 'laws_regulations', 'norms_standards', 'market_practices', 'incentives'];
    
    const results = [];
    
    for (const tier of tiers) {
      for (const category of categories) {
        try {
          console.log(`📝 Generating queries for ${tier} - ${category}`);
          
          const response = await fetch(`http://localhost:3000/api/listings/${listingId}/renovation-research-queries/${tier}/${category}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          const result = await response.json();
          
          if (result.success) {
            results.push({
              tier,
              category,
              status: 'success',
              queries_count: result.queries?.length || 0
            });
            console.log(`✅ Generated ${result.queries?.length || 0} queries for ${tier} - ${category}`);
          } else {
            results.push({
              tier,
              category,
              status: 'error',
              error: result.error || result.message
            });
            console.log(`❌ Failed to generate queries for ${tier} - ${category}: ${result.error || result.message}`);
          }
        } catch (error: any) {
          results.push({
            tier,
            category,
            status: 'error',
            error: error.message
          });
          console.log(`❌ Error generating queries for ${tier} - ${category}: ${error.message}`);
        }
      }
    }
    
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    console.log(`🎯 Generated ${successCount} successful query sets, ${errorCount} errors`);
    
    return NextResponse.json({
      success: true,
      message: `Generated research queries for listing ${listingId}`,
      data: {
        listing_id: listingId,
        total_attempts: results.length,
        successful: successCount,
        errors: errorCount,
        results
      }
    });

  } catch (error) {
    console.error('Batch query generation error:', error);
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
