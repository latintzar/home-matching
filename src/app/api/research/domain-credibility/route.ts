/**
 * Domain Credibility Endpoint
 * 
 * Scores a batch of domains/URLs and caches results.
 * Uses:
 * 1. Whitelist (high credibility)
 * 2. Deterministic rules + heuristics
 * 3. Gemini Flash evaluation for unknown domains (batched 10 at a time)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { scoreDomain, scoreDomainWithTitle } from '@/lib/cred/scoreDomain';
import { extractDomain, getEtld1 } from '@/lib/cred/etld';
import { getCacheByDomain, upsertCache, CacheEntry } from '@/lib/cred/cache';
import { isWhitelisted, extractDomainFromUrl } from '@/lib/domain-whitelists';
import { callGeminiRest } from '@/lib/gemini-rest-client';

export const runtime = 'nodejs';

const InputSchema = z.object({
  items: z.array(z.object({ 
    url: z.string().url(),
    title: z.string().optional(),
    category: z.string().optional() 
  })).min(1).max(100),
  options: z.object({
    allowGeminiFallback: z.boolean().default(true),
    forceRefresh: z.boolean().default(false),
    phase: z.enum(['renovation', 'analysis']).default('analysis')
  }).optional()
});

/**
 * Evaluate a batch of unknown domains using Gemini Flash
 */
