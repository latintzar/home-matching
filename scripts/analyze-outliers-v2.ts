/**
 * Analyze MASTER_AGENCY_LIST.csv for DEFINITE outliers
 * More conservative - fewer false positives
 */

import * as fs from 'fs';
import * as path from 'path';

interface Agency {
  domain: string;
  url: string;
  title: string;
  snippet: string;
}

// DEFINITE outlier patterns - very specific
const DEFINITE_OUTLIERS = {
  // === GOVERNMENT (must have ayuntamiento/gobierno in title or .gob domain) ===
  government: {
    // Domain must be .gob.es or specific gov patterns
    domainStrict: /\.gob\.|\.gov\.|gobiernodecanarias|jcyl\.es|euskadi\.eus.*(?!inmobiliaria)/i,
    // Title must explicitly say ayuntamiento/gobierno
    titleStrict: /^ayuntamiento|^ayto\.|^concello|^ajuntament|^diputaci[oó]n|^gobierno|^ministerio|^consejer[ií]a|^generalitat|^xunta|administraci[oó]n p[uú]blica|portal de transparencia/i,
  },
  
  // === NEWS (must be actual news site) ===
  news_definite: {
    domainStrict: /^(el|la)?mundo\.|^(el|la)?pais\.|lavanguardia\.|^abc\.|20minutos\.|elconfidencial\.|rtve\.|cope\.|ondacero\.|cadenaser\./i,
    titleStrict: /^noticias de|^peri[oó]dico|^diario de|^el diario|últimas noticias/i,
  },
  
  // === PORTALS (definite aggregators) ===
  portal_definite: {
    domainStrict: /^idealista\.|^fotocasa\.|^habitaclia\.|^pisos\.com|^yaencontre\.|^milanuncios\.|^wallapop\.|^segundamano\./i,
    titleStrict: /portal inmobiliario nacional|miles de anuncios/i,
  },
  
  // === DIRECTORIES ===
  directory_definite: {
    domainStrict: /paginasamarillas|infoisinfo\.es|europages\.|qdq\.|cylex\.|hotfrog\./i,
    titleStrict: /directorio de empresas|p[aá]ginas amarillas|gu[ií]a de empresas/i,
  },
  
  // === JOB SITES ===
  jobs_definite: {
    domainStrict: /^infojobs\.|^indeed\.|^linkedin\.com|^adecco\.|^randstad\.|^manpower\.|jobijoba|jobsora|empleo\.trovit/i,
    titleStrict: /^ofertas de empleo|^trabajo en|^buscar empleo/i,
  },
  
  // === HOTELS (not vacation rentals) ===
  hotel_definite: {
    domainStrict: /^booking\.|^trivago\.|^expedia\.|^hotels\.com|^hostelworld\./i,
    titleStrict: /^hotel [A-Z]|reserva tu hotel|book your hotel/i,
  },
  
  // === BANKS ===
  bank_definite: {
    domainStrict: /^bbva\.|^santander\.|^caixabank\.|^bankia\.|^sabadell\.|^unicaja\.|^ibercaja\.|^kutxabank\.|^bankinter\./i,
    titleStrict: /^banco |entidad bancaria|servicios bancarios/i,
  },
  
  // === HEALTHCARE ===
  healthcare_definite: {
    domainStrict: /^hospital|^clinica(?!inmobiliaria)|^osakidetza|^sergas\.|^sacyl\./i,
    titleStrict: /^hospital |^cl[ií]nica |centro de salud|servicios sanitarios/i,
  },
  
  // === UTILITIES ===
  utilities_definite: {
    domainStrict: /^iberdrola\.|^endesa\.|^naturgy\.|^repsol\.|^cepsa\./i,
    titleStrict: /^factura de luz|suministro el[eé]ctrico|tarifa de gas/i,
  },
  
  // === REGISTRADORES/NOTARIOS (specific) ===
  legal_definite: {
    domainStrict: /^registradores\.|^notariado\.|^cgn\.org/i,
    titleStrict: /^registro de la propiedad|^colegio de notarios|^notar[ií]a de/i,
  },
};

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
      snippet: values[11] || '',
    });
  }
  
  return agencies;
}

function isDefiniteOutlier(agency: Agency): { type: string; reason: string } | null {
  const { domain, title, snippet } = agency;
  
  for (const [type, patterns] of Object.entries(DEFINITE_OUTLIERS)) {
    // Check domain first
    if (patterns.domainStrict.test(domain)) {
      return { type, reason: `domain: ${domain}` };
    }
    
    // Check title
    if (patterns.titleStrict.test(title)) {
      return { type, reason: `title: "${title.slice(0, 50)}"` };
    }
  }
  
  return null;
}

