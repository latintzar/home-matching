/**
 * Page Classifier
 * 
 * Heuristic-based classification of HTML pages.
 * Determines: page type, transaction type, asset class.
 * NO LLM - pure pattern matching for speed and cost.
 */

import * as cheerio from 'cheerio';

// ============================================================================
// ENUMS & TYPES
// ============================================================================

export enum PageType {
  // === LISTINGS (Parse for data) ===
  LISTING_SALE = 'listing_sale',
  LISTING_RENT = 'listing_rent',
  LISTING_VACATION = 'listing_vacation',
  LISTING_COMMERCIAL = 'listing_commercial',
  LISTING_UNKNOWN = 'listing_unknown',
  
  // === LIST PAGES (Use for daily delta) ===
  LIST_SALE = 'list_sale',
  LIST_RENT = 'list_rent',
  LIST_MIXED = 'list_mixed',
  LIST_LOCATION = 'list_location',
  SEARCH_PAGE = 'search_page',
  
  // === NAVIGATION ===
  HOMEPAGE = 'homepage',
  CATEGORY_HUB = 'category_hub',
  
  // === AGENCY INFO ===
  AGENCY_ABOUT = 'agency_about',
  AGENT_PROFILE = 'agent_profile',
  CONTACT = 'contact',
  
  // === CONTENT (Skip) ===
  BLOG_POST = 'blog_post',
  NEWS_ARTICLE = 'news_article',
  
  // === UTILITY (Skip) ===
  LEGAL = 'legal',
  ERROR_404 = 'error_404',
  
  // === FALLBACK ===
  UNKNOWN = 'unknown'
}

export enum TransactionType {
  SALE = 'sale',
  RENT = 'rent',
  VACATION = 'vacation',
  TRANSFER = 'transfer',
  UNKNOWN = 'unknown'
}

export enum AssetClass {
  // === RESIDENTIAL - APARTMENTS ===
  PISO = 'piso',
  APARTAMENTO = 'apartamento',
  ATICO = 'atico',
  BAJO = 'bajo',
  DUPLEX = 'duplex',
  TRIPLEX = 'triplex',
  ESTUDIO = 'estudio',
  LOFT = 'loft',
  
  // === RESIDENTIAL - HOUSES ===
  CASA = 'casa',
  CHALET = 'chalet',
  ADOSADO = 'adosado',
  PAREADO = 'pareado',
  VILLA = 'villa',
  RUSTICA = 'rustica',
  MASIA = 'masia',
  CORTIJO = 'cortijo',
  
  // === COMMERCIAL - OFFICE ===
  OFICINA = 'oficina',
  DESPACHO = 'despacho',
  COWORKING = 'coworking',
  
  // === COMMERCIAL - RETAIL ===
  LOCAL = 'local',
  TIENDA = 'tienda',
  CENTRO_COMERCIAL = 'centro_comercial',
  
  // === COMMERCIAL - HOSPITALITY ===
  HOTEL = 'hotel',
  HOSTAL = 'hostal',
  RESTAURANTE = 'restaurante',
  BAR = 'bar',
  
  // === INDUSTRIAL / LOGISTICS ===
  NAVE = 'nave',
  LOGISTICA = 'logistica',
  ALMACEN = 'almacen',
  FABRICA = 'fabrica',
  TALLER = 'taller',
  
  // === LAND ===
  TERRENO_URBANO = 'terreno_urbano',
  TERRENO_RUSTICO = 'terreno_rustico',
  SOLAR = 'solar',
  PARCELA = 'parcela',
  FINCA = 'finca',
  
  // === PARKING / STORAGE ===
  GARAJE = 'garaje',
  PARKING = 'parking',
  TRASTERO = 'trastero',
  
  // === SPECIAL ===
  EDIFICIO = 'edificio',
  OBRA_NUEVA = 'obra_nueva',
  PROMOCION = 'promocion',
  
  // === FALLBACK ===
  UNKNOWN = 'unknown'
}

export type ActionType = 'parse' | 'delta_source' | 'store' | 'skip';

export interface ClassificationResult {
  pageType: PageType;
  transaction: TransactionType;
  assetClass: AssetClass;
  confidence: number;
  signals: string[];
  action: ActionType;
}

// ============================================================================
// PATTERN DEFINITIONS
// ============================================================================

