/**
 * Analyze MASTER_AGENCY_LIST.csv for outliers
 * Marks domains that are NOT real estate agencies
 */

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
  // Analysis fields
  outlier_type?: string;
  outlier_reason?: string;
}

// Outlier patterns - check domain AND title AND snippet
const OUTLIER_PATTERNS = {
  // === GOVERNMENT/MUNICIPAL ===
  government: {
    domain: /\.(gob|gov)\.|gobierno|ayuntamiento|ayto[-.]|concello|ajuntament|diputacion|junta|comunidad|generalitat/i,
    title: /ayuntamiento|ayto\.|concello|ajuntament|diputaci[oó]n|gobierno|administraci[oó]n p[uú]blica|ministerio|consejer[ií]a|generalitat|xunta/i,
    snippet: /ayuntamiento|concello|ajuntament|administraci[oó]n p[uú]blica|servicios municipales/i,
  },
  
  // === NEWS/MEDIA ===
  news: {
    domain: /noticias|diario|periodico|prensa|news|elmundo|elpais|lavanguardia|abc\.|20minutos|elconfidencial|cope\.|onda|cadena|rtve/i,
    title: /noticias|peri[oó]dico|diario|prensa|news|medio de comunicaci[oó]n/i,
    snippet: /noticias de|[uú]ltima hora|actualidad|redacci[oó]n/i,
  },
  
  // === BANKS/FINANCIAL ===
  bank: {
    domain: /bbva|santander|caixa|bankia|sabadell|unicaja|ibercaja|kutxa|laboral|bankinter|openbank|ing\.|deutsche/i,
    title: /banco|bank|caja de ahorros|entidad financiera|cr[eé]dito hipotecario/i,
    snippet: /pr[eé]stamo|hipoteca|financiaci[oó]n|cuenta corriente|dep[oó]sito/i,
  },
  
  // === MAJOR PORTALS (aggregators) ===
  portal: {
    domain: /idealista|fotocasa|habitaclia|pisos\.com|yaencontre|milanuncios|wallapop|vibbo|segundamano|tucasa|enalquiler/i,
    title: /portal inmobiliario|anuncios gratis|clasificados/i,
    snippet: /miles de anuncios|busca entre|encuentra tu/i,
  },
  
  // === LEGAL/NOTARY ===
  legal: {
    domain: /notario|notaria|abogado|lawyer|bufete|registro|registrador|procurador|juzgado/i,
    title: /notar[ií][ao]|abogado|bufete|despacho jur[ií]dico|registro de la propiedad|procurador/i,
    snippet: /servicios jur[ií]dicos|asesoramiento legal|escritura|testamento/i,
  },
  
  // === TOURISM/HOTELS ===
  tourism: {
    domain: /hotel[^i]|hostal|hostel|booking|airbnb|trivago|aparthotel|resort|spa\.|turismo(?!inmobiliario)/i,
    title: /hotel(?!inmobiliaria)|hostal|alojamiento|hospedaje|booking|reserva tu/i,
    snippet: /reserva|habitaci[oó]n.*noche|estancia|check-in/i,
  },
  
  // === INSURANCE ===
  insurance: {
    domain: /seguro|insurance|mapfre|allianz|axa|generali|zurich|liberty|pelayo|mutua|asisa/i,
    title: /seguros|insurance|p[oó]liza|aseguradora/i,
    snippet: /seguro de hogar|p[oó]liza|cobertura|siniestro/i,
  },
  
  // === DIRECTORIES ===
  directory: {
    domain: /paginasamarillas|qdq|infoisinfo|europages|kompass|cylex|hotfrog|tupueblo|guialocal/i,
    title: /directorio|p[aá]ginas amarillas|gu[ií]a de empresas|listado de/i,
    snippet: /directorio de empresas|encuentra empresas|gu[ií]a comercial/i,
  },
  
  // === JOB SITES ===
  jobs: {
    domain: /infojobs|indeed|linkedin\.com|adecco|randstad|manpower|trabajos|empleo(?!inmobiliario)/i,
    title: /ofertas de empleo|trabajo en|buscar empleo|portal de empleo/i,
    snippet: /ofertas de trabajo|busca empleo|encuentra trabajo|cv|curr[ií]culum/i,
  },
  
  // === EDUCATION ===
  education: {
    domain: /universidad|university|\.edu\.|escuela|colegio|instituto(?!inmobiliario)|formacion|master|curso/i,
    title: /universidad|escuela|colegio|formaci[oó]n|curso|m[aá]ster|grado/i,
    snippet: /estudia|matricula|curso|formaci[oó]n|alumno/i,
  },
  
  // === HEALTHCARE ===
  healthcare: {
    domain: /hospital|clinica|medico|salud|farmacia|sanidad|sergas|sacyl|osakidetza/i,
    title: /hospital|cl[ií]nica|centro m[eé]dico|farmacia|salud/i,
    snippet: /cita m[eé]dica|paciente|tratamiento|consulta m[eé]dica/i,
  },
  
  // === TRANSPORT ===
  transport: {
    domain: /transporte|renfe|metro|emt|autobus|taxi|aena|aeropuerto|ferrocarril/i,
    title: /transporte|autob[uú]s|metro|tren|aeropuerto|taxi/i,
    snippet: /horario|billetes|l[ií]nea|estaci[oó]n|parada/i,
  },
  
  // === UTILITIES ===
  utilities: {
    domain: /iberdrola|endesa|naturgy|repsol|cepsa|aguas|canal|electricidad|gas\./i,
    title: /electricidad|gas|agua|energ[ií]a|suministro/i,
    snippet: /factura|consumo|tarifa|suministro/i,
  },
  
  // === ASSOCIATIONS/NGO ===
  association: {
    domain: /asociacion|federacion|colegio(?!mayor)|coapi|api\.|cci\.|camara/i,
    title: /asociaci[oó]n|federaci[oó]n|colegio oficial|c[aá]mara de comercio/i,
    snippet: /asociados|miembros|colegiados|federados/i,
  },
};

