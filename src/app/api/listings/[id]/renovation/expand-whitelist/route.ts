import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { STATIC_WHITELISTS, extractDomainFromUrl, ResearchCategory } from '@/lib/domain-whitelists';
import fs from 'fs';
import path from 'path';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CATEGORIES: ResearchCategory[] = ['costs','timings','permits','laws_regulations','norms_standards','market_practices','incentives'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: listingId } = await params;

  try {
    // Gather all search results for this listing
    const { data: results, error } = await supabase
      .from('renovation_search_results')
      .select('url, metadata')
      .eq('listing_id', listingId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Build unique domain sets per category
    const domainsByCategory: Record<ResearchCategory, Set<string>> = {
      costs: new Set(), timings: new Set(), permits: new Set(), laws_regulations: new Set(), norms_standards: new Set(), market_practices: new Set(), incentives: new Set()
    };

    for (const row of results || []) {
      const category = (row.metadata?.category || '') as ResearchCategory;
      if (!CATEGORIES.includes(category)) continue;
      const domain = extractDomainFromUrl(row.url || '');
      if (!domain) continue;
      domainsByCategory[category].add(domain);
    }

    // For each category, compute unknown domains (not in static list)
    const reviewItems: Array<{ category: ResearchCategory; domain: string }> = [];
    for (const category of CATEGORIES) {
      const staticSet = STATIC_WHITELISTS[category];
      for (const d of Array.from(domainsByCategory[category])) {
        if (!staticSet.has(d)) reviewItems.push({ category, domain: d });
      }
    }

    // Per-domain classification using Flash (strict binary schema), with retries
    const additions: Array<{ domain: string; category: ResearchCategory; type?: string; rationale?: string }> = [];
    const classifySchema = {
      type: 'object',
      properties: {
        decision: { type: 'string', enum: ['YES','NO'] },
        type: { type: 'string' },
        rationale: { type: 'string' }
      },
      required: ['decision']
    } as const;

    await Promise.allSettled(reviewItems.map(async ({ category, domain }) => {
      const prompt = `Decide if this domain should be whitelisted for category ${category} (Spanish/EU renovation research). Respond JSON only.
Rules for YES: government/EU/official standards/professional bodies/recognized law portals/leading market media/reputable renovation platforms/major retailers with technical data.
Rules for NO: forums, personal blogs without authority, unrelated ecommerce, irrelevant content.
Return: { "decision": "YES|NO", "type": "...", "rationale": "<=140 chars" }

DOMAIN: ${domain}`;

      let ok = false; let lastText = '';
      for (let i = 0; i < 3; i++) {
        const r = await callGeminiRest(prompt, {
          model: 'gemini-2.5-flash',
          temperature: 0.0,
          maxOutputTokens: 256,
          responseMimeType: 'application/json',
          responseSchema: classifySchema
        });
        if (r.success && r.text) {
          lastText = r.text;
          try {
            const cleaned = r.text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
            const parsed = JSON.parse(cleaned);
            if (parsed.decision === 'YES') {
              additions.push({ domain, category, type: parsed.type, rationale: parsed.rationale });
            }
            ok = true; break;
          } catch {}
        }
      }
      if (!ok) {
        // Treat as NO; optionally log lastText
      }
    }));

    const lines: string[] = [];
    lines.push(`# Whitelist Expansion Proposal for Listing ${listingId}`);
    lines.push('');
    lines.push(`Reviewed domains: ${reviewItems.length}`);
    lines.push(`Proposed additions: ${additions.length}`);
    lines.push('');
    for (const category of CATEGORIES) {
      lines.push(`## ${category}`);
      const catAdds = additions.filter(a => a.category === category);
      if (catAdds.length === 0) {
        lines.push('- (none)');
        lines.push('');
        continue;
      }
      for (const a of catAdds) {
        lines.push(`- ${a.domain} — ${a.type || 'other'} — ${a.rationale || ''}`);
      }
      lines.push('');
    }

    const outDir = path.join(process.cwd(), 'docs');
    const outPath = path.join(outDir, `WHITELIST_EXPANSION_${listingId}.md`);
    fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');

    // Update hardcoded whitelist file with additions
    const wlPath = path.join(process.cwd(), 'src/lib/domain-whitelists.ts');
    const original = fs.readFileSync(wlPath, 'utf-8');
    let updated = original;
    for (const category of CATEGORIES) {
      const toAdd = additions.filter(a => a.category === category).map(a => a.domain);
      if (toAdd.length === 0) continue;
      // Find the Set initializer for this category
      const pattern = new RegExp(`${category}: new Set\\(\\[([\\s\\S]*?)\\]\\)`, 'm');
      const match = updated.match(pattern);
      if (!match) continue;
      const existingBlock = match[1];
      const existingDomains = new Set(
        existingBlock.split('\n')
          .map(l => (l.match(/'([^']+)'/) || [])[1])
          .filter(Boolean)
      );
      for (const d of toAdd) existingDomains.add(d);
      const newLines = Array.from(existingDomains).map(d => `    '${d}'`).join(',');
      const replacement = `${category}: new Set([\n${newLines}\n  ])`;
      updated = updated.replace(pattern, replacement);
    }
    if (updated !== original) {
      fs.writeFileSync(wlPath, updated, 'utf-8');
    }

    return NextResponse.json({ success: true, message: 'Processed domains and updated static whitelist', data: { additions } });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}


