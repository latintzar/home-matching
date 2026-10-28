/**
 * Gemini 3 Pro Outlier Analysis
 * 
 * Uses Gemini 3 Pro to analyze ALL domains in MASTER_AGENCY_LIST.csv
 * and identify which are NOT real estate agencies.
 * 
 * Uses structured output for reliable JSON parsing.
 * 
 * Usage:
 *   npx tsx scripts/gemini-outlier-analysis.ts
 *   npx tsx scripts/gemini-outlier-analysis.ts --batch-size=50
 */

import { callGeminiRest } from '../src/lib/gemini-rest-client';
import * as fs from 'fs';
import * as path from 'path';

interface Agency {
  domain: string;
  url: string;
  title: string;
  email: string;
  phone: string;
  social_links: string;
  platform: string;
  is_likely_agency: string;
  sitemap_found: string;
  sitemap_url: string;
  source_query: string;
  snippet: string;
}

interface OutlierAnalysis {
  is_real_estate_agency: boolean;
  confidence: 'high' | 'medium' | 'low';
  outlier_type?: string;
  reason: string;
  evidence: string[];
}

interface BatchResult {
  domain: string;
  analysis: OutlierAnalysis;
}

function parseCSV(content: string): Agency[] {
  const lines = content.split('\n');
  const agencies: Agency[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    
    agencies.push({
      domain: values[0] || '',
      url: values[1] || '',
      title: values[2] || '',
      email: values[3] || '',
      phone: values[4] || '',
      social_links: values[5] || '',
      platform: values[6] || '',
      is_likely_agency: values[7] || '',
      sitemap_found: values[8] || '',
      sitemap_url: values[9] || '',
      source_query: values[10] || '',
      snippet: values[11] || '',
    });
  }
  
  return agencies;
}

function buildPrompt(agencies: Agency[]): string {
  const agenciesText = agencies.map((a, i) => {
    return `DOMAIN ${i + 1}:
- Domain: ${a.domain}
- URL: ${a.url}
- Title: ${a.title || '(no title)'}
- Snippet: ${a.snippet?.slice(0, 200) || '(no snippet)'}
- Source Query: ${a.source_query || '(no query)'}
- Platform: ${a.platform || '(unknown)'}
- Has Sitemap: ${a.sitemap_found === 'YES' ? 'Yes' : 'No'}
`;
  }).join('\n');

  return `You are analyzing a list of Spanish real estate agency domains. Your task is to identify which domains are NOT actual real estate agencies.

OUTLIER TYPES TO LOOK FOR:
1. Government/Municipal sites (ayuntamientos, gobiernos, .gob.es domains)
2. News/Media sites (noticias, diarios, periódicos)
3. Banks/Financial institutions (not real estate focused)
4. Major portals/aggregators (idealista, fotocasa, etc. - these are NOT agencies)
5. Legal/Notary services (not agencies)
6. Tourism/Hotels (not real estate sales)
7. Insurance companies
8. Directories/Yellow pages
9. Job sites
10. Education/Universities
11. Healthcare/Hospitals
12. Utilities companies
13. Associations/Federations (not individual agencies)
14. Construction companies (if they don't sell properties)
15. Any other non-agency business

WHAT IS A REAL ESTATE AGENCY:
- Sells, rents, or manages properties (pisos, casas, oficinas, locales, etc.)
- Has property listings on their website
- Is an individual business, not a portal or directory
- May be called "inmobiliaria", "agencia inmobiliaria", "real estate", "property"

ANALYZE THESE ${agencies.length} DOMAINS:

${agenciesText}

For each domain, determine:
1. Is it a real estate agency? (true/false)
2. Confidence level (high/medium/low)
3. If NOT an agency, what type of outlier is it?
4. Clear reason for your classification
5. Specific evidence from the domain/title/snippet

Return your analysis as a JSON array with one object per domain, in the same order as provided.`;
}

const RESPONSE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      is_real_estate_agency: { type: 'boolean' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      outlier_type: { type: 'string' },
      reason: { type: 'string' },
      evidence: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['is_real_estate_agency', 'confidence', 'reason', 'evidence']
  }
};

