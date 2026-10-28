import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function limitConcurrency<T, R>(items: T[], limit: number, handler: (item: T, index: number) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return Promise.resolve([]);
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) return;
      try { results[current] = await handler(items[current], current); } catch (e: any) { /* @ts-ignore*/ results[current] = e; }
    }
  });
  return Promise.all(workers).then(() => results);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: listingId } = await params;
  try {
    const { data: row, error } = await supabase
      .from('room_analyses')
      .select('canonical_layout_json')
      .eq('listing_id', listingId)
      .single();
    if (error) return NextResponse.json({ success: false, error: 'load_failed', details: error.message }, { status: 500 });

    const canon = (row?.canonical_layout_json || {}) as Record<string, any>;
    const roomIds = Object.keys(canon).filter((k) => Array.isArray(canon[k]?.elements) && canon[k].elements.length > 0);
    if (roomIds.length === 0) return NextResponse.json({ success: false, error: 'no_rooms' }, { status: 400 });

    const concurrency = Number(process.env.F3_CONCURRENCY || 4);
    const stats: { room_id: string; status: 'ok' | 'error'; error?: string; element_id?: string }[] = [];

    const results = await limitConcurrency(roomIds, concurrency, async (roomId) => {
      try {
        // choose a small element per room
        const preferSmallTypes = new Set(['handle','knob','switch','outlet','tap','faucet','bidet','lamp','nightstand','sconce','plant','painting','frame','mirror','vent','grille','hinge','socket']);
        const els: any[] = canon[roomId].elements || [];
        let chosen = els.find((e) => preferSmallTypes.has(String(e?.type || '').toLowerCase()));
        if (!chosen) {
          const withLen = els.map((e) => ({ e, l: (e?.visual_description || '').length })).sort((a,b)=>a.l-b.l);
          chosen = withLen[0]?.e || els[0];
        }
        const elementId = chosen?.id;
        const base = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get('host') || 'localhost:3000'}`;
        const res = await fetch(`${base}/api/listings/${listingId}/rooms/${roomId}/layout/redbox`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ element_id: elementId, seed: 42 })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) { stats.push({ room_id: roomId, status: 'error', error: json?.error || `HTTP ${res.status}` }); return false; }
        stats.push({ room_id: roomId, status: 'ok', element_id: json.element_id });
        return true;
      } catch (e: any) {
        stats.push({ room_id: roomId, status: 'error', error: e?.message || 'unknown_error' });
        return false;
      }
    });

    const ok = results.filter(Boolean).length;
    return NextResponse.json({ success: true, processed_rooms: ok, total_rooms: roomIds.length, stats });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'unknown_error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, error: 'method_not_allowed' }, { status: 405 });
}


