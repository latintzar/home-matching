import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

function requireRecipientConfiguration() {
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables');
}
}

const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, undefined, requireRecipientConfiguration);

/**
 * Citations Sweep Endpoint
 * 
 * Post-factum citation pass that:
 * - Extracts claims from buyer report prose
 * - Matches claims to evidence sources (from analysis_curated_results, contextual evidence)
 * - Splices inline citation hooks (dotted underlines)
 * - Computes confidence scores (high/medium/low)
 * - Groups evidence by type (Gov/Regs, HOA, Market, Trade)
 * 
 * Input: Buyer report JSON (text_analysis_results phase 'buyer_report')
 * Output: Enhanced buyer report with inline_citations, evidence_map, citation_chips
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const listingIdNum = parseInt(listingId, 10);

    if (isNaN(listingIdNum)) {
      return NextResponse.json(
        { success: false, error: 'invalid_listing_id', message: 'Invalid listing ID format' },
        { status: 400 }
      );
    }

    console.log(`📚 Starting citations sweep for listing ${listingId}`);

    // ========================================================================
    // STEP 1: Fetch buyer report
    // ========================================================================
    const { data: buyerReportData, error: buyerReportError } = await supabase
      .from('text_analysis_results')
      .select('results, id')
      .eq('listing_id', listingId)
      .eq('phase', 'buyer_report')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (buyerReportError || !buyerReportData) {
      return NextResponse.json(
        {
          success: false,
          error: 'buyer_report_not_found',
          message: 'Buyer report not found. Run /analysis/final-scope first.',
          details: buyerReportError?.message
        },
        { status: 404 }
      );
    }

    const buyerReport = buyerReportData.results as any;

    // Check if citations already exist
    if (buyerReport.inline_citations && buyerReport.evidence_map) {
      console.log(`✅ Citations already exist for listing ${listingId}`);
      return NextResponse.json({
        success: true,
        data: buyerReport,
        message: 'Citations already enhanced'
      });
    }

    // ========================================================================
    // STEP 2: Fetch evidence sources
    // ========================================================================
    // Fetch curated research from analysis Google search
    const { data: curatedResearch } = await supabase
      .from('analysis_curated_results')
      .select('category, summary, key_points, representative_snippets, sources_used, confidence_level')
      .eq('listing_id', listingIdNum);

    // Fetch contextual analysis evidence
    const { data: contextualData } = await supabase
      .from('text_analysis_results')
      .select('results')
      .eq('listing_id', listingIdNum)
      .eq('phase', 'contextual')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const contextualAnalysis = contextualData?.results as any;
    const contextualEvidence: any[] = [];
    
    if (contextualAnalysis?.categories) {
      contextualAnalysis.categories.forEach((cat: any) => {
        if (cat.evidence && Array.isArray(cat.evidence)) {
          cat.evidence.forEach((ev: any) => {
            contextualEvidence.push({
              ...ev,
              category: cat.category,
              source_type: 'contextual'
            });
          });
        }
      });
    }

    // Build evidence pool from curated research
    const evidencePool: Array<{
      id: string;
      url: string;
      title?: string;
      publisher?: string;
      date?: string;
      type: string;
      snippet: string;
      confidence: string;
      category?: string;
      source_quality?: 'primary' | 'secondary';
    }> = [];

    // Add curated research snippets - prioritize primary sources
    (curatedResearch || []).forEach((research: any) => {
      if (research.representative_snippets && Array.isArray(research.representative_snippets)) {
        // Separate primary and secondary sources
        const primarySnippets: any[] = [];
        const secondarySnippets: any[] = [];
        
        research.representative_snippets.forEach((snippet: any) => {
          const domain = snippet.source_domain || snippet.url || '';
          const title = snippet.title || '';
          const category = research.category || '';
          
          if (isPrimarySource(domain, title, category)) {
            primarySnippets.push(snippet);
          } else if (isSecondarySource(domain, title)) {
            secondarySnippets.push(snippet);
          } else {
            // Unknown sources go to secondary
            secondarySnippets.push(snippet);
          }
        });
        
        // Add primary sources first (up to 10 per category)
        primarySnippets.slice(0, 10).forEach((snippet: any, idx: number) => {
          const evidenceId = `curated_${research.category}_primary_${idx}`;
          evidencePool.push({
            id: evidenceId,
            url: snippet.url || '',
            title: snippet.title || snippet.source_domain || '',
            publisher: snippet.source_domain || '',
            date: snippet.date || new Date().toISOString().split('T')[0],
            type: categorizeSourceType(snippet.source_domain || ''),
            snippet: snippet.text || '',
            confidence: 'high', // Primary sources always high confidence
            category: research.category,
            source_quality: 'primary'
          });
        });
        
        // Add secondary sources (up to 5 per category, will be processed with Gemini Flash)
        secondarySnippets.slice(0, 5).forEach((snippet: any, idx: number) => {
          const evidenceId = `curated_${research.category}_secondary_${idx}`;
          evidencePool.push({
            id: evidenceId,
            url: snippet.url || '',
            title: snippet.title || snippet.source_domain || '',
            publisher: snippet.source_domain || '',
            date: snippet.date || new Date().toISOString().split('T')[0],
            type: categorizeSourceType(snippet.source_domain || ''),
            snippet: snippet.text || '',
            confidence: 'medium', // Secondary sources start as medium
            category: research.category,
            source_quality: 'secondary'
          });
        });
      }
    });

    // Add contextual evidence - classify as primary or secondary (with category context)
    contextualEvidence.forEach((ev: any, idx: number) => {
      const domain = ev.url || '';
      const title = ev.title || '';
      const category = ev.category || '';
      const isPrimary = isPrimarySource(domain, title, category);
      const evidenceId = `contextual_${category || 'unknown'}_${isPrimary ? 'primary' : 'secondary'}_${idx}`;
      evidencePool.push({
        id: evidenceId,
        url: ev.url || '',
        title: ev.title || extractDomain(ev.url) || '',
        publisher: extractDomain(ev.url) || '',
        date: ev.date || new Date().toISOString().split('T')[0],
        type: categorizeSourceType(ev.url || ''),
        snippet: ev.snippet || '',
        confidence: isPrimary ? 'high' : (ev.confidence || 'medium'),
        category: category,
        source_quality: isPrimary ? 'primary' : 'secondary'
      });
    });

    // ========================================================================
    // STEP 3: Generate citations using Gemini
    // ========================================================================
    const prompt = `Eres un experto en extracción de citaciones y verificación de fuentes. Tu tarea es analizar el informe del comprador y crear un mapa de citaciones que vincule las afirmaciones con las fuentes de evidencia disponibles.

INFORME DEL COMPRADOR (texto a analizar):
${JSON.stringify(buyerReport, null, 2)}

FUENTES DE EVIDENCIA DISPONIBLES:
${JSON.stringify(evidencePool, null, 2)}

TAREA:
1. Extrae las afirmaciones clave del informe (frases o párrafos que hacen declaraciones verificables).
2. Para cada afirmación, identifica qué fuentes de evidencia la respaldan, PRIORIZANDO fuentes primarias (source_quality: "primary").
3. Calcula un nivel de confianza (high/medium/low) basado en:
   - PRIORIDAD: Fuentes primarias (gob.es, boe.es, colegios profesionales, registros oficiales) = high confidence
   - Fuentes secundarias (blogs, agencias inmobiliarias, webs de reforma) = medium/low confidence, solo si no hay fuentes primarias disponibles
   - Número de fuentes que respaldan la afirmación
   - Consistencia entre fuentes
   - Relevancia del snippet a la afirmación
4. Identifica 1-2 frases clave por párrafo/sección que deben tener subrayado punteado (dotted underline).

REGLAS ESTRICTAS DE CALIDAD:
- PRIORIZA SIEMPRE fuentes primarias (source_quality: "primary") sobre secundarias
- Solo usa fuentes secundarias si NO hay fuentes primarias disponibles para esa afirmación
- Para afirmaciones sobre normativas, permisos, costes oficiales, plazos legales: SOLO usa fuentes primarias
- Para afirmaciones sobre tendencias de mercado, opiniones profesionales: puedes usar fuentes secundarias pero con confidence "medium"
- Solo crea citaciones para afirmaciones verificables (hechos, datos, normativas, costes, plazos).
- NO cites opiniones subjetivas o narrativas generales.
- Agrupa evidencia por tipo: Gov/Regs, HOA, Market, Trade, Academic, News.
- Usa IDs únicos para cada afirmación (claim_id) y evidencia (evidence_id).
- El claim_text debe ser la frase exacta del informe que se cita.
- Incluye el contexto del párrafo/sección donde aparece la afirmación.

ESTRUCTURA DE SALIDA:
Devuelve SOLO JSON válido con esta estructura exacta:
{
  "inline_citations": [
    {
      "claim_id": "claim_1",
      "claim_text": "Texto exacto de la afirmación del informe",
      "section": "house_diagnostics.findings_by_category.estado_materiales",
      "paragraph_index": 0,
      "evidence_ids": ["curated_permits_0", "contextual_permits_1"],
      "confidence": "high|medium|low",
      "key_phrases": ["frase clave 1", "frase clave 2"]
    }
  ],
  "evidence_map": {
    "curated_permits_0": {
      "url": "https://...",
      "title": "Título de la fuente",
      "publisher": "calvia.com",
      "date": "2024-01-15",
      "type": "Gov/Regs",
      "snippet": "Texto del snippet",
      "confidence": "high"
    }
  },
  "citation_chips": {
    "house_diagnostics.findings_by_category.estado_materiales": {
      "count": 3,
      "confidence": "high"
    }
  }
}

Devuelve SOLO JSON válido, sin texto adicional.`;

    const responseSchema = {
      type: 'object',
      properties: {
        inline_citations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              claim_id: { type: 'string' },
              claim_text: { type: 'string', minLength: 10 },
              section: { type: 'string' },
              paragraph_index: { type: 'number' },
              evidence_ids: { type: 'array', items: { type: 'string' }, minItems: 1 },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              key_phrases: { type: 'array', items: { type: 'string' } }
            },
            required: ['claim_id', 'claim_text', 'evidence_ids', 'confidence'],
            additionalProperties: false
          }
        },
        evidence_map: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              title: { type: 'string' },
              publisher: { type: 'string' },
              date: { type: 'string' },
              type: { type: 'string' },
              snippet: { type: 'string' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
            },
            required: ['url', 'type', 'snippet', 'confidence'],
            additionalProperties: false
          }
        },
        citation_chips: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              count: { type: 'number', minimum: 1 },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
            },
            required: ['count', 'confidence'],
            additionalProperties: false
          }
        }
      },
      required: ['inline_citations', 'evidence_map', 'citation_chips'],
      additionalProperties: false
    };

    const result = await callGeminiRest(prompt, {
      model: 'gemini-2.5-pro',
      temperature: 0.3,
      topP: 0.8,
      topK: 40,
      thinkingConfig: { thinkingBudget: 32768 },
      maxOutputTokens: 16384,
      responseMimeType: 'application/json',
      responseSchema
    });

    if (!result.success || !result.text) {
      console.error('❌ Citations sweep failed:', result.error);
      return NextResponse.json(
        { success: false, error: 'citations_sweep_failed', details: result.error },
        { status: 500 }
      );
    }

    let citationsData: {
      inline_citations: Array<{
        claim_id: string;
        claim_text: string;
        section: string;
        paragraph_index?: number;
        evidence_ids: string[];
        confidence: string;
        key_phrases?: string[];
      }>;
      evidence_map: Record<string, {
        url: string;
        title?: string;
        publisher?: string;
        date?: string;
        type: string;
        snippet: string;
        confidence: string;
      }>;
      citation_chips: Record<string, {
        count: number;
        confidence: string;
      }>;
    };

    try {
      citationsData = JSON.parse(result.text.trim());
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return NextResponse.json(
        { success: false, error: 'parse_error', details: 'Failed to parse citations data' },
        { status: 500 }
      );
    }

    // Merge citations into buyer report
    const enhancedReport = {
      ...buyerReport,
      inline_citations: citationsData.inline_citations,
      evidence_map: citationsData.evidence_map,
      citation_chips: citationsData.citation_chips,
      citations_generated_at: new Date().toISOString()
    };

    // ========================================================================
    // STEP 4: Update buyer report with citations
    // ========================================================================
    const { error: updateError } = await supabase
      .from('text_analysis_results')
      .update({ results: enhancedReport })
      .eq('id', buyerReportData.id);

    if (updateError) {
      console.error('❌ Update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'update_failed', details: updateError.message },
        { status: 500 }
      );
    }

    console.log(`✅ Citations sweep completed: ${citationsData.inline_citations.length} citations, ${Object.keys(citationsData.evidence_map).length} evidence sources`);

    return NextResponse.json({
      success: true,
      data: enhancedReport,
      stats: {
        citations_count: citationsData.inline_citations.length,
        evidence_count: Object.keys(citationsData.evidence_map).length,
        sections_with_citations: Object.keys(citationsData.citation_chips).length
      }
    });
  } catch (e: any) {
    console.error('❌ Citations sweep error:', e);
    return NextResponse.json(
      { success: false, error: e?.message || 'unknown_error' },
      { status: 500 }
    );
  }
}

/**
 * Primary source whitelist - trusted government, official agencies, and real estate authorities
 */
