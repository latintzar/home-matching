import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string, roomId: string }> }) {
  try {
    const { id: listingId, roomId } = await params;
    const body = await req.json().catch(() => ({}));
    const { consensusScore = 0.9 } = body;

    // Ensure all fields exist; compute final consensus_score
    const { data: row } = await supabase
      .from('room_analyses')
      .select('camera_angles_json, canonical_layout_json, element_boxes_json')
      .eq('listing_id', listingId)
      .single();

    if (!row) {
      return NextResponse.json({ success: false, error: 'missing_room_analysis' }, { status: 400 });
    }

    const { data: current } = await supabase
      .from('room_analyses')
      .select('consensus_score, analysis_data')
      .eq('listing_id', listingId)
      .single();
    const scoreMap = (current?.consensus_score as any) || {};
    scoreMap[roomId] = Number(consensusScore);
    const { error: upsertErr } = await supabase
      .from('room_analyses')
      .upsert({ listing_id: Number(listingId), consensus_score: scoreMap, analysis_data: current?.analysis_data || {} }, { onConflict: 'listing_id' });
    if (upsertErr) return NextResponse.json({ success: false, error: 'persist_failed', details: upsertErr.message }, { status: 500 });

    return NextResponse.json({ success: true, data: { listing_id: listingId, room_id: roomId, consensus_score: Number(consensusScore) } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'unknown_error' }, { status: 500 });
  }
}


