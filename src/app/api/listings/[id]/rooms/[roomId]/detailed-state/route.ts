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
    const { language = 'es' } = body;

    // Fetch canonical layout artifacts from F1–F4
    const { data: roomRow, error } = await supabase
      .from('room_analyses')
      .select('canonical_layout_json, element_boxes_json, camera_angles_json')
      .eq('listing_id', listingId)
      .eq('room_id', roomId)
      .single();
    if (error) {
      return NextResponse.json({ success: false, error: 'room_analysis_not_found' }, { status: 404 });
    }

    const system = language === 'es'
      ? `Eres un perito de viviendas. Dado el layout canónico (elementos y relaciones), las cajas por elemento (por foto) y metadatos de cámara, escribe un análisis conciso del estado de la estancia.
Devuelve SOLO JSON con:
{ materials: string[], condition: string, defects: string[], risks: string[], verify: string[] }
Usa referencias a elementos/fotos cuando sea relevante (p. ej., "ventana norte (foto 3)").`
      : `You are a building surveyor. Given canonical layout (elements/relations), element boxes per photo, and camera metadata, produce a concise room state analysis.
Return JSON only: { materials: string[], condition: string, defects: string[], risks: string[], verify: string[] }`;

    const context = {
      canonical_layout: roomRow?.canonical_layout_json || {},
      element_boxes: roomRow?.element_boxes_json || {},
      camera: roomRow?.camera_angles_json || {},
    };

    const result = await callGeminiRest(`${system}\n\nCONTEXT:\n${JSON.stringify(context).slice(0, 120000)}`, {
      model: 'gemini-2.5-flash-lite',
      temperature: 0.2,
      maxOutputTokens: 2500,
      responseMimeType: 'application/json'
    });

    let detailed: any = { materials: [], condition: '', defects: [], risks: [], verify: [] };
    if (result.success && result.text) { try { detailed = JSON.parse(result.text.trim()); } catch {} }

    // Persist under analysis_data (augmented) or create new field if needed
    const { data: current } = await supabase
      .from('room_analyses')
      .select('analysis_data')
      .eq('listing_id', listingId)
      .eq('room_id', roomId)
      .single();

    const mergedAnalysis = { ...(current?.analysis_data || {}), detailed_state: detailed };

    const { error: upsertErr } = await supabase
      .from('room_analyses')
      .upsert({ listing_id: Number(listingId), room_id: roomId, analysis_data: mergedAnalysis }, { onConflict: 'listing_id,room_id' });
    if (upsertErr) return NextResponse.json({ success: false, error: 'persist_failed', details: upsertErr.message }, { status: 500 });

    return NextResponse.json({ success: true, data: detailed });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'unknown_error' }, { status: 500 });
  }
}


