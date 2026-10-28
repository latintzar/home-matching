import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { STATIC_WHITELISTS, extractDomainFromUrl, ResearchCategory } from './domain-whitelists';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function validateDomainsForCategory(urls: string[], category: ResearchCategory): Promise<Set<string>> {
  const allowed = new Set<string>();
  const unknownDomains: Set<string> = new Set();

  for (const url of urls) {
    const domain = extractDomainFromUrl(url);
    if (!domain) continue;
    if (STATIC_WHITELISTS[category].has(domain)) {
      allowed.add(domain);
    } else {
      unknownDomains.add(domain);
    }
  }

  if (unknownDomains.size === 0) return allowed;

  // Check cache table
  const { data: cached } = await supabase
    .from('ai_domain_whitelist')
    .select('domain, credibility, category')
    .in('domain', Array.from(unknownDomains))
    .eq('category', category);

  const toAsk: string[] = [];
  if (cached) {
    for (const row of cached) {
      if (row.credibility === 'yes') allowed.add(row.domain);
      unknownDomains.delete(row.domain);
    }
  }
  toAsk.push(...unknownDomains);

  if (toAsk.length > 0) {
    const tasks = toAsk.map(async (domain) => {
      const prompt = `SYSTEM:\nYou are validating Spanish-language sources for property renovation research.\nDecide YES or NO — is this domain credible for factual use in category ${category}?\nYES = credible professional or governmental source\nNO = blog, opinion, forum, or unverified content\nRespond only YES or NO.\n\nDOMAIN: ${domain}`;

      const schema = {
        type: 'object',
        properties: {
          decision: { type: 'string', enum: ['YES', 'NO'] },
          confidence: { type: 'number' }
        },
        required: ['decision']
      };

      const res = await callGeminiRest(prompt, {
        model: 'gemini-2.5-flash',
        temperature: 0.0,
        maxOutputTokens: 128,
        responseMimeType: 'application/json',
        responseSchema: schema
      });

      let decision = 'NO';
      let confidence: number | null = null;
      if (res.success && res.text) {
        try {
          const parsed = JSON.parse(res.text);
          decision = parsed.decision || 'NO';
          confidence = typeof parsed.confidence === 'number' ? parsed.confidence : null;
        } catch {}
      }

      const credibility = decision === 'YES' ? 'yes' : 'no';
      await supabase.from('ai_domain_whitelist').upsert({
        domain,
        category,
        credibility,
        confidence: confidence ?? null,
        approved_by_ai: true
      });

      if (credibility === 'yes') allowed.add(domain);
    });

    await Promise.allSettled(tasks);
  }

  return allowed;
}