// URL patterns for page type detection
const PAGE_TYPE_URL_PATTERNS = {
  LISTING: [
    /\/(inmueble|propiedad|vivienda|property|listing)\/\d+/i,
    /\/ref[-_]?\d+/i,
    /\/(piso|apartamento|casa|chalet|atico|duplex|estudio)[-\/]\d/i,
    /\/detalle[-_]?(inmueble|propiedad)/i,
    /\/(venta|alquiler)\/[^\/]+\/[^\/]+\/\d+/i, // venta/madrid/centro/12345
  ],
  LIST: [
    /\/(pisos|casas|propiedades|inmuebles)[-\/](en-)?(venta|alquiler)/i,
    /\/(venta|alquiler)\/(pisos|casas|propiedades)/i,
    /[?&](page|pagina|p)=\d+/i,
    /\/pagina\/\d+/i,
    /[?&](precio|habitaciones|metros|zona|tipo)/i,
    /\/(buscar|search)\//i,
    /\/resultados\//i,
  ],
  HOMEPAGE: [
    /^https?:\/\/[^\/]+\/?$/,
  ],
  BLOG: [
    /\/blog\//i,
    /\/noticias\//i,
    /\/articulo\//i,
    /\/posts?\//i,
  ],
  LEGAL: [
    /\/(privacidad|privacy|legal|cookies|aviso-legal|terms|condiciones)/i,
  ],
  CONTACT: [
    /\/contacto?\/?$/i,
    /\/contact\/?$/i,
  ],
  ABOUT: [
    /\/(nosotros|about|quienes-somos|sobre-nosotros|equipo|team)\/?$/i,
  ],
};

// URL patterns for transaction type
const TRANSACTION_URL_PATTERNS = {
  SALE: [/\/(venta|en-venta|comprar|buy|for-sale|compra)/i],
  RENT: [/\/(alquiler|en-alquiler|rent|rental|arrendar)/i],
  VACATION: [/\/(vacacion|holiday|temporada|turistico|vacation)/i],
  TRANSFER: [/\/(traspaso|transfer)/i],
};

// URL patterns for asset class
const ASSET_CLASS_URL_PATTERNS = {
  // Residential - Apartments
  PISO: [/\/piso[s]?[-\/]/i, /\/flat/i],
  APARTAMENTO: [/\/apartamento/i, /\/apartment/i],
  ATICO: [/\/atico/i, /\/ático/i, /\/penthouse/i],
  DUPLEX: [/\/duplex/i, /\/dúplex/i],
  ESTUDIO: [/\/estudio/i, /\/studio/i],
  LOFT: [/\/loft/i],
  
  // Residential - Houses
  CASA: [/\/casa[s]?[-\/]/i, /\/vivienda/i, /\/house/i],
  CHALET: [/\/chalet/i, /\/villa/i, /\/detached/i],
  ADOSADO: [/\/adosado/i, /\/townhouse/i, /\/terraced/i],
  PAREADO: [/\/pareado/i, /\/semi[-]?detached/i],
  
  // Commercial - Office
  OFICINA: [/\/oficina/i, /\/office/i, /\/despacho/i],
  COWORKING: [/\/coworking/i, /\/co-working/i],
  
  // Commercial - Retail
  LOCAL: [/\/local[-_]?comercial/i, /\/local[-\/]/i, /\/retail/i],
  TIENDA: [/\/tienda/i, /\/shop/i],
  
  // Hospitality
  HOTEL: [/\/hotel/i],
  HOSTAL: [/\/hostal/i, /\/hostel/i, /\/pension/i],
  RESTAURANTE: [/\/restaurante/i, /\/restaurant/i],
  BAR: [/\/bar[-\/]/i, /\/pub/i],
  
  // Industrial
  NAVE: [/\/nave[-_]?(industrial)?/i, /\/warehouse/i],
  LOGISTICA: [/\/logistic/i, /\/logistics/i],
  ALMACEN: [/\/almacen/i, /\/storage/i],
  TALLER: [/\/taller/i, /\/workshop/i],
  
  // Land
  TERRENO: [/\/terreno/i, /\/land[-\/]/i],
  SOLAR: [/\/solar[-\/]/i, /\/plot/i],
  PARCELA: [/\/parcela/i],
  FINCA: [/\/finca/i, /\/estate/i],
  
  // Parking
  GARAJE: [/\/garaje/i, /\/garage/i, /\/parking/i, /\/plaza[-_]garaje/i],
  TRASTERO: [/\/trastero/i, /\/storage[-_]unit/i],
  
  // Building
  EDIFICIO: [/\/edificio/i, /\/building/i],
};

// Content patterns for transaction detection
const TRANSACTION_CONTENT_PATTERNS = {
  RENT: [
    /€\s*\/\s*mes/i,
    /€\/mes/i,
    /mensual/i,
    /al\s+mes/i,
    /month/i,
    /\/\s*mes/i,
    /fianza/i,
    /depósito/i,
  ],
  VACATION: [
    /€\s*\/\s*(día|noche|semana)/i,
    /por\s+noche/i,
    /estancia\s+mínima/i,
    /disponibilidad/i,
  ],
};

