import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string, roomId: string }> }) {
  try {
    const { id: listingId, roomId } = await params;
    const body = await req.json().catch(() => ({}));
    const { targetElement = 'window wall', boxed_images = [] } = body; // [{ photo_id, base64_image_with_box }]

    const { data: row } = await supabase
      .from('room_analyses')
      .select('canonical_layout_json')
      .eq('listing_id', listingId)
      .single();

    const system = `Eres un verificador. Dado un layout canónico y red‑boxes por foto, confirma si los cuadros encierran el MISMO elemento (sí/no), explica discrepancias y devuelve coordenadas ajustadas si procede. Solo JSON.`;
    const canonMap = (row?.canonical_layout_json || {}) as any;
    const canonical = canonMap[roomId] || {};
    const result = await callGeminiRest(`${system}\n\nCANONICAL:\n${JSON.stringify(canonical)}\n\nTARGET: ${targetElement}\nBOXED_IMAGES_META:${JSON.stringify(boxed_images.map((b: any) => ({ photo_id: b.photo_id, has_image: !!b.base64_image_with_box })))}`, {
      model: 'gemini-2.5-flash-lite',
      temperature: 0.1,
      maxOutputTokens: 2500,
      responseMimeType: 'application/json'
    });

    let verify: any = { target: targetElement, consensus: false, adjusted_boxes: {}, notes: '' };
    if (result.success && result.text) { try { verify = JSON.parse(result.text.trim()); } catch {} }

    // Save element boxes if provided
    const { data: current } = await supabase
      .from('room_analyses')
      .select('element_boxes_json, analysis_data')
      .eq('listing_id', listingId)
      .single();

    const boxMap = current?.element_boxes_json || {};
    const forRoom = boxMap[roomId] || {};
    forRoom[targetElement] = verify.adjusted_boxes || {};
    boxMap[roomId] = forRoom;
    const { error: upsertErr } = await supabase
      .from('room_analyses')
      .upsert({ listing_id: Number(listingId), element_boxes_json: boxMap, analysis_data: current?.analysis_data || {} }, { onConflict: 'listing_id' });
    if (upsertErr) return NextResponse.json({ success: false, error: 'persist_failed', details: upsertErr.message }, { status: 500 });

    return NextResponse.json({ success: true, data: verify });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'unknown_error' }, { status: 500 });
  }
}


