import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

type ClusterRow = {
  id: number;
  cluster_name: string;
  photo_urls: string[];
  display_order?: number;
};

type PlacementPhoto = { photo_id: string; elements: any[]; camera?: Record<string, any> };
type PlacementResult = { photos: PlacementPhoto[] };
type Base64Image = { b64: string; mime: 'image/jpeg' | 'image/png' | 'image/webp' };

async function fetchAsBase64(url: string, attempts = 2): Promise<Base64Image | null> {
  let lastErr: any;
  for (let i = 0; i <= attempts; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'PuedoCasa-F1/1.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const mime: Base64Image['mime'] = ct.startsWith('image/webp') ? 'image/webp' : ct.startsWith('image/png') ? 'image/png' : 'image/jpeg';
      const buf = await res.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      if (!b64 || b64.length < 64) throw new Error('empty_image');
      return { b64, mime };
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 400 * (i + 1)));
    }
  }
  console.warn('fetchAsBase64 failed:', lastErr);
  return null;
}

async function runF1ForRoom(listingId: string, roomId: string, photoUrls: string[]): Promise<PlacementResult> {
  const system = 'You are a spatial describer. Be literal, exhaustive, and angle‑agnostic.';
  const placement: PlacementResult = { photos: [] };

  // One photo per call; run for all provided photos
  const imagesBase64 = await Promise.all(photoUrls.map((u) => fetchAsBase64(u)));
  for (let i = 0; i < photoUrls.length; i++) {
    const img = imagesBase64[i];
    const photoId = `p${i + 1}`;
    if (!img) continue;

    const prompt = [
      'Return JSON only with shape:',
      '{',
      '  "photo_id": "p1",',
      '  "camera": { "tilt": 0, "pan": 0, "height": 1.6 },',
      '  "elements": [',
      '    {',
      '      "id": "W1", "type": "window",',
      '      "visual_description": "Describe appearance (frame type, divisions, transparency, scale relative to wall).",',
      '      "materials": ["aluminum"],',
      '      "color": ["white"],',
      '      "condition": "good",',
      '      "style_cues": ["contemporary"]',
      '    }',
      '  ],',
      '  "relations": [',
      '    { "subject": "W1", "predicate": "on_same_wall_as", "object": "D1" }',
      '  ],',
      '  "spatial_summary": "Describe the room like to a blind drafter: which walls host what, fractions (thirds/halves), alignments, aisles.",',
      '  "angle_agnostic_description": [',
      '    "Bullet constraints understandable from any angle (fractions, sidedness, alignments, containment)."',
      '  ],',
      '  "considerations": ["Only if ambiguity/occlusion materially affects interpretation."],',
      '  "bboxes": null',
      '}',
      'Rules:',
      `- Use the given photo_id: ${photoId}.`,
      '- For each element include: visual_description (1–2 sentences), materials, color, condition, style_cues.',
      '- Focus on clarity over brevity; avoid camera-frame words in summaries (use walls/thirds/axes).',
      '- Use relations like: on_same_wall_as, adjacent_to, opposite_of, contains, aligned_to_centerline_of, occupies_fraction_of_wall (left_third|center_third|right_third), in_front_of (circulation), behind, overlaps, encloses.',
      '- elements: keep stable ids (type+index).',
      '- bboxes: optional null.',
      '- considerations: only concrete verification/occlusion notes; keep sparse.'
    ].join('\n');

    const responseSchema = {
      type: 'object',
      properties: {
        photo_id: { type: 'string' },
        camera: { type: 'object' },
        elements: { type: 'array', minItems: 1, items: { type: 'object', properties: {
          id: { type: 'string' }, type: { type: 'string' },
          visual_description: { type: 'string', minLength: 30 },
          materials: { type: 'array', items: { type: 'string' } },
          color: { type: 'array', items: { type: 'string' } },
          condition: { type: 'string' },
          style_cues: { type: 'array', items: { type: 'string' } }
        }, required: ['id','type','visual_description','condition'] } },
        relations: { type: 'array', items: { type: 'object', properties: {
          subject: { type: 'string' }, predicate: { type: 'string' }, object: { type: 'string' }
        }, required: ['subject','predicate','object'] } },
        spatial_summary: { type: 'string', minLength: 60 },
        angle_agnostic_description: { type: 'array', items: { type: 'string' } },
        considerations: { type: 'array', items: { type: 'string' } },
        bboxes: { anyOf: [ { type: 'null' }, { type: 'object' } ] }
      },
      required: ['photo_id','elements'],
      propertyOrdering: [
        'photo_id','camera','elements','relations',
        'spatial_summary','angle_agnostic_description',
        'considerations','bboxes'
      ]
    } as const;

    const single = await callGeminiRest(`${system}\n\n${prompt}`, {
      model: 'gemini-2.5-flash-lite',
      temperature: 0.2,
      maxOutputTokens: 8000,
      responseMimeType: 'application/json',
      responseSchema,
      images: [{ mimeType: img.mime, data: img.b64 }]
    });
    if (single.success && single.text) {
      try {
        const parsed = JSON.parse(single.text.trim());
        if (parsed && parsed.photo_id) placement.photos.push(parsed);
      } catch {}
    }
  }

  // Persist: merge into camera_angles_json map
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
  if (upsertErr) throw new Error(`persist_failed: ${upsertErr.message}`);

  return placement;
}

