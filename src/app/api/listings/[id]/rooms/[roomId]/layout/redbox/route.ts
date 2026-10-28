import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

type RedboxBody = { element_id?: string; seed?: number };

function extractPhotoIndexesFromAliases(aliases: string[]): number[] {
  // alias format like "p3.R1" → extract 3
  const idxs = new Set<number>();
  for (const a of aliases || []) {
    const m = /^p(\d+)\./.exec(a);
    if (m) idxs.add(parseInt(m[1], 10));
  }
  return Array.from(idxs).sort((a, b) => a - b);
}

function buildRedboxPrompt(element: any, canonical: any): string {
  const parts: string[] = [];
  parts.push('Dibuja un rectángulo rojo fino (4px, sin relleno) alrededor del objeto descrito.');
  parts.push('No cambies nada más de la imagen. Mantén composición y perspectiva idénticas.');
  parts.push('Si el objeto no es visible en esta imagen, devuelve la imagen sin cambios.');
  const type = element?.type || 'objeto';
  const vid = element?.visual_description ? ` Apariencia: ${element.visual_description}.` : '';
  const onWall = element?.on_wall ? ` Ubicación: en pared ${element.on_wall}.` : '';
  const inZone = element?.in_zone ? ` Zona: ${element.in_zone}.` : '';
  // Pick up to 2 relations for disambiguation
  const rels = Array.isArray(canonical?.relations) ? canonical.relations : [];
  const relText: string[] = [];
  for (const r of rels) {
    if (!r?.subject || !r?.predicate || !r?.object) continue;
    if (r.subject === element.id || r.object === element.id) {
      relText.push(`${r.subject} ${r.predicate} ${r.object}`);
      if (relText.length >= 2) break;
    }
  }
  const relsStr = relText.length ? ` Relaciones: ${relText.join('; ')}.` : '';
  parts.push(`Objeto: ${element.id} (${type}).${vid}${onWall}${inZone}${relsStr}`);
  return parts.join('\n');
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string, roomId: string }> }) {
  const { id: listingId, roomId } = await params;
  try {
    const body = await req.json().catch(() => ({} as RedboxBody));
    const fixedSeed = typeof body?.seed === 'number' ? body.seed : 42;

    // Load canonical + F1 map
    const { data: row, error } = await supabase
      .from('room_analyses')
      .select('canonical_layout_json, camera_angles_json')
      .eq('listing_id', listingId)
      .single();
    if (error) return NextResponse.json({ success: false, error: 'load_failed', details: error.message }, { status: 500 });

    const canonicalMap = (row?.canonical_layout_json || {}) as any;
    const camMap = (row?.camera_angles_json || {}) as any;
    const canonical = canonicalMap[roomId];
    const f1 = camMap[roomId];
    if (!Array.isArray(f1?.photos)) {
      return NextResponse.json({ success: false, error: 'missing_data', details: 'Run F1 first for this room.' }, { status: 400 });
    }

    // Choose element (prefer small elements)
    const preferSmallTypes = new Set(['handle','knob','switch','outlet','tap','faucet','bidet','lamp','nightstand','sconce','plant','painting','frame','mirror','vent','grille','hinge','socket']);
    const pickSmall = (els: any[]) => {
      const byType = els.find((e) => preferSmallTypes.has(String(e?.type || '').toLowerCase()));
      if (byType) return byType;
      const withLen = els.map((e) => ({ e, l: (e?.visual_description || '').length })).sort((a,b)=>a.l-b.l);
      return (withLen[0]?.e) || els[0];
    };
    let chosen: any | null = null;
    if (Array.isArray(canonical?.elements) && canonical.elements.length > 0) {
      chosen = body?.element_id ? canonical.elements.find((e: any) => e?.id === body.element_id) : pickSmall(canonical.elements);
    }
    // Fallback: derive a representative element from F1 if canonical lacks elements
    if (!chosen) {
      const f1Els = (f1.photos || []).flatMap((p: any) => Array.isArray(p?.elements) ? p.elements : []);
      if (f1Els.length > 0) {
        chosen = pickSmall(f1Els);
        // Normalize minimal fields expected by prompt builder
        chosen.id = chosen.id || 'fallback';
        chosen.type = chosen.type || 'object';
        chosen.visual_description = chosen.visual_description || chosen.description || '';
      } else {
        return NextResponse.json({ success: false, error: 'no_element' }, { status: 400 });
      }
    }
    // Load cluster photo URLs for this room to map pN → url
    const { data: clusters } = await supabase
      .from('clusters')
      .select('id, photo_urls')
      .eq('listing_id', listingId)
      .eq('id', parseInt(roomId, 10));
    const urls: string[] = Array.isArray(clusters) && clusters[0]?.photo_urls ? clusters[0].photo_urls : [];

    const prompt = buildRedboxPrompt(chosen, canonical);
    const inferredBase = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get('host') || 'localhost:3000'}`;
    const results: any[] = [];
    // Process ALL photos; prompt instructs to keep unchanged if object not visible
    for (let idx = 1; idx <= urls.length; idx++) {
      const beforeUrl = urls[idx - 1];
      if (!beforeUrl) { results.push({ photo_id: `p${idx}`, ok: false, error: 'no_before_url' }); continue; }
      // Call internal redbox generator (Flash Image) with base image & prompt, no mask
      const res = await fetch(`${inferredBase}/api/listings/${listingId}/image-gen/redbox`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beforePhotoUrl: beforeUrl, prompt, tier: 'redbox', seed: fixedSeed })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) { results.push({ photo_id: `p${idx}`, ok: false, error: json?.error || `HTTP ${res.status}` }); continue; }
      results.push({ photo_id: `p${idx}`, ok: true, url: json.url });
    }

    // Persist element_boxes_json
    const { data: existing } = await supabase
      .from('room_analyses')
      .select('element_boxes_json, canonical_layout_json, camera_angles_json, analysis_data')
      .eq('listing_id', listingId)
      .single();
    const boxes = existing?.element_boxes_json || {};
    boxes[roomId] = boxes[roomId] || {};
    boxes[roomId][chosen.id] = boxes[roomId][chosen.id] || {};
    for (const r of results) if (r.ok && r.url) boxes[roomId][chosen.id][r.photo_id] = { url: r.url, method: 'prompt-redbox' };

    const { error: upErr } = await supabase
      .from('room_analyses')
      .upsert({ listing_id: Number(listingId), element_boxes_json: boxes, canonical_layout_json: existing?.canonical_layout_json || {}, camera_angles_json: existing?.camera_angles_json || {}, analysis_data: existing?.analysis_data || {} }, { onConflict: 'listing_id' });
    if (upErr) return NextResponse.json({ success: false, error: 'persist_failed', details: upErr.message }, { status: 500 });

    return NextResponse.json({ success: true, element_id: chosen.id, results });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'unknown_error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, error: 'method_not_allowed' }, { status: 405 });
}


