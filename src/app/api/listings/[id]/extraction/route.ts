import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing required environment variables for Supabase');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, undefined, requireRecipientConfiguration);

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    console.log('Environment check:', {
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'NOT SET'
    });

    // Get text analysis results instead of deprecated idealista_info_extraction
    const { data: textAnalysis, error } = await supabase
      .from("text_analysis_results")
      .select("*")
      .eq("listing_id", id)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    // Return all text analysis results grouped by phase
    return NextResponse.json({ results: textAnalysis });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch extraction data" },
      { status: 500 }
    );
  }
}
