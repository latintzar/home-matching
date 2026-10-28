/**
 * Universal Ruleset - Cumulative Learning from All Domains
 * 
 * This grows as each domain graduates, providing context for future domains.
 * Stored in DynamoDB for persistence across Lambda invocations.
 */

import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';

const REGION = 'us-east-1';
const dynamodb = new DynamoDBClient({ region: REGION });
const RULESET_TABLE = 'leo-scraping-rules';
const RULESET_KEY = '__UNIVERSAL_RULESET__';

export interface SelectorPattern {
  selector: string;
  successCount: number;
  domains: string[];  // Which domains it worked for
}

export interface UniversalRuleset {
  // Common patterns by field, ordered by success rate
  patterns: {
    price: SelectorPattern[];
    bedrooms: SelectorPattern[];
    bathrooms: SelectorPattern[];
    m2_built: SelectorPattern[];
    m2_useful: SelectorPattern[];
    address: SelectorPattern[];
    city: SelectorPattern[];
    description: SelectorPattern[];
    photos: SelectorPattern[];
    title: SelectorPattern[];
    reference: SelectorPattern[];
    agency_name: SelectorPattern[];
  };

  // Coordinate extraction methods that worked
  coordinateMethods: {
    method: string;
    successCount: number;
    domains: string[];
  }[];

  // Photo extraction patterns that worked
  photoPatterns: {
    pattern: string;
    successCount: number;
    domains: string[];
  }[];

  // Stats
  stats: {
    totalDomainsProcessed: number;
    graduated: number;
    parked: number;
    lastUpdated: string;
  };

  // Parked domains with failure reasons
  parkedDomains: {
    domain: string;
    failures: string[];
    parkedAt: string;
  }[];
}

/**
 * Initialize empty Universal Ruleset
 */
export function createEmptyRuleset(): UniversalRuleset {
  const emptyPatterns: SelectorPattern[] = [];
  return {
    patterns: {
      price: [...emptyPatterns],
      bedrooms: [...emptyPatterns],
      bathrooms: [...emptyPatterns],
      m2_built: [...emptyPatterns],
      m2_useful: [...emptyPatterns],
      address: [...emptyPatterns],
      city: [...emptyPatterns],
      description: [...emptyPatterns],
      photos: [...emptyPatterns],
      title: [...emptyPatterns],
      reference: [...emptyPatterns],
      agency_name: [...emptyPatterns],
    },
    coordinateMethods: [],
    photoPatterns: [],
    stats: {
      totalDomainsProcessed: 0,
      graduated: 0,
      parked: 0,
      lastUpdated: new Date().toISOString(),
    },
    parkedDomains: [],
  };
}

/**
 * Load Universal Ruleset from DynamoDB
 */
export async function loadUniversalRuleset(): Promise<UniversalRuleset> {
  try {
    const result = await dynamodb.send(new GetItemCommand({
      TableName: RULESET_TABLE,
      Key: { domain: { S: RULESET_KEY } },
    }));

    if (result.Item?.ruleset?.S) {
      return JSON.parse(result.Item.ruleset.S);
    }
  } catch (error) {
    console.log('No existing Universal Ruleset found, creating new one');
  }

  return createEmptyRuleset();
}

/**
 * Save Universal Ruleset to DynamoDB
 */
export async function saveUniversalRuleset(ruleset: UniversalRuleset): Promise<void> {
  ruleset.stats.lastUpdated = new Date().toISOString();
  
  await dynamodb.send(new PutItemCommand({
    TableName: RULESET_TABLE,
    Item: {
      domain: { S: RULESET_KEY },
      ruleset: { S: JSON.stringify(ruleset) },
      updated_at: { S: ruleset.stats.lastUpdated },
    },
  }));
}

/**
 * Add successful selectors from a graduated domain
 */
export function addGraduatedDomain(
  ruleset: UniversalRuleset,
  domain: string,
  selectors: Record<string, string | null>
): void {
  const fields = Object.keys(ruleset.patterns) as (keyof typeof ruleset.patterns)[];
  
  for (const field of fields) {
    const selector = selectors[field];
    if (!selector) continue;

    // Find existing pattern or create new
    const existing = ruleset.patterns[field].find(p => p.selector === selector);
    if (existing) {
      existing.successCount++;
      if (!existing.domains.includes(domain)) {
        existing.domains.push(domain);
      }
    } else {
      ruleset.patterns[field].push({
        selector,
        successCount: 1,
        domains: [domain],
      });
    }

    // Sort by success count (most successful first)
    ruleset.patterns[field].sort((a, b) => b.successCount - a.successCount);
    
    // Keep top 20 patterns per field
    if (ruleset.patterns[field].length > 20) {
      ruleset.patterns[field] = ruleset.patterns[field].slice(0, 20);
    }
  }

  ruleset.stats.graduated++;
  ruleset.stats.totalDomainsProcessed++;
}

/**
 * Park a failed domain
 */
export function parkDomain(
  ruleset: UniversalRuleset,
  domain: string,
  failures: string[]
): void {
  ruleset.parkedDomains.push({
    domain,
    failures,
    parkedAt: new Date().toISOString(),
  });
  
  ruleset.stats.parked++;
  ruleset.stats.totalDomainsProcessed++;
}

/**
 * Generate context string for Teacher prompt
 */
export function generateTeacherContext(ruleset: UniversalRuleset): string {
  if (ruleset.stats.graduated === 0) {
    return 'This is the first domain. No prior patterns available.';
  }

  const lines: string[] = [
    `## UNIVERSAL RULESET (learned from ${ruleset.stats.graduated} domains)`,
    '',
    'These patterns have worked before. Check them FIRST, but adapt as needed:',
    '',
  ];

  const fields = Object.keys(ruleset.patterns) as (keyof typeof ruleset.patterns)[];
  for (const field of fields) {
    const topPatterns = ruleset.patterns[field].slice(0, 5);
    if (topPatterns.length > 0) {
      lines.push(`### ${field}`);
      for (const p of topPatterns) {
        lines.push(`  - "${p.selector}" (worked for ${p.successCount} domains)`);
      }
      lines.push('');
    }
  }

  if (ruleset.coordinateMethods.length > 0) {
    lines.push('### Coordinate Extraction Methods');
    for (const m of ruleset.coordinateMethods.slice(0, 5)) {
      lines.push(`  - ${m.method} (worked ${m.successCount} times)`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get stats summary
 */
export function getRulesetStats(ruleset: UniversalRuleset): string {
  return `Universal Ruleset: ${ruleset.stats.graduated} graduated, ${ruleset.stats.parked} parked, ${ruleset.stats.totalDomainsProcessed} total`;
}