const PRIMARY_SOURCE_DOMAINS = [
  // Government
  '.gob.es', 'boe.es', 'boe.gob.es',
  // Municipalities and regional governments
  'ayuntamiento', 'diputacion', 'consell', 'cabildo', 'junta', 'gobierno',
  // Official real estate authorities
  'colegioarquitectos', 'colegioarquitectos.es', 'colegioingenieros', 'colegioingenieros.es',
  'notariado.org', 'registradores.org',
  // Trusted real estate market sources
  'ine.es', 'ine.gob.es', // Instituto Nacional de Estadística
  'mitma.gob.es', // Ministerio de Transportes
  'miteco.gob.es', // Ministerio de Transición Ecológica
  // Official property registries
  'registradores', 'registropropiedad',
];

/**
 * Trusted price/cost sources - for costs, market_practices categories
 */
const TRUSTED_PRICE_SOURCES = [
  'idealista', 'fotocasa', 'habitaclia', 'pisos.com', // Major real estate portals
  'tinsa', 'sociedad de tasación', // Property valuation companies
  'ine.es', 'ine.gob.es', // Official statistics
  'mitma.gob.es', // Ministry of Transport (housing data)
];

/**
 * Trusted trade/professional sources - for contractors, materials, timeline categories
 */
const TRUSTED_TRADE_SOURCES = [
  'colegioarquitectos', 'colegioingenieros', // Professional colleges
  'cscae', // Consejo Superior de Colegios de Arquitectos
  'habitatge.gencat', // Catalan housing authority
  'federacionconstructores', // Construction federation
  'anerr', // National association of energy rehabilitation
];