async function analyzeBatch(agencies: Agency[]): Promise<BatchResult[]> {
  const prompt = buildPrompt(agencies);
  
  console.log(`\n📊 Analyzing batch of ${agencies.length} domains with Gemini 3 Pro...`);
  
  const response = await callGeminiRest(prompt, {
    model: 'gemini-3-pro-preview',
    temperature: 0.1,
    thinkingConfig: {
      thinkingLevel: 'HIGH'
    },
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA,
    maxOutputTokens: 65536, // Max allowed (should be enough with structured JSON)
  });
  
  if (!response.success || !response.text) {
    throw new Error(`Gemini API failed: ${response.error || 'Unknown error'}`);
  }
  
  // Parse JSON from response
  let analyses: OutlierAnalysis[];
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = response.text.match(/```json\s*([\s\S]*?)\s*```/) || 
                     response.text.match(/```\s*([\s\S]*?)\s*```/);
    const jsonText = jsonMatch ? jsonMatch[1] : response.text;
    analyses = JSON.parse(jsonText);
  } catch (e) {
    // If structured output was used, it should be valid JSON
    console.error('Failed to parse JSON:', response.text.substring(0, 500));
    throw e;
  }
  
  if (!Array.isArray(analyses) || analyses.length !== agencies.length) {
    throw new Error(`Expected ${agencies.length} analyses, got ${analyses?.length || 0}`);
  }
  
  return agencies.map((agency, i) => ({
    domain: agency.domain,
    analysis: analyses[i],
  }));
}

async function main() {
  console.log('🔍 Gemini 3 Pro Outlier Analysis');
  console.log('=================================\n');
  console.log(`Model: gemini-3-pro-preview`);
  console.log(`Context window: 1M+ tokens`);
  console.log(`Thinking level: HIGH`);
  console.log(`Mode: 2 LARGE BATCHES (max context usage)\n`);
  
  // Read CSV
  const csvPath = path.join(process.cwd(), 'data/MASTER_AGENCY_LIST.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const agencies = parseCSV(content);
  
  console.log(`Total domains to analyze: ${agencies.length}\n`);
  
  // Split into 2 batches (each ~1,835 domains)
  const batchSize = Math.ceil(agencies.length / 2);
  const batch1 = agencies.slice(0, batchSize);
  const batch2 = agencies.slice(batchSize);
  
  const allResults: BatchResult[] = [];
  
  try {
    console.log(`📦 Batch 1/2 (${batch1.length} domains)...`);
    const results1 = await analyzeBatch(batch1);
    allResults.push(...results1);
    console.log(`  ✅ Analyzed ${results1.length} domains\n`);
    
    await new Promise(r => setTimeout(r, 2000)); // Small delay
    
    console.log(`📦 Batch 2/2 (${batch2.length} domains)...`);
    const results2 = await analyzeBatch(batch2);
    allResults.push(...results2);
    console.log(`  ✅ Analyzed ${results2.length} domains\n`);
    
    const results = allResults;
    
    const outliers: BatchResult[] = [];
    const clean: BatchResult[] = [];
    
    // Categorize
    for (const result of results) {
      if (!result.analysis.is_real_estate_agency) {
        outliers.push(result);
      } else {
        clean.push(result);
      }
    }
  
    // Summary
    console.log('\n\n========================================');
    console.log('ANALYSIS COMPLETE');
    console.log('========================================');
    console.log(`Total analyzed: ${results.length}`);
    console.log(`Outliers found: ${outliers.length}`);
    console.log(`Clean agencies: ${clean.length}`);
    console.log('');
    
    // Group outliers by type
    const outliersByType: Map<string, BatchResult[]> = new Map();
    for (const outlier of outliers) {
      const type = outlier.analysis.outlier_type || 'unknown';
      if (!outliersByType.has(type)) {
        outliersByType.set(type, []);
      }
      outliersByType.get(type)!.push(outlier);
    }
    
    console.log('Outliers by type:');
    for (const [type, list] of Array.from(outliersByType.entries()).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${type}: ${list.length}`);
    }
    
    // Save results
    fs.writeFileSync(
      'data/gemini_outlier_analysis.json',
      JSON.stringify({
        total: results.length,
        outliers: outliers.length,
        clean: clean.length,
        results: results,
        outliersByType: Object.fromEntries(outliersByType),
      }, null, 2)
    );
  
  // Save outlier domains list
  const outlierDomains = outliers.map(o => o.domain);
  fs.writeFileSync(
    'data/gemini_outlier_domains.txt',
    outlierDomains.join('\n')
  );
  
  // Save clean domains
  const cleanDomains = clean.map(c => c.domain);
  fs.writeFileSync(
    'data/gemini_clean_domains.txt',
    cleanDomains.join('\n')
  );
  
    console.log('\n✅ Results saved:');
    console.log('  - data/gemini_outlier_analysis.json (full analysis)');
    console.log('  - data/gemini_outlier_domains.txt (outlier domains)');
    console.log('  - data/gemini_clean_domains.txt (clean domains)');
    
  } catch (error: any) {
    console.error('\n❌ Analysis failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main().catch(console.error);