// Content patterns for asset class detection
const ASSET_CLASS_CONTENT_PATTERNS = {
  RESIDENTIAL: [
    /\d+\s*habitacion/i, /\d+\s*dormitorio/i, /\d+\s*bedroom/i,
    /\d+\s*baño/i, /\d+\s*bathroom/i,
    /cocina/i, /salón/i, /terraza/i, /balcón/i,
  ],
  OFICINA: [
    /puesto[s]?\s+de\s+trabajo/i, /workstation/i,
    /sala[s]?\s+de\s+reuniones/i, /meeting\s+room/i,
    /open\s*space/i, /diáfan[ao]/i,
  ],
  LOCAL: [
    /escaparate/i, /shop\s*window/i,
    /fachada\s+comercial/i,
    /licencia\s+de\s+actividad/i,
  ],
  NAVE: [
    /altura\s+libre/i, /clear\s+height/i,
    /muelle[s]?\s+de\s+carga/i, /loading\s+dock/i,
    /puerta[s]?\s+TIR/i,
    /polígono\s+industrial/i,
  ],
  TERRENO: [
    /edificabilidad/i, /buildability/i,
    /urbanizable/i,
    /calificación\s+urban/i,
    /rústic[ao]/i,
  ],
};

// ============================================================================
// CLASSIFIER IMPLEMENTATION
// ============================================================================

/**
 * Classify a page based on URL and HTML content
 */
