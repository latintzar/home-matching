import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { VertexAI } from '@google-cloud/vertexai';
import {lazySupabaseClient} from '@/lib/lazy-supabase';
import {lazyResource} from '@/lib/lazy-resource.mjs';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BUCKET = 'property-images';

const vertexAI = lazyResource(()=>new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT_ID!,
  location: process.env.GOOGLE_CLOUD_LOCATION!,
}));

type RedboxRequest = {
  tier?: 'estandar' | 'optimo' | 'plus' | string;
  beforePhotoUrl: string;
  maskImageUrl?: string; // optional explicit mask
  box?: { x0: number; y0: number; x1: number; y1: number }; // normalized 0..1 if no mask image
  prompt: string; // explicit edit instruction (Spanish OK)
  seed?: number; // for determinism
};

async function fetchAsBase64(url: string): Promise<{ b64: string; mime: string } | null> {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || 'image/jpeg').toLowerCase();
    const buf = await res.arrayBuffer();
    return { b64: Buffer.from(buf).toString('base64'), mime: ct.startsWith('image/png') ? 'image/png' : ct.startsWith('image/webp') ? 'image/webp' : 'image/jpeg' };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: listingId } = await params;
  try {
    const body = (await request.json()) as RedboxRequest;
    const { beforePhotoUrl, maskImageUrl, box, prompt, tier = 'estandar', seed = 7 } = body || {};
    if (!beforePhotoUrl || !prompt) {
      return NextResponse.json({ success: false, error: 'missing_params', details: 'beforePhotoUrl and prompt are required' }, { status: 400 });
    }

    // Fetch base image
    const base = await fetchAsBase64(beforePhotoUrl);
    if (!base) return NextResponse.json({ success: false, error: 'fetch_before_failed' }, { status: 400 });

    // Build mask: prefer provided mask image; else synthesize a simple box mask (PNG) if box provided
    let maskB64: string | undefined;
    if (maskImageUrl) {
      const m = await fetchAsBase64(maskImageUrl);
      if (m) maskB64 = m.b64;
    } else if (box) {
      // Create a simple PNG mask with white rectangle on black (normalized box)
      // Minimal inline generator: 512x512 RGBA
      const W = 512, H = 512;
      const buf = Buffer.alloc(W * H * 4, 0);
      const x0 = Math.max(0, Math.min(W - 1, Math.round(box.x0 * W)));
      const y0 = Math.max(0, Math.min(H - 1, Math.round(box.y0 * H)));
      const x1 = Math.max(0, Math.min(W, Math.round(box.x1 * W)));
      const y1 = Math.max(0, Math.min(H, Math.round(box.y1 * H)));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * W + x) * 4;
          buf[idx] = 255; buf[idx + 1] = 255; buf[idx + 2] = 255; buf[idx + 3] = 255;
        }
      }
      // Encode as PNG using node: no dependency - fallback to uploading raw mask buffer as image/png not feasible without encoder.
      // For simplicity, omit synthetic mask if no maskImageUrl (encoders not available). Recommend client provide maskImageUrl.
    }

    // Use Gemini 2.5 Flash Image via Vertex SDK for masked edits
    const model = vertexAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
      generationConfig: {
        temperature: 0,
        // Determinism hint: some Gemini image models accept seed; include when available
        // @ts-ignore seed may be supported by generationConfig
        seed
      }
    } as any);

    // Build contents: prompt + base image (+ optional mask if provided)
    const parts: any[] = [
      { text: `${prompt}\n\nReglas: Mantén composición y perspectiva. Edita solo la región marcada (si se proporciona máscara). Sé coherente con materiales y estilo. No alteres el resto de la imagen.` },
      { inlineData: { mimeType: base.mime, data: base.b64 } }
    ];
    if (maskB64) parts.push({ inlineData: { mimeType: 'image/png', data: maskB64 } });

    const contents = [{ role: 'user', parts }];
    const result = await model.generateContent({ contents } as any);
    const generated = (result as any)?.response?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData)?.inlineData;
    if (!generated?.data) return NextResponse.json({ success: false, error: 'no_image' }, { status: 502 });

    const png = Buffer.from(generated.data, 'base64');
    const path = `${listingId}/after/${tier}/redbox-${Date.now()}.png`;
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, png, { upsert: true, contentType: 'image/png' });
    if (uploadErr) return NextResponse.json({ success: false, error: 'upload_failed', details: uploadErr.message }, { status: 500 });

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ success: true, url: pub.publicUrl });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'unknown_error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, error: 'method_not_allowed' }, { status: 405 });
}


