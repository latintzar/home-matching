import { NextResponse } from 'next/server';
import { HarvestEngine } from '@/lib/harvest/HarvestEngine';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Supabase environment variables not configured');
  }
  return createClient(url, key);
}

// Cron Security: Only allow Vercel Cron to trigger this
// Vercel sends `Authorization: Bearer <CRON_SECRET>`
function isAuthenticated(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return false;
  }
  return true;
}

export async function GET(request: Request) {
  // 1. Security Check
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseClient();
  console.log('⏰ Cron Job Triggered: Daily Harvest');

  try {
    // 2. Fetch Due Tasks (Batch of 10 to avoid timeouts)
    // We process small batches frequently instead of one massive run
    const { data: queueItems, error } = await supabase
      .from('harvest_queue')
      .select('domain, seed_url')
      .lte('next_run', new Date().toISOString()) // Due now or in past
      .eq('status', 'pending')
      .order('priority', { ascending: false }) // High value first
      .limit(10);

    if (error) throw error;

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({ message: 'No domains due for harvest.' });
    }

    console.log(`🚜 Processing ${queueItems.length} domains...`);
    const engine = new HarvestEngine();
    const results = [];

    // 3. Execute Batch
    for (const item of queueItems) {
      // Mark as processing immediately to prevent double-work
      await supabase
        .from('harvest_queue')
        .update({ status: 'processing' })
        .eq('domain', item.domain);

      // Run Engine
      const result = await engine.processDomain(item.domain, item.seed_url);
      
      results.push({
        domain: item.domain,
        success: result.success,
        listings_found: result.count || 0,
        used_ai: result.usedAI
      });
    }

    return NextResponse.json({ 
      success: true, 
      processed: results.length,
      results 
    });

  } catch (error: any) {
    console.error('Cron Job Failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