function parseCSV(content: string): Agency[] {
  const lines = content.split('\n');
  const headers = lines[0].split(',');
  
  const agencies: Agency[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Simple CSV parsing (handles basic cases)
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
    
    const agency: Agency = {
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
    };
    
    agencies.push(agency);
  }
  
  return agencies;
}

function analyzeAgency(agency: Agency): { type: string; reason: string } | null {
  const { domain, title, snippet } = agency;
  const combined = `${domain} ${title} ${snippet}`.toLowerCase();
  
  for (const [type, patterns] of Object.entries(OUTLIER_PATTERNS)) {
    let matched = false;
    let reason = '';
    
    // Check domain
    if (patterns.domain.test(domain)) {
      matched = true;
      reason = `domain matches ${type}`;
    }
    
    // Check title (stronger signal)
    if (patterns.title.test(title)) {
      matched = true;
      reason = `title matches ${type}: "${title.slice(0, 50)}"`;
    }
    
    // Check snippet for confirmation
    if (matched && patterns.snippet.test(snippet)) {
      reason += ` + snippet confirms`;
    }
    
    if (matched) {
      return { type, reason };
    }
  }
  
  return null;
}

async function main() {
  const csvPath = path.join(process.cwd(), 'data/MASTER_AGENCY_LIST.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const agencies = parseCSV(content);
  
  console.log(`Total agencies: ${agencies.length}`);
  console.log('');
  
  const outliers: Map<string, Agency[]> = new Map();
  const clean: Agency[] = [];
  
  for (const agency of agencies) {
    const result = analyzeAgency(agency);
    
    if (result) {
      agency.outlier_type = result.type;
      agency.outlier_reason = result.reason;
      
      if (!outliers.has(result.type)) {
        outliers.set(result.type, []);
      }
      outliers.get(result.type)!.push(agency);
    } else {
      clean.push(agency);
    }
  }
  
  // Print summary
  console.log('=== OUTLIER SUMMARY ===');
  let totalOutliers = 0;
  
  for (const [type, list] of outliers.entries()) {
    console.log(`\n${type.toUpperCase()}: ${list.length} domains`);
    totalOutliers += list.length;
    
    // Show first 5 examples
    for (const a of list.slice(0, 5)) {
      console.log(`  - ${a.domain}: ${a.outlier_reason}`);
    }
    if (list.length > 5) {
      console.log(`  ... and ${list.length - 5} more`);
    }
  }
  
  console.log('\n========================================');
  console.log(`TOTAL OUTLIERS: ${totalOutliers}`);
  console.log(`CLEAN AGENCIES: ${clean.length}`);
  console.log('========================================');
  
  // Save outliers to file
  const outlierDomains = Array.from(outliers.values()).flat().map(a => ({
    domain: a.domain,
    type: a.outlier_type,
    reason: a.outlier_reason,
    title: a.title?.slice(0, 60),
  }));
  
  fs.writeFileSync(
    'data/outlier_domains.json',
    JSON.stringify(outlierDomains, null, 2)
  );
  console.log('\nOutliers saved to: data/outlier_domains.json');
  
  // Save clean domains
  const cleanDomains = clean.map(a => a.domain);
  fs.writeFileSync(
    'data/clean_domains.json',
    JSON.stringify(cleanDomains, null, 2)
  );
  console.log('Clean domains saved to: data/clean_domains.json');
}

main().catch(console.error);

