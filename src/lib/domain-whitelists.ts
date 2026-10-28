export type ResearchCategory = 'costs' | 'timings' | 'permits' | 'laws_regulations' | 'norms_standards' | 'market_practices' | 'incentives';

export type AnalysisCategory = 
  | 'regulatory_zoning' 
  | 'market_valuation' 
  | 'local_built_environment' 
  | 'safety_hazards' 
  | 'neighborhood_dynamics' 
  | 'renovation_maintenance' 
  | 'legal_compliance' 
  | 'environmental_factors' 
  | 'infrastructure_utilities' 
  | 'property_history' 
  | 'financial_considerations' 
  | 'cultural_heritage' 
  | 'community_resources' 
  | 'future_development' 
  | 'comparative_analysis';

// Renovation phase whitelists (per category)
export const STATIC_WHITELISTS: Record<ResearchCategory, Set<string>> = {
  costs: new Set([
    'arquality.es',    'diputaciondepalencia.es',    'ine.es',    'calvia.com',    'caib.es',    'osha.oregon.gov',    'saltoki.com',    'ikea.com',    'industria.gob.es',    'phila.gov',    'tarifas.tragsa.es',    'reviale.com',    'grespania.com',    'arrevol.com'
  ]),
  timings: new Set([
    'habitissimo.es',    'leroymerlin.es',    'calvia.com',    'aue.gob.es',    'zaragoza.es',    'gunartea.com',    'cemix.com',    'miteco.gob.es',    'usa.gov',    'usg.com',    'sede.cantabria.es'
  ]),
  permits: new Set([
    'boe.es',    'caib.es',    'rossitzahantelmann.com',    'arquitasa.com',    'calvia2000.es',    'coaib.org',    'agendacoaib.org',    'urbanismosantacruz.es',    'soib.es',    'oarcoaib.org',    'incaciutat.com',    'fondoseuropeos.hacienda.gob.es'
  ]),
  laws_regulations: new Set([
    'boe.es',    'access-board.gov',    'codigotecnico.org',    'oarcoaib.org',    'arona.org',    'certicalia.com'
  ]),
  norms_standards: new Set([
    'codigotecnico.org',    'static.malaga.es',    'contrataciondelestado.es',    'cnmc.es',    'arquitectosdecadiz.com',    'calvia.com',    'gva.es',    'coit.es',    'alicante.es',    'ajsantanyi.net',    'habitatge.gencat.cat',    'boe.es',    'agremia.com',    'industria.gob.es'
  ]),
  market_practices: new Set([
    'idealista.com',    'juventudeinfancia.gob.es',    'sepe.es',    'bigmat.es',    'bde.es',    'codigotecnico.org',    'cnc.es',    'mordorintelligence.com',    'technal.com',    'constructoresdebaleares.com',    'boe.es',    'conselldemallorca.es',    'hogami.leroymerlin.es',    'habitissimo.es',    'rtve.es'
  ]),
  incentives: new Set([
    'boe.es',    'cafbal.com',    'calvia.com',    'efiwatt.com',    'fundacionrenovables.org',    'mivau.gob.es',    'coaatmca.com',    'caib.es',    'eldiario.es',    'sede.agenciatributaria.gob.es',    'sede.idae.gob.es'
  ])
};

// Analysis phase whitelist (general trusted domains across all analysis categories)
export const ANALYSIS_WHITELIST = new Set<string>([
  // Government & Official
  'boe.es',
  'gob.es',
  'mitma.gob.es',
  'miteco.gob.es',
  'ine.es',
  'caib.es',
  'conselldemallorca.es',
  'ajuntament.es',
  'ayuntamiento.es',
  'diputacion.es',
  
  // Professional & Academic
  'codigotecnico.org',
  'coaib.org',
  'arquitectos.es',
  'coaat.es',
  
  // Major Media & Portals
  'idealista.com',
  'fotocasa.com',
  'habitaclia.com',
  'rtve.es',
  'elpais.com',
  'elmundo.es',
  
  // Construction & Renovation
  'habitissimo.es',
  'leroymerlin.es',
  'certicalia.com',
  
  // Regional & Local
  'habitatge.gencat.cat',
  'gva.es',
  'calvia.com',
  'zaragoza.es',
  'alicante.es',
  
  // Standards & Regulations
  'cnmc.es',
  'industria.gob.es',
  'agremia.com',
  
  // Research & Data
  'bde.es',
  'ine.es',
  
  // Trusted Services
  'sede.agenciatributaria.gob.es',
  'sede.idae.gob.es',
  'fondoseuropeos.hacienda.gob.es'
]);

export function extractDomainFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function isWhitelisted(domain: string, phase: 'renovation' | 'analysis' = 'analysis'): boolean {
  const d = domain.toLowerCase().replace(/^www\./, '');
  
  if (phase === 'analysis') {
    return ANALYSIS_WHITELIST.has(d);
  }
  
  // For renovation phase, check all category whitelists
  return Object.values(STATIC_WHITELISTS).some(whitelist => whitelist.has(d));
}
