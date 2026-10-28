import { NextRequest, NextResponse } from 'next/server';

type Tier = 'estandar' | 'optimo' | 'plus';
const ENDPOINTS = ['renovation-pricing', 'renovation-timeline', 'renovation-permits'] as const;

const withTimeout = async (p: Promise<Response>, ms = 600000) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await p;
    return r;
  } finally {
    clearTimeout(t);
  }
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: listingId } = await params; // Await params as per Next.js 15+ warning
  const origin = new URL(request.url).origin;
  let payload: { tiers?: Tier[] } = {};
  try {
    payload = await request.json();
  } catch (_) {
    // no-op, default to all tiers
  }

  const selected: Tier[] = payload.tiers && payload.tiers.length ? payload.tiers : ['estandar', 'optimo', 'plus'];

  // Build tasks: one per endpoint per tier
  const tasks = selected.flatMap((tier) =>
    ENDPOINTS.map((ep) => ({
      ep,
      tier,
      url: `${origin}/api/listings/${listingId}/${ep}`,
      body: JSON.stringify({ tier }),
    }))
  );

  // Concurrency limiter
  const MAX_CONCURRENCY = Math.min(4, tasks.length);
  let cursor = 0;
  const results: Array<{ ep: string; tier: Tier; ok: boolean; status?: number; error?: string }> = [];

  async function runOne(task: { ep: string; tier: Tier; url: string; body: string }) {
    try {
      const res = await withTimeout(
        fetch(task.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: task.body }),
        600000
      );
      const ok = res.ok;
      results.push({ ep: task.ep, tier: task.tier, ok, status: res.status, error: ok ? undefined : await res.text() });
    } catch (e: any) {
      results.push({ ep: task.ep, tier: task.tier, ok: false, error: e?.message || 'request_failed' });
    }
  }

  const workers: Promise<void>[] = Array.from({ length: MAX_CONCURRENCY }, async () => {
    while (cursor < tasks.length) {
      const idx = cursor++;
      // eslint-disable-next-line no-await-in-loop
      await runOne(tasks[idx]);
    }
  });

  await Promise.all(workers);

  const byTier: Record<Tier, { ok: number; failed: number }> = {
    estandar: { ok: 0, failed: 0 },
    optimo: { ok: 0, failed: 0 },
    plus: { ok: 0, failed: 0 },
  };
  for (const t of selected) {
    const bucket = results.filter((r) => r.tier === t);
    byTier[t] = { ok: bucket.filter((b) => b.ok).length, failed: bucket.filter((b) => !b.ok).length };
  }

  return NextResponse.json({
    success: true,
    message: 'Postprocess dispatched',
    summary: {
      listing_id: listingId,
      tiers: selected,
      counts: {
        total: results.length,
        ok: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
      },
      by_tier: byTier,
      details: results,
    },
  });
}


