import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string, roomId: string }> }) {
  try {
    const { id: listingId, roomId } = await params;
    const body = await req.json().catch(() => ({}));
    const { photos = [] } = body; // [{ photo_id, base64_image }]

    const system = 'You are an image describer. Be literal and precise.';
    const prompt = [
      'Return JSON only with shape:',
      '{ "photos": [ { "photo_id": "p1", "elements": [ { "key": "window", "type": "window", "bbox": {"x0":0.1,"y0":0.1,"x1":0.5,"y1":0.4}, "confidence": 0.9 } ], "camera": {"tilt":0,"pan":0,"height":1.6} } ] }',
      'Rules:',
      '- One entry per input image in the SAME order; use the provided photo_id.',
      '- bbox values MUST be normalized 0..1.',
      '- You MUST include at least 1 element per photo; choose the most salient if uncertain.',
      `photo_ids: ${(photos || []).map((p: any) => p?.photo_id).filter(Boolean).join(', ')}`
    ].join('\n');
    // Feed photos as proper image parts (same mechanism as other image endpoints)
    const images = (photos || [])
      .filter((p: any) => typeof p?.base64_image === 'string' && p.base64_image.length > 0)
      .map((p: any) => ({ mimeType: 'image/jpeg' as const, data: p.base64_image }));

    const result = await callGeminiRest(`${system}\n\n${prompt}`, {
      model: 'gemini-2.5-flash',
      temperature: 0.2,
      maxOutputTokens: 8000,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 8192 },
      images
    });

    let placement: any = { photos: [] };
    if (result.success && result.text) {
      try { placement = JSON.parse(result.text.trim()); } catch {}
    }

    // Enforce non-empty elements per photo
    const providedCount = Array.isArray(photos) ? photos.filter((p: any) => !!p?.base64_image).length : 0;
    const allNonEmpty = Array.isArray(placement?.photos) && placement.photos.length === providedCount && placement.photos.every((ph: any) => Array.isArray(ph?.elements) && ph.elements.length > 0);
    if (providedCount > 0 && !allNonEmpty) {
      return NextResponse.json({ success: false, error: 'no_placements', details: 'Model returned empty elements for one or more photos' }, { status: 502 });
    }

    // Persist into camera_angles_json as a container for per-photo placement
    const { data: existing } = await supabase
      .from('room_analyses')
      .select('camera_angles_json, analysis_data')
      .eq('listing_id', listingId)
      .single();

    const map = existing?.camera_angles_json || {};
    map[roomId] = placement;

    const { error: upsertErr } = await supabase
      .from('room_analyses')
      .upsert({ listing_id: Number(listingId), camera_angles_json: map, analysis_data: existing?.analysis_data || {} }, { onConflict: 'listing_id' });
    if (upsertErr) return NextResponse.json({ success: false, error: 'persist_failed', details: upsertErr.message }, { status: 500 });

    return NextResponse.json({ success: true, data: placement });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'unknown_error' }, { status: 500 });
  }
}


