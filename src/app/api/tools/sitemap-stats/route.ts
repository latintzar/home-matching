import { NextResponse } from 'next/server';
import { parseStringPromise } from 'xml2js';

/**
 * Simple utility to fetch stats from a sitemap URL
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 });
  }

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const xml = await res.text();
    const data = await parseStringPromise(xml);

    const buckets: Record<string, number> = {};
    // Init last 7 days
    const today = new Date();
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        buckets[d.toISOString().split('T')[0]] = 0;
    }

    let items: any[] = [];
    if (data.sitemapindex?.sitemap) items = data.sitemapindex.sitemap;
    else if (data.urlset?.url) items = data.urlset.url;

    let totalFound = 0;
    items.forEach((u: any) => {
        const lastmod = u.lastmod ? u.lastmod[0].split('T')[0] : '';
        if (buckets[lastmod] !== undefined) {
            buckets[lastmod]++;
            totalFound++;
        }
    });

    return NextResponse.json({ 
        success: true, 
        url,
        total_recent: totalFound,
        stats: buckets 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

