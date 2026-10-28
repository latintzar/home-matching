/**
 * Domain Credibility Scoring
 * 
 * Hybrid approach using:
 * 1. Deterministic code rules (fast path)
 * 2. Regex/keyword heuristics for long-tail official sites
 * 3. Optional Gemini 2.5 Flash fallback for ambiguous domains
 */

export type Credibility = 'high' | 'medium-high' | 'medium' | 'medium-low' | 'low' | 'unknown';

export interface ScoringResult {
  cred: Credibility;
  method: 'deterministic' | 'heuristic' | 'gemini_fallback' | 'none';
  signals: string[];
}

interface DeterministicRule {
  test: (domain: string) => boolean;
  cred: Credibility;
  signal: string;
}

interface HeuristicRule {
  regex: RegExp;
  cred: Credibility;
  signal: string;
}

const DETERMINISTIC: DeterministicRule[] = [
  { 
    test: (d: string) => d.endsWith('.gob.es') || d.includes('boe.es') || /ayunt(amien)?to|ajuntament|diputaci(o|ó)n|cabildo|consell/i.test(d), 
    cred: 'high', 
    signal: 'gov_local_keyword' 
  },
  { 
    test: (d: string) => /(^|\.)mitma\.gob\.es|ine\.es|icane|inegi|ine\.pt/i.test(d), 
    cred: 'high', 
    signal: 'natl_institute' 
  },
  { 
    test: (d: string) => /(^|\.)edu($|\.)|univ|universidad|csic/i.test(d), 
    cred: 'medium-high', 
    signal: 'academic' 
  },
  { 
    test: (d: string) => /(elpais|elmundo|abc|lavanguardia|diariodemallorca|rtve|cadenaSER)\.com/i.test(d), 
    cred: 'medium', 
    signal: 'major_media' 
  },
  { 
    test: (d: string) => /(idealista|fotocasa|habitaclia|pisos)\.com/i.test(d), 
    cred: 'medium', 
    signal: 'major_portal' 
  },
  { 
    test: (d: string) => /(habitissimo|obramat|bauhaus|leroymerlin)\./i.test(d), 
    cred: 'medium-low', 
    signal: 'commerce_cost' 
  },
  { 
    test: (d: string) => /(burbuja\.info|reddit\.com|forocoches|tapatalk|wordpress|blogspot)/i.test(d), 
    cred: 'low', 
    signal: 'forum_blog' 
  }
];

const HEURISTIC: HeuristicRule[] = [
  { regex: /(gob|gov|ayto|ajuntament|diputaci[oó]n|cabildo|consell)/i, cred: 'high', signal: 'public_keywords' },
  { regex: /\.(cat|eus|gal)$/i, cred: 'medium-high', signal: 'regional_tld' },
  { regex: /(edu|univ|universidad|research|org)/i, cred: 'medium-high', signal: 'academic_org' },
  { regex: /(noticia|diario|peri[oó]dico|press|rtve|cadena)/i, cred: 'medium', signal: 'media_keywords' },
  { regex: /(foro|blog|reddit|burbuja|wordpress|tapatalk)/i, cred: 'low', signal: 'ugc_keywords' }
];

const credRank = (c: Credibility): number => {
  return { 'high': 5, 'medium-high': 4, 'medium': 3, 'medium-low': 2, 'low': 1, 'unknown': 0 }[c];
};

/**
 * Score a domain for credibility
 * @param domain - The domain/hostname to score (lowercase)
 * @returns ScoringResult with credibility, method, and matched signals
 */
export function scoreDomain(domain: string): ScoringResult {
  const d = domain.toLowerCase().trim();
  
  // Try deterministic rules first (fast path)
  for (const rule of DETERMINISTIC) {
    if (rule.test(d)) {
      return {
        cred: rule.cred,
        method: 'deterministic',
        signals: [rule.signal]
      };
    }
  }
  
  // Apply heuristic rules
  const hits = HEURISTIC.filter(h => h.regex.test(d));
  
  if (hits.length > 0) {
    // Combine hits → pick strongest cred in hits; collect signals
    hits.sort((a, b) => credRank(b.cred) - credRank(a.cred));
    const best = hits[0];
    
    return {
      cred: best.cred,
      method: 'heuristic',
      signals: hits.map(h => h.signal)
    };
  }
  
  return {
    cred: 'unknown',
    method: 'none',
    signals: []
  };
}

// Add title-based scoring
const PRIMARY_TITLE_KEYWORDS = [
  'boe', 'boletín oficial', 'ley', 'real decreto', 'orden', 'normativa',
  'reglamento', 'instrucción', 'resolución', 'decreto', 'circular',
  'colegio oficial', 'notariado', 'registro de la propiedad',
  'instituto nacional', 'ministerio', 'estadística oficial',
  'ayuntamiento', 'comunidad autónoma', 'diputación', 'consell',
  'cabildo', 'institución', 'gobierno', 'administración pública'
];

export function scoreDomainWithTitle(domain: string, title?: string): ScoringResult {
  // First check domain
  const domainResult = scoreDomain(domain);
  
  // If title suggests primary source, upgrade credibility
  if (title) {
    const titleLower = title.toLowerCase();
    if (PRIMARY_TITLE_KEYWORDS.some(keyword => titleLower.includes(keyword))) {
      // Upgrade to at least medium-high if title suggests official source
      if (credRank(domainResult.cred) < credRank('medium-high')) {
        return {
          cred: 'medium-high',
          method: 'heuristic',
          signals: [...domainResult.signals, 'primary_title_keyword']
        };
      }
    }
  }
  
  return domainResult;
}

