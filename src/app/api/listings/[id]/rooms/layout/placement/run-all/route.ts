import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

type ManualCluster = {
  id: number;
  cluster_name: string;
  room_type?: string | null;
  photo_urls: string[];
  display_order?: number | null;
};

type PhotosInput = Array<{ photo_id: string; base64_image: string }>; 

const fetchAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return Buffer.from(buf).toString('base64');
  } catch {
    return null;
  }
};

const toPhotosPayload = async (cluster: ManualCluster): Promise<PhotosInput> => {
  const urls = Array.isArray(cluster.photo_urls) ? cluster.photo_urls : [];
  const photos: PhotosInput = [];
  let idx = 0;
  for (const url of urls) {
    const b64 = await fetchAsBase64(url);
    if (b64) {
      photos.push({ photo_id: `${cluster.id}-${idx}`, base64_image: b64 });
      idx += 1;
    }
  }
  return photos;
};

const runF1Placement = async (listingId: string, roomId: string, photos: PhotosInput) => {
  const system = 'You are an image describer. Be literal and precise.';
  const prompt = [
    'Return JSON only with shape:',
    '{ "photos": [ { "photo_id": "p1", "elements": [ { "key": "window", "type": "window", "bbox": {"x0":0.1,"y0":0.1,"x1":0.5,"y1":0.4}, "confidence": 0.9 } ], "camera": {"tilt":0,"pan":0,"height":1.6} } ] }',
    'Rules:',
    '- One entry per input image in the SAME order; use the provided photo_id.',
    '- bbox values MUST be normalized 0..1.',
    '- You MUST include at least 1 element per photo; choose the most salient if uncertain.',
    `photo_ids: ${photos.map((p) => p.photo_id).join(', ')}`
  ].join('\n');

  const images = photos.map((p) => ({ mimeType: 'image/jpeg' as const, data: p.base64_image }));

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

  // Validate non-empty elements per provided photo
  const providedCount = photos.length;
  const allNonEmpty = Array.isArray(placement?.photos)
    && placement.photos.length === providedCount
    && placement.photos.every((ph: any) => Array.isArray(ph?.elements) && ph.elements.length > 0);
  if (providedCount > 0 && !allNonEmpty) {
    return { ok: false as const, error: 'no_placements', data: placement };
  }

  // Persist under camera_angles_json[roomId]
  const { data: existing } = await supabase
    .from('room_analyses')
    .select('camera_angles_json, analysis_data')
    .eq('listing_id', listingId)
    .single();

  const map = (existing?.camera_angles_json || {}) as Record<string, unknown>;
  map[roomId] = placement;

  const { error: upsertErr } = await supabase
    .from('room_analyses')
    .upsert(
      { listing_id: Number(listingId), camera_angles_json: map, analysis_data: existing?.analysis_data || {} },
      { onConflict: 'listing_id' }
    );
  if (upsertErr) {
    return { ok: false as const, error: `persist_failed: ${upsertErr.message}` };
  }

  return { ok: true as const, data: placement };
};

const pLimit = <T,>(max: number, tasks: Array<() => Promise<T>>): Promise<T[]> => {
  if (max <= 1) return Promise.all(tasks.map((t) => t()));
  const results: T[] = [];
  let index = 0;
  let active = 0;
  return new Promise((resolve, reject) => {
    const next = () => {
      if (index >= tasks.length && active === 0) return resolve(results);
      while (active < max && index < tasks.length) {
        const current = tasks[index];
        index += 1;
        active += 1;
        current()
          .then((res) => { results.push(res); })
          .catch(reject)
          .finally(() => { active -= 1; next(); });
      }
    };
    next();
  });
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: listingId } = await params;
    const body = await req.json().catch(() => ({}));
    const { concurrency = 4 } = body || {};

    // Read manual clusters for the listing
    const { data: clusters, error: clustersErr } = await supabase
      .from('clusters')
      .select('id, cluster_name, room_type, photo_urls, display_order')
      .eq('listing_id', listingId)
      .order('display_order', { ascending: true });
    if (clustersErr) {
      return NextResponse.json({ success: false, error: clustersErr.message }, { status: 500 });
    }

    // Filter out excluded clusters using helper function
    const { isClusterExcluded } = await import('@/lib/photo-storage');
    const allClusters = (clusters || []) as ManualCluster[];
    const validClusters: ManualCluster[] = [];
    for (const c of allClusters) {
      if (!Array.isArray(c.photo_urls) || c.photo_urls.length === 0) continue;
      const isExcluded = await isClusterExcluded(c.cluster_name, listingId);
      if (!isExcluded) {
        validClusters.push(c);
      }
    }

    if (validClusters.length === 0) {
      return NextResponse.json({ success: false, error: 'no_valid_clusters' }, { status: 400 });
    }

    // Build tasks: per cluster → photos payload → run F1 → persist
    const tasks = validClusters.map((cluster) => async () => {
      const photos = await toPhotosPayload(cluster);
      if (photos.length === 0) {
        return { roomId: String(cluster.id), roomName: cluster.cluster_name, ok: false, error: 'no_images' };
      }
      const res = await runF1Placement(String(listingId), String(cluster.id), photos);
      return {
        roomId: String(cluster.id),
        roomName: cluster.cluster_name,
        ok: res.ok,
        error: (res as any).error,
      };
    });

    const results = await pLimit(Math.max(1, Math.min(12, Number(concurrency) || 4)), tasks);

    const summary = {
      total: results.length,
      success: results.filter((r) => (r as any).ok).length,
      failed: results.filter((r) => !(r as any).ok).length,
      rooms: results,
    };

    return NextResponse.json({ success: true, data: summary });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'unknown_error' }, { status: 500 });
  }
}