export function classifyPage(url: string, html: string): ClassificationResult {
  const scores: Record<string, number> = {};
  const signals: string[] = [];
  
  const $ = cheerio.load(html);
  const title = $('title').text().toLowerCase();
  const bodyText = $('body').text().toLowerCase();
  
  // =========================================================================
  // STEP 1: Determine Page Type
  // =========================================================================
  
  let pageType = PageType.UNKNOWN;
  let pageTypeScore = 0;
  
  // Check URL patterns for page type
  for (const [type, patterns] of Object.entries(PAGE_TYPE_URL_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(url)) {
        const score = type === 'LISTING' ? 80 : type === 'LIST' ? 70 : 50;
        if (score > pageTypeScore) {
          pageTypeScore = score;
          signals.push(`url:${type.toLowerCase()}`);
        }
        scores[type] = (scores[type] || 0) + score;
      }
    }
  }
  
  // Check for schema.org markup
  if (html.includes('RealEstateListing') || html.includes('schema.org/Product')) {
    scores['LISTING'] = (scores['LISTING'] || 0) + 90;
    signals.push('schema:real_estate_listing');
  }
  if (html.includes('schema.org/ItemList') || html.includes('schema.org/SearchResultsPage')) {
    scores['LIST'] = (scores['LIST'] || 0) + 80;
    signals.push('schema:item_list');
  }
  if (html.includes('schema.org/Article') || html.includes('schema.org/BlogPosting')) {
    scores['BLOG'] = (scores['BLOG'] || 0) + 80;
    signals.push('schema:article');
  }
  
  // Check page structure
  const propertyCardSelectors = [
    '.property-card', '.listing-card', '.inmueble-card',
    '[class*="property"]', '[class*="listing"]', '[class*="result-item"]',
    '.card-inmueble', '.ficha-inmueble', '.resultado'
  ];
  const cardCount = $(propertyCardSelectors.join(',')).length;
  
  if (cardCount >= 5) {
    scores['LIST'] = (scores['LIST'] || 0) + 60;
    signals.push(`structure:${cardCount}_property_cards`);
  } else if (cardCount === 1) {
    scores['LISTING'] = (scores['LISTING'] || 0) + 20;
    signals.push('structure:single_property_card');
  }
  
  // Check for image gallery (listing indicator)
  const gallerySelectors = [
    '.gallery img', '.slider img', '.carousel img',
    '[class*="gallery"] img', '[class*="photo"] img',
    '.fotos img', '.imagenes img'
  ];
  const imageCount = $(gallerySelectors.join(',')).length;
  if (imageCount >= 5) {
    scores['LISTING'] = (scores['LISTING'] || 0) + 50;
    signals.push(`structure:${imageCount}_gallery_images`);
  }
  
  // Check for filter panel (list page indicator)
  const filterSelectors = [
    'select[name*="precio"]', 'select[name*="habitacion"]',
    'select[name*="tipo"]', 'select[name*="zona"]',
    '[class*="filter"]', '[class*="filtro"]',
    'input[type="range"]', '.price-slider'
  ];
  const filterCount = $(filterSelectors.join(',')).length;
  if (filterCount >= 3) {
    scores['LIST'] = (scores['LIST'] || 0) + 70;
    signals.push('structure:filter_panel');
  }
  
  // Check title for indicators
  if (/\d+\s*(€|EUR|euros)/i.test(title)) {
    scores['LISTING'] = (scores['LISTING'] || 0) + 40;
    signals.push('title:has_price');
  }
  if (/resultados|encontrados|\d+\s+(pisos|propiedades)/i.test(title)) {
    scores['LIST'] = (scores['LIST'] || 0) + 60;
    signals.push('title:results_indicator');
  }
  if (/404|not found|página no encontrada|error/i.test(title)) {
    scores['ERROR_404'] = (scores['ERROR_404'] || 0) + 90;
    signals.push('title:error_404');
  }
  
  // Count prices in body
  const priceMatches = bodyText.match(/\d{1,3}([.,]\d{3})*\s*(€|EUR|euros)/gi) || [];
  if (priceMatches.length === 1) {
    scores['LISTING'] = (scores['LISTING'] || 0) + 40;
    signals.push('content:single_price');
  } else if (priceMatches.length >= 5) {
    scores['LIST'] = (scores['LIST'] || 0) + 50;
    signals.push(`content:${priceMatches.length}_prices`);
  }
  
  // Check for reference number
  if (/ref(erencia)?[:\s#]*\d+/i.test(bodyText)) {
    scores['LISTING'] = (scores['LISTING'] || 0) + 35;
    signals.push('content:reference_number');
  }
  
  // Determine winning page type
  const pageTypeMap: Record<string, PageType> = {
    'LISTING': PageType.LISTING_UNKNOWN,
    'LIST': PageType.LIST_MIXED,
    'HOMEPAGE': PageType.HOMEPAGE,
    'BLOG': PageType.BLOG_POST,
    'LEGAL': PageType.LEGAL,
    'CONTACT': PageType.CONTACT,
    'ABOUT': PageType.AGENCY_ABOUT,
    'ERROR_404': PageType.ERROR_404,
  };
  
  let maxScore = 0;
  let maxType = 'UNKNOWN';
  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxType = type;
    }
  }
  pageType = pageTypeMap[maxType] || PageType.UNKNOWN;
  
  // =========================================================================
  // STEP 2: Determine Transaction Type
  // =========================================================================
  
  let transaction = TransactionType.UNKNOWN;
  
  // Check URL
  for (const [type, patterns] of Object.entries(TRANSACTION_URL_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(url)) {
        transaction = type as TransactionType;
        signals.push(`url:${type.toLowerCase()}`);
        break;
      }
    }
    if (transaction !== TransactionType.UNKNOWN) break;
  }
  
  // Check content patterns if still unknown
  if (transaction === TransactionType.UNKNOWN) {
    for (const pattern of TRANSACTION_CONTENT_PATTERNS.RENT) {
      if (pattern.test(bodyText)) {
        transaction = TransactionType.RENT;
        signals.push('content:rent_indicator');
        break;
      }
    }
  }
  if (transaction === TransactionType.UNKNOWN) {
    for (const pattern of TRANSACTION_CONTENT_PATTERNS.VACATION) {
      if (pattern.test(bodyText)) {
        transaction = TransactionType.VACATION;
        signals.push('content:vacation_indicator');
        break;
      }
    }
  }
  
  // High price without /mes indicator = likely sale
  if (transaction === TransactionType.UNKNOWN && priceMatches.length > 0) {
    const hasHighPrice = priceMatches.some(p => {
      const num = parseInt(p.replace(/[^\d]/g, ''));
      return num > 50000;
    });
    if (hasHighPrice && !/\/\s*mes|mensual/i.test(bodyText)) {
      transaction = TransactionType.SALE;
      signals.push('content:high_price_no_monthly');
    }
  }
  
  // Refine page type based on transaction
  if (pageType === PageType.LISTING_UNKNOWN) {
    if (transaction === TransactionType.SALE) pageType = PageType.LISTING_SALE;
    else if (transaction === TransactionType.RENT) pageType = PageType.LISTING_RENT;
    else if (transaction === TransactionType.VACATION) pageType = PageType.LISTING_VACATION;
  }
  if (pageType === PageType.LIST_MIXED) {
    if (transaction === TransactionType.SALE) pageType = PageType.LIST_SALE;
    else if (transaction === TransactionType.RENT) pageType = PageType.LIST_RENT;
  }
  
  // =========================================================================
  // STEP 3: Determine Asset Class
  // =========================================================================
  
  let assetClass = AssetClass.UNKNOWN;
  
  // Check URL patterns
  for (const [type, patterns] of Object.entries(ASSET_CLASS_URL_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(url)) {
        assetClass = type as AssetClass;
        signals.push(`url:asset_${type.toLowerCase()}`);
        break;
      }
    }
    if (assetClass !== AssetClass.UNKNOWN) break;
  }
  
  // Check content patterns if still unknown
  if (assetClass === AssetClass.UNKNOWN) {
    // Check for residential signals
    const residentialMatches = ASSET_CLASS_CONTENT_PATTERNS.RESIDENTIAL.filter(p => p.test(bodyText)).length;
    if (residentialMatches >= 3) {
      assetClass = AssetClass.PISO; // Default residential
      signals.push('content:residential_signals');
    }
    
    // Check for office signals
    const officeMatches = ASSET_CLASS_CONTENT_PATTERNS.OFICINA.filter(p => p.test(bodyText)).length;
    if (officeMatches >= 2) {
      assetClass = AssetClass.OFICINA;
      signals.push('content:office_signals');
    }
    
    // Check for retail signals
    const retailMatches = ASSET_CLASS_CONTENT_PATTERNS.LOCAL.filter(p => p.test(bodyText)).length;
    if (retailMatches >= 2) {
      assetClass = AssetClass.LOCAL;
      signals.push('content:retail_signals');
    }
    
    // Check for industrial signals
    const industrialMatches = ASSET_CLASS_CONTENT_PATTERNS.NAVE.filter(p => p.test(bodyText)).length;
    if (industrialMatches >= 2) {
      assetClass = AssetClass.NAVE;
      signals.push('content:industrial_signals');
    }
    
    // Check for land signals
    const landMatches = ASSET_CLASS_CONTENT_PATTERNS.TERRENO.filter(p => p.test(bodyText)).length;
    if (landMatches >= 2) {
      assetClass = AssetClass.TERRENO_URBANO;
      signals.push('content:land_signals');
    }
  }
  
  // =========================================================================
  // STEP 4: Determine Action
  // =========================================================================
  
  let action: ActionType = 'skip';
  
  if (pageType.startsWith('listing_')) {
    action = 'parse';
  } else if (pageType.startsWith('list_') || pageType === PageType.SEARCH_PAGE) {
    action = 'delta_source';
  } else if (pageType === PageType.HOMEPAGE || pageType === PageType.CATEGORY_HUB) {
    action = 'store';
  }
  
  // =========================================================================
  // RETURN RESULT
  // =========================================================================
  
  const confidence = Math.min(maxScore / 150, 1);
  
  return {
    pageType,
    transaction,
    assetClass,
    confidence,
    signals,
    action,
  };
}