function limitConcurrency<T, R>(items: T[], limit: number, handler: (item: T, index: number) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return Promise.resolve([]);
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) return;
      try {
        results[current] = await handler(items[current], current);
      } catch (e) {
        // @ts-ignore
        results[current] = e;
      }
    }
  });

  return Promise.all(workers).then(() => results);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: listingId } = await params;

  try {
    const { data: clustersRaw, error: clustersError } = await supabase
      .from('clusters')
      .select('id, cluster_name, photo_urls, display_order')
      .eq('listing_id', listingId)
      .order('display_order');

    if (clustersError) {
      return NextResponse.json({ success: false, error: `fetch_clusters_failed: ${clustersError.message}` }, { status: 500 });
    }

    // Filter out excluded clusters using helper function
    const { isClusterExcluded } = await import('@/lib/photo-storage');
    const clusters: ClusterRow[] = [];
    for (const c of (clustersRaw || [])) {
      if (!Array.isArray(c.photo_urls) || c.photo_urls.length === 0) continue;
      const isExcluded = await isClusterExcluded(c.cluster_name, listingId);
      if (!isExcluded) {
        clusters.push(c);
      }
    }

    if (clusters.length === 0) {
      return NextResponse.json({ success: false, error: 'no_valid_clusters' }, { status: 400 });
    }

    const concurrency = Number(process.env.F1_CONCURRENCY || 4);
    const stats: { room_id: string; room_name: string; photos: number; status: 'ok' | 'error'; error?: string }[] = [];

    const results = await limitConcurrency(clusters, concurrency, async (cluster) => {
      const roomId = String(cluster.id);
      try {
        const placement = await runF1ForRoom(listingId, roomId, cluster.photo_urls || []);
        stats.push({ room_id: roomId, room_name: cluster.cluster_name, photos: placement.photos.length, status: 'ok' });
        return placement;
      } catch (e: any) {
        stats.push({ room_id: roomId, room_name: cluster.cluster_name, photos: (cluster.photo_urls || []).length, status: 'error', error: e?.message || 'unknown_error' });
        return null;
      }
    });

    const successCount = results.filter((r) => r && Array.isArray(r.photos) && r.photos.length > 0).length;

    return NextResponse.json({ success: true, processed_rooms: successCount, total_rooms: clusters.length, stats });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'unknown_error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, error: 'method_not_allowed' }, { status: 405 });
}