async function evaluateDomainsWithGemini(
  domains: Array<{ domain: string; url: string; title?: string }>
): Promise<Map<string, { credibility: string; method: string; reasoning: string }>> {
  const results = new Map();

  const prompt = `You are evaluating domain credibility for Spanish property research. Assess these domains AND their page titles for trustworthiness and information quality.

Domains and titles to evaluate:
${domains.map((d, i) => `${i + 1}. ${d.domain}${d.title ? ` - Title: "${d.title}"` : ''} (from URL: ${d.url})`).join('\n')}

For each domain, determine if it's:
- "high": Official government, recognized institutions, major media, professional organizations
- "medium-high": Academic, reputable companies, regional official sites
- "medium": Established portals, known brands, legitimate businesses
- "medium-low": Commercial sites, directories, mixed quality
- "low": Forums, blogs, suspicious sites, spam

IMPORTANT: If the TITLE contains keywords like "ayuntamiento", "comunidad autónoma", "ministerio", "boe", "boletín oficial", "colegio oficial", "institución", "instituto nacional", etc., treat it as "high" credibility even if the domain doesn't immediately suggest it.

Return JSON array with this structure:
[
  {
    "domain": "example.com",
    "credibility": "medium",
    "reasoning": "Brief explanation of why this credibility level"
  }
]

Be conservative - if unsure, use "medium-low" or "low".`;

  const schema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        domain: { type: 'string' },
        credibility: { 
          type: 'string',
          enum: ['high', 'medium-high', 'medium', 'medium-low', 'low']
        },
        reasoning: { type: 'string' }
      },
      required: ['domain', 'credibility', 'reasoning']
    }
  };

  try {
    const response = await callGeminiRest(prompt, {
      temperature: 0.2,
      topP: 0.7,
      topK: 20,
      maxOutputTokens: 2048,
      model: 'gemini-2.5-flash',
      responseMimeType: 'application/json',
      responseSchema: schema
    });

    if (!response.success || !response.text) {
      console.error('❌ Gemini evaluation failed:', response.error);
      return results; // Return empty map - domains will remain 'unknown'
    }

    const cleaned = response.text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
    const evaluations = JSON.parse(cleaned);

    for (const eval_ of evaluations) {
      if (eval_.domain && eval_.credibility) {
        results.set(eval_.domain.toLowerCase(), {
          credibility: eval_.credibility,
          method: 'gemini_fallback',
          reasoning: eval_.reasoning || ''
        });
      }
    }

    console.log(`✅ Gemini evaluated ${results.size}/${domains.length} domains`);
  } catch (error) {
    console.error('❌ Error parsing Gemini evaluation:', error);
  }

  return results;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, options } = InputSchema.parse(body);
    const phase = options?.phase || 'analysis';

    console.log(`🏷️ Scoring ${items.length} domains for credibility (phase: ${phase})...`);

    // Step 1: Check cache and whitelist, score with deterministic/heuristic
    const scoredItems: Array<{
      url: string;
      domain: string;
      etld1: string;
      credibility: string;
      method: string;
      matched_signals?: string[];
      ttl_sec?: number;
      needsGemini?: boolean;
    }> = [];

    const unknownDomains: Array<{ domain: string; url: string; title?: string }> = [];

    for (const item of items) {
      const domain = extractDomain(item.url);
      const etld1 = getEtld1(domain);
      const domainLower = domain.toLowerCase().replace(/^www\./, '');

      // Check cache first
      if (!options?.forceRefresh) {
        const cached = await getCacheByDomain(domainLower);
        if (cached && new Date(cached.expires_at) > new Date()) {
          console.log(`✅ Cache hit for ${domainLower}`);
          scoredItems.push({
            url: item.url,
            domain: domainLower,
            etld1,
            credibility: cached.credibility,
            method: cached.method,
            matched_signals: cached.matched_signals || []
          });
          continue;
        }
      }

      // Check whitelist (high credibility)
      if (isWhitelisted(domainLower, phase)) {
        console.log(`✅ Whitelisted: ${domainLower} → high`);
        const cacheEntry: CacheEntry = {
          domain: domainLower,
          etld1,
          source_url: item.url,
          credibility: 'high',
          method: 'whitelist' as any,
          matched_signals: ['whitelisted'],
          ttl_sec: 31536000 // 1 year
        };

        try {
          await upsertCache(cacheEntry);
        } catch (cacheError) {
          console.error(`⚠️ Cache failed for ${domainLower}, continuing...`);
        }

        scoredItems.push({
          url: item.url,
          domain: domainLower,
          etld1,
          credibility: 'high',
          method: 'whitelist' as any,
          matched_signals: ['whitelisted']
        });
        continue;
      }

      // Score with deterministic/heuristic rules + title analysis
      const { cred, method, signals } = scoreDomainWithTitle(domainLower, item.title);

      console.log(`🔍 Scored ${domainLower}${item.title ? ` (title: "${item.title.substring(0, 50)}...")` : ''}: ${cred} (${method})`);

      // Cache the result (non-blocking)
      const cacheEntry: CacheEntry = {
        domain: domainLower,
        etld1,
        source_url: item.url,
        credibility: cred,
        method: method as 'deterministic' | 'heuristic',
        matched_signals: signals,
        ttl_sec: method === 'deterministic' ? 31536000 : 7776000
      };

      try {
        await upsertCache(cacheEntry);
      } catch (cacheError) {
        console.error(`⚠️ Cache failed for ${domainLower}, continuing...`);
      }

      // If unknown and Gemini fallback enabled, queue for Gemini evaluation
      if (cred === 'unknown' && options?.allowGeminiFallback) {
        unknownDomains.push({ domain: domainLower, url: item.url, title: item.title });
        scoredItems.push({
          url: item.url,
          domain: domainLower,
          etld1,
          credibility: 'unknown',
          method: 'none',
          matched_signals: signals,
          needsGemini: true
        });
      } else {
        scoredItems.push({
          url: item.url,
          domain: domainLower,
          etld1,
          credibility: cred,
          method,
          matched_signals: signals,
          ttl_sec: cacheEntry.ttl_sec
        });
      }
    }

    // Step 2: Batch evaluate unknown domains with Gemini (10 at a time)
    if (unknownDomains.length > 0 && options?.allowGeminiFallback) {
      console.log(`🤖 Evaluating ${unknownDomains.length} unknown domains with Gemini (batched)...`);

      const batchSize = 10;
      const batches: Array<Array<{ domain: string; url: string }>> = [];
      
      for (let i = 0; i < unknownDomains.length; i += batchSize) {
        batches.push(unknownDomains.slice(i, i + batchSize));
      }

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        console.log(`📦 Processing batch ${batchIdx + 1}/${batches.length} (${batch.length} domains)...`);

        const geminiResults = await evaluateDomainsWithGemini(batch);

        // Update scoredItems with Gemini results
        for (const item of scoredItems) {
          if (item.needsGemini && geminiResults.has(item.domain)) {
            const geminiResult = geminiResults.get(item.domain)!;
            item.credibility = geminiResult.credibility;
            item.method = 'gemini_fallback';
            item.matched_signals = [geminiResult.reasoning || 'gemini_evaluated'];

            // Cache Gemini result
            const cacheEntry: CacheEntry = {
              domain: item.domain,
              etld1: item.etld1,
              source_url: item.url,
              credibility: geminiResult.credibility as any,
              method: 'gemini_fallback',
              matched_signals: [geminiResult.reasoning || 'gemini_evaluated'],
              ttl_sec: 7776000 // 90 days
            };

            try {
              await upsertCache(cacheEntry);
            } catch (cacheError) {
              console.error(`⚠️ Cache failed for Gemini result ${item.domain}, continuing...`);
            }
          }
        }

        // Small delay between batches to avoid rate limits
        if (batchIdx < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log(`✅ Completed Gemini evaluation for ${unknownDomains.length} domains`);
    }

    // Remove needsGemini flag from final results
    const finalResults = scoredItems.map(({ needsGemini, ...rest }) => rest);

    console.log(`✅ Completed scoring ${finalResults.length} domains`);

    return NextResponse.json({ results: finalResults });

  } catch (error) {
    console.error('Domain credibility error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    message: 'Use POST to score domains',
    example: {
      items: [{ url: 'https://example.com', category: 'regulatory_zoning' }],
      options: { 
        allowGeminiFallback: true, 
        forceRefresh: false,
        phase: 'analysis'
      }
    }
  });
}