/**
 * Trusted market/neighborhood sources - for neighborhood, market categories
 */
const TRUSTED_MARKET_SOURCES = [
  'idealista', 'fotocasa', 'habitaclia', // Real estate portals
  'ine.es', 'ine.gob.es', // Official statistics
  'ayuntamiento', 'diputacion', // Local government data
];

/**
 * Primary source title keywords - official documents, regulations, etc.
 */
const PRIMARY_TITLE_KEYWORDS = [
  'boe', 'boletín oficial', 'ley', 'real decreto', 'orden', 'normativa',
  'reglamento', 'instrucción', 'resolución', 'decreto', 'circular',
  'colegio oficial', 'notariado', 'registro de la propiedad',
  'instituto nacional', 'ministerio', 'estadística oficial',
];

/**
 * Secondary source patterns - blogs, agency websites, etc. (domain)
 */
const SECONDARY_SOURCE_PATTERNS = [
  'blog', 'inmobiliaria', 'agencia', 'realestate', 'reforma', 'constructor',
  'arquitectura', 'decoracion', 'vivienda', 'casas', 'pisos',
];

/**
 * Secondary source title keywords - blog posts, opinion pieces, etc.
 */
const SECONDARY_TITLE_KEYWORDS = [
  'blog', 'opinión', 'opinion', 'guía', 'guia', 'consejos', 'tips',
  'cómo', 'como', 'mejores', 'top', 'ranking', 'lista',
];

