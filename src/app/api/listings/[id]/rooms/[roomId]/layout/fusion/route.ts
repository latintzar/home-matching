import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';

export const dynamic = 'force-dynamic';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string, roomId: string }> }) {
  try {
    const { id: listingId, roomId } = await params;

    const { data: row } = await supabase
      .from('room_analyses')
      .select('camera_angles_json')
      .eq('listing_id', listingId)
      .single();

    const perRoom = (row?.camera_angles_json || {}) as any;
    const f1 = perRoom[roomId];
    if (!f1 || !Array.isArray(f1?.photos) || f1.photos.length === 0) {
      return NextResponse.json({ success: false, error: 'no_f1_data', details: 'Run F1 placements first for this room.' }, { status: 400 });
    }

    const system = [
      'You are a spatial modeler. Merge multiple angle-agnostic photo descriptions of the SAME room into one canonical, camera-independent layout.',
      'Be literal and prioritize clarity. Resolve contradictions explicitly. Do not use photo-frame terms in the canonical narrative.'
    ].join('\n');

    const schemaExample = {
      elements: [ { id: 'W1', type: 'window', aliases: ['p1.W1','p3.W1'], extent: 'right_third_long_wall' } ],
      relations: [ { subject: 'W1', predicate: 'on_same_wall_as', object: 'D1' } ],
      room_axes: { primary_axis: 'long_wall_with_openings', secondary_axis: 'perpendicular', openings_wall: 'east', circulation_bands: ['left_aisle','front_half'] },
      consensus: { supportByPhoto: { p1: ['W1 on long wall'], p2: ['W1 opposite T1'] }, conflicts: [], confidence: 'high' },
      uncertainties: [ 'Is archway a pass-through or niche? Verify depth.' ],
      camera_alignment: [ { photo_id: 'p1', relation_to_canonical: '~0° around centerline' }, { photo_id: 'p2', relation_to_canonical: '~90° clockwise' } ]
    };

    const prompt = [
      'INPUT_F1_PHOTOS_JSON:',
      JSON.stringify(f1.photos).slice(0, 120000),
      '',
      'REQUIRED_OUTPUT_SCHEMA (JSON only):',
      JSON.stringify(schemaExample),
      '',
      'Rules:',
      '- Unify element identities across photos via aliases. Keep stable IDs (type + index by support/extent).',
      '- Deduplicate and consolidate relations into angle-agnostic constraints.',
      '- Prefer constraints supported by ≥2 photos; move contradictions into uncertainties.',
      '- Do not reference photo frames in canonical text; use room-centric language (walls, thirds, axes, alignments).',
      '- Keep output concise but unambiguous.'
    ].join('\n');

    const responseSchema = {
      type: 'object',
      properties: {
        elements: {
          type: 'array',
          minItems: 3,
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string' },
              aliases: { type: 'array', items: { type: 'string' } },
              role: { type: 'string', nullable: true },
              on_wall: { type: 'string', nullable: true },
              in_zone: { type: 'string', nullable: true },
              visual_description: { type: 'string', minLength: 40 },
              materials: { type: 'array', items: { type: 'string' } },
              color: { type: 'array', items: { type: 'string' } },
              condition: { type: 'string' },
              style_cues: { type: 'array', items: { type: 'string' } }
            },
            required: ['id','type','visual_description','condition']
          }
        },
        relations: {
          type: 'array',
          minItems: 3,
          items: { type: 'object', properties: {
            subject: { type: 'string' }, predicate: { type: 'string' }, object: { type: 'string' }
          }, required: ['subject','predicate','object'] }
        },
        walls: {
          type: 'array',
          minItems: 1,
          items: { type: 'object', properties: {
            label: { type: 'string' },
            length_descriptor: { type: 'string', nullable: true },
            features_in_order: { type: 'array', items: { type: 'string' } },
            fractions: { type: 'object', nullable: true }
          }, required: ['label','features_in_order'] }
        },
        zones: {
          type: 'array',
          minItems: 1,
          items: { type: 'object', properties: {
            id: { type: 'string' }, label: { type: 'string' }, description: { type: 'string' },
            bounds_hint: { type: 'string', nullable: true }
          }, required: ['id','label','description'] }
        },
        room_narrative: { type: 'string', minLength: 200 },
        camera_alignment: { type: 'array', items: { type: 'object', properties: {
          photo_id: { type: 'string' }, relation_to_canonical: { type: 'string' }
        }, required: ['photo_id','relation_to_canonical'] } },
        uncertainties: { type: 'array', items: { type: 'string' } }
      },
      required: ['elements','relations','walls','zones','room_narrative'],
      propertyOrdering: [
        'room_narrative','walls','zones','elements',
        'relations','camera_alignment','uncertainties'
      ]
    } as const;

    const result = await callGeminiRest(`${system}\n\n${prompt}\n\nAdditional rules:\n- Produce a highly descriptive, angle-agnostic room_narrative (6–12 sentences) suitable for a blind drafter.\n- Label walls (north/east/south/west or long/short/entry) and list features in order along each wall.\n- Define functional zones (prep, seating, dining, circulation, wet area) with descriptions and bounds hints (thirds/halves).\n- For each element include visual_description, materials, color, condition, style_cues; be literal and avoid brand guesses.\n- Unify element IDs via aliases; prefer constraints supported by ≥2 photos; move contradictions to uncertainties.\n- No photo-frame references; use room-centric language (walls, thirds, axes).`, {
      model: 'gemini-2.5-flash-lite',
      temperature: 0.1,
      maxOutputTokens: 9000,
      responseMimeType: 'application/json',
      responseSchema
    });

    let canonical: any = { elements: [], relations: [], room_axes: {}, consensus: {}, uncertainties: [], camera_alignment: [] };
    if (result.success && result.text) { try { canonical = JSON.parse(result.text.trim()); } catch {} }

    // Store by room key inside canonical_layout_json map
    const { data: existing } = await supabase
      .from('room_analyses')
      .select('canonical_layout_json, analysis_data')
      .eq('listing_id', listingId)
      .single();
    const canonMap = existing?.canonical_layout_json || {};
    canonMap[roomId] = canonical;
    const { error: upsertErr } = await supabase
      .from('room_analyses')
      .upsert({ listing_id: Number(listingId), canonical_layout_json: canonMap, analysis_data: existing?.analysis_data || {} }, { onConflict: 'listing_id' });
    if (upsertErr) return NextResponse.json({ success: false, error: 'persist_failed', details: upsertErr.message }, { status: 500 });

    return NextResponse.json({ success: true, data: canonical });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'unknown_error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, error: 'method_not_allowed' }, { status: 405 });
}