/**
 * Quick classification from URL only (for filtering before download)
 */
export function quickClassifyUrl(url: string): { likelyListing: boolean; likelyList: boolean; likelyJunk: boolean } {
  const likelyListing = PAGE_TYPE_URL_PATTERNS.LISTING.some(p => p.test(url));
  const likelyList = PAGE_TYPE_URL_PATTERNS.LIST.some(p => p.test(url));
  const likelyJunk = PAGE_TYPE_URL_PATTERNS.BLOG.some(p => p.test(url)) ||
                     PAGE_TYPE_URL_PATTERNS.LEGAL.some(p => p.test(url));
  
  return { likelyListing, likelyList, likelyJunk };
}

// CLI for testing
if (require.main === module) {
  const testUrl = process.argv[2];
  const testHtml = process.argv[3] || '<html><head><title>Test</title></head><body>Test content</body></html>';
  
  if (!testUrl) {
    console.log('Usage: npx tsx page-classifier.ts <url> [html]');
    console.log('\nQuick test with sample URLs:');
    
    const sampleUrls = [
      'https://example.es/piso-en-venta-madrid-123',
      'https://example.es/pisos-en-alquiler-barcelona?page=2',
      'https://example.es/blog/consejos-comprar-casa',
      'https://example.es/oficina-alquiler-centro',
      'https://example.es/nave-industrial-poligono-456',
    ];
    
    for (const url of sampleUrls) {
      const quick = quickClassifyUrl(url);
      console.log(`\n${url}`);
      console.log(`  Likely listing: ${quick.likelyListing}`);
      console.log(`  Likely list: ${quick.likelyList}`);
      console.log(`  Likely junk: ${quick.likelyJunk}`);
    }
  } else {
    const result = classifyPage(testUrl, testHtml);
    console.log('\nClassification Result:');
    console.log(JSON.stringify(result, null, 2));
  }
}