/**
 * Determine if a source is primary (high credibility) based on domain, title, and category context
 */
function isPrimarySource(urlOrDomain: string, title?: string, category?: string): boolean {
  const domain = extractDomain(urlOrDomain).toLowerCase();
  
  // Check domain first
  if (PRIMARY_SOURCE_DOMAINS.some(pattern => domain.includes(pattern))) {
    // If it's a primary domain, check title to exclude blogs/opinion pieces
    if (title) {
      const titleLower = title.toLowerCase();
      // Exclude if title suggests it's a blog or opinion piece
      if (SECONDARY_TITLE_KEYWORDS.some(keyword => titleLower.includes(keyword))) {
        return false;
      }
    }
    return true;
  }
  
  // Category-specific rules: Different categories have different trusted sources
  
  // COSTS & MARKET: Trusted real estate portals and official stats are primary
  if (category === 'costs' || category === 'cost_context' || category === 'market_practices' || category === 'market') {
    if (TRUSTED_PRICE_SOURCES.some(pattern => domain.includes(pattern))) {
      return true;
    }
    if (TRUSTED_MARKET_SOURCES.some(pattern => domain.includes(pattern))) {
      return true;
    }
  }
  
  // CONTRACTORS: Professional colleges and trade associations are primary
  if (category === 'contractors') {
    if (TRUSTED_TRADE_SOURCES.some(pattern => domain.includes(pattern))) {
      return true;
    }
  }
  
  // TIMELINE/SCHEDULING: Trade sources and market data are primary
  if (category === 'timeline' || category === 'scheduling_windows' || category === 'seasonality') {
    if (TRUSTED_TRADE_SOURCES.some(pattern => domain.includes(pattern))) {
      return true;
    }
    if (TRUSTED_MARKET_SOURCES.some(pattern => domain.includes(pattern))) {
      return true;
    }
  }
  
  // NEIGHBORHOOD/ENVIRONMENT: Real estate portals and local government are primary
  if (category === 'neighborhood' || category === 'environment' || category === 'noise_environment') {
    if (TRUSTED_MARKET_SOURCES.some(pattern => domain.includes(pattern))) {
      return true;
    }
  }
  
  // LOGISTICS/ACCESS: Government and official sources only
  if (category === 'logistics_access') {
    // Already checked PRIMARY_SOURCE_DOMAINS above
    return false;
  }
  
  // WASTE MANAGEMENT: Government and official sources only
  if (category === 'waste_management') {
    // Already checked PRIMARY_SOURCE_DOMAINS above
    return false;
  }
  
  // PERMITS, LAWS, REGULATIONS, NORMS: ONLY government sources are primary (strict)
  if (category === 'permits' || category === 'laws_regulations' || category === 'norms_standards' || category === 'regulations') {
    // Already checked PRIMARY_SOURCE_DOMAINS above, so return false here
    return false;
  }
  
  // UTILITIES, ACCESSIBILITY, COMMUNITY_RULES: Government and official sources only
  if (category === 'utilities' || category === 'utilities_infrastructure' || category === 'accessibility' || category === 'community_rules') {
    // Already checked PRIMARY_SOURCE_DOMAINS above
    return false;
  }
  
  // Check title for official document keywords (even if domain isn't primary)
  if (title) {
    const titleLower = title.toLowerCase();
    if (PRIMARY_TITLE_KEYWORDS.some(keyword => titleLower.includes(keyword))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Determine if a source is secondary (lower credibility) based on domain and/or title
 */
function isSecondarySource(urlOrDomain: string, title?: string): boolean {
  const domain = extractDomain(urlOrDomain).toLowerCase();
  
  // Check domain patterns
  if (SECONDARY_SOURCE_PATTERNS.some(pattern => domain.includes(pattern))) {
    return true;
  }
  
  // Check title keywords
  if (title) {
    const titleLower = title.toLowerCase();
    if (SECONDARY_TITLE_KEYWORDS.some(keyword => titleLower.includes(keyword))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Categorize source type based on domain
 */
function categorizeSourceType(urlOrDomain: string): string {
  const domain = extractDomain(urlOrDomain).toLowerCase();
  
  if (domain.includes('.gob.es') || domain.includes('boe.es') || 
      domain.includes('ayuntamiento') || domain.includes('diputacion') ||
      domain.includes('consell') || domain.includes('cabildo')) {
    return 'Gov/Regs';
  }
  
  if (domain.includes('comunidad') || domain.includes('propietarios') ||
      domain.includes('hoa') || domain.includes('vecinos')) {
    return 'HOA';
  }
  
  if (domain.includes('idealista') || domain.includes('fotocasa') ||
      domain.includes('inmobiliaria') || domain.includes('real estate')) {
    return 'Market';
  }
  
  if (domain.includes('constructor') || domain.includes('reforma') ||
      domain.includes('arquitect') || domain.includes('ingenier')) {
    return 'Trade';
  }
  
  if (domain.includes('.edu') || domain.includes('universidad')) {
    return 'Academic';
  }
  
  if (domain.includes('diario') || domain.includes('noticia') ||
      domain.includes('news') || domain.includes('press')) {
    return 'News';
  }
  
  return 'Other';
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    if (!url) return '';
    if (!url.startsWith('http')) url = `https://${url}`;
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
}