async function main() {
  const csvPath = path.join(process.cwd(), 'data/MASTER_AGENCY_LIST.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const agencies = parseCSV(content);
  
  console.log(`Total agencies: ${agencies.length}\n`);
  
  const outliers: Map<string, Agency[]> = new Map();
  const clean: Agency[] = [];
  
  for (const agency of agencies) {
    const result = isDefiniteOutlier(agency);
    
    if (result) {
      if (!outliers.has(result.type)) {
        outliers.set(result.type, []);
      }
      outliers.get(result.type)!.push({ ...agency, ...result } as any);
    } else {
      clean.push(agency);
    }
  }
  
  // Print summary
  console.log('=== DEFINITE OUTLIERS (conservative) ===\n');
  let totalOutliers = 0;
  
  const sortedTypes = Array.from(outliers.entries()).sort((a, b) => b[1].length - a[1].length);
  
  for (const [type, list] of sortedTypes) {
    console.log(`${type.toUpperCase()}: ${list.length} domains`);
    totalOutliers += list.length;
    
    for (const a of list.slice(0, 3)) {
      console.log(`  - ${a.domain}`);
    }
    if (list.length > 3) {
      console.log(`  ... and ${list.length - 3} more`);
    }
    console.log('');
  }
  
  console.log('========================================');
  console.log(`DEFINITE OUTLIERS: ${totalOutliers}`);
  console.log(`CLEAN AGENCIES: ${clean.length}`);
  console.log('========================================\n');
  
  // Save definite outlier domains
  const outlierList = Array.from(outliers.entries()).flatMap(([type, list]) => 
    list.map(a => ({ domain: a.domain, type, title: a.title?.slice(0, 60) }))
  );
  
  fs.writeFileSync(
    'data/definite_outlier_domains.json',
    JSON.stringify(outlierList, null, 2)
  );
  
  // Save just the domain names for easy blocklist
  const outlierDomainNames = outlierList.map(o => o.domain);
  fs.writeFileSync(
    'data/outlier_domain_blocklist.txt',
    outlierDomainNames.join('\n')
  );
  
  console.log('Saved: data/definite_outlier_domains.json');
  console.log('Saved: data/outlier_domain_blocklist.txt');
  
  // Now let's also find domains that are DEFINITELY real estate
  // by looking for patterns that confirm they are agencies
  console.log('\n=== CHECKING REMAINING FOR SUSPICIOUS PATTERNS ===\n');
  
  const suspicious: Agency[] = [];
  for (const agency of clean) {
    // Check if it looks suspicious
    const domainLower = agency.domain.toLowerCase();
    const titleLower = (agency.title || '').toLowerCase();
    
    // Suspicious if:
    // 1. Domain ends with .org (usually non-profit)
    // 2. Domain ends with .gob.es variants
    // 3. Title contains "ayuntamiento" but wasn't caught
    // 4. No "inmobiliaria" or property-related words anywhere
    
    const hasPropertyWords = /inmobiliaria|property|finca|piso|casa|vivienda|estate|realty|home|real estate/i.test(
      `${agency.domain} ${agency.title} ${agency.snippet}`
    );
    
    if (domainLower.endsWith('.org') && !hasPropertyWords) {
      suspicious.push(agency);
    } else if (/ayuntamiento|concello|ajuntament/i.test(titleLower)) {
      suspicious.push(agency);
    } else if (domainLower.endsWith('.es') && !hasPropertyWords && !agency.title) {
      suspicious.push(agency);
    }
  }
  
  if (suspicious.length > 0) {
    console.log(`Found ${suspicious.length} more suspicious domains:\n`);
    for (const a of suspicious.slice(0, 20)) {
      console.log(`  - ${a.domain}: ${a.title?.slice(0, 50) || '(no title)'}`);
    }
    if (suspicious.length > 20) {
      console.log(`  ... and ${suspicious.length - 20} more`);
    }
    
    // Add to outlier list
    const extraOutliers = suspicious.map(a => ({ domain: a.domain, type: 'suspicious', title: a.title?.slice(0, 60) }));
    fs.writeFileSync(
      'data/suspicious_domains.json',
      JSON.stringify(extraOutliers, null, 2)
    );
    console.log('\nSaved: data/suspicious_domains.json');
  }
}

main().catch(console.error);

