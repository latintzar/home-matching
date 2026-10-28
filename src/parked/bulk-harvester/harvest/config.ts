/**
 * Harvest Configuration
 * 
 * Central configuration for the Leo Harvest system.
 */

export const HARVEST_CONFIG = {
  // AWS Resources
  aws: {
    region: 'us-east-1',
    s3Bucket: 'puedo-casa-html-archive',
    snsTopicArn: (process.env.SNS_TOPIC_ARN || ''),
    dynamodb: {
      urlsTable: 'leo-urls',
      crawlStatusTable: 'leo-crawl-status',
      deltaSourcesTable: 'leo-delta-sources',
      listingsTable: 'leo-listings',
      scrapingRulesTable: 'leo-scraping-rules',
    },
    nominatim: {
      instanceId: 'i-0890cad762bc0c8c7',
      // URL will be set after instance starts (Elastic IP or current public IP)
      baseUrl: process.env.NOMINATIM_URL || '',
    },
  },

  // Crawling limits
  limits: {
    maxPagesPerDomain: Infinity,       // No limit - crawl everything
    pagesWithNoNewUrlsLimit: 50,       // Stop if 50 pages yield no new URLs
    requestTimeoutMs: 30000,           // 30 second timeout per request
    concurrentRequests: 10,            // Parallel requests per domain
    delayBetweenBatchesMs: 100,        // Rate limiting
    lambdaConcurrency: 400,            // Max concurrent Lambda invocations
  },
  
  // Email alerts
  alerts: {
    email: 'operator@example.invalid',
  },

  // Sitemap filtering
  sitemap: {
    maxAgeMonths: 6,                   // Only URLs modified in last 6 months
    maxUrlsPerSitemap: 100000,          // High limit - we filter by blocklist instead
  },

  // URL patterns - COMPREHENSIVE BLOCKLIST
  // Keep in sync with cleanup-urls.ts and sitemap-harvest.ts
  blocklist: [
    // === BLOGS & NEWS (HIGH VOLUME) ===
    /\/blog/i,
    /\/noticias/i,
    /\/noticia\//i,  // Added - was missing!
    /\/news/i,
    /\/articulo/i,
    /\/article/i,
    /\/posts?\//i,
    
    // === WORDPRESS SYSTEM FILES (HIGH VOLUME) ===
    /\/wp-content/i,
    /\/wp-includes/i,
    /\/wp-admin/i,
    /\/admin\//i,
    
    // === TAXONOMY PAGES (HIGH VOLUME) ===
    /\/tag\//i,
    /\/tags\//i,
    /\/category/i,
    /\/categoria/i,
    /\/author/i,
    /\/autor/i,
    
    // === AUTH PAGES ===
    /\/login/i,
    /\/registro/i,
    /\/register/i,
    /\/signin/i,
    /\/signup/i,
    
    // === FEEDS & STATIC ASSETS ===
    /\/feed\/?$/i,
    /\/rss/i,
    /\.(jpg|jpeg|png|gif|pdf|css|js|xml|ico|svg|woff|woff2|ttf|eot)$/i,
    
    // === CONTACT & ABOUT (not listings) ===
    /\/contacto?\/?$/i,
    /\/contact\/?$/i,
    /\/about\/?$/i,
    /\/nosotros\/?$/i,
    /\/quienes-somos/i,
    /\/sobre-nosotros/i,
    /\/equipo\/?$/i,
    /\/team\/?$/i,
    
    // === LEGAL ===
    /\/privacy/i,
    /\/privacidad/i,
    /\/legal\/?$/i,
    /\/cookies/i,
    /\/aviso-legal/i,
    /\/terms/i,
    /\/condiciones/i,
    
    // === SEARCH & SITEMAP ===
    /\/search\/?$/i,
    /\/buscar\/?$/i,
    /\/sitemap/i,
    
    // === FAQ & HELP ===
    /\/faq/i,
    /\/help\/?$/i,
    /\/ayuda/i,
    
    // === AGENT PROFILES (not listings) ===
    /\/real-estate-agent\//i,
    /\/agente\//i,
    /\/agent\//i,
    /\/agents\/?$/i,
    /\/agentes\/?$/i,
    
    // === 🎰 GAMBLING SPAM (HIGH PRIORITY - in real estate sitemaps!) ===
    /\/tragaperras/i,
    /\/apuestas/i,
    /\/casino/i,
    /\/slots/i,
    /\/poker/i,
    /\/ruleta/i,
    /\/blackjack/i,
    /\/jackpot/i,
    /gunsbet/i,
    /content_id=.*[A-Z]{4,}/i,  // laoliva.es spam pattern
    
    // === SERVICES (not listings) ===
    /\/servicios\/?$/i,
    /\/services\/?$/i,
    /\/valoracion/i,
    /\/tasacion/i,
    
    // === PROPERTY TAXONOMY (not actual listings) ===
    /\/property_features/i,
    /\/property_types/i,
    /\/property-type/i,
    
    // === PUBLISH/SUBMIT ===
    /\/publica/i,
    /\/publicar/i,
    /\/submit/i,
    /\/anunciar/i,
    
    // === NEWSLETTER/SOCIAL ===
    /\/newsletter/i,
    /\/subscribe/i,
    /\/suscribir/i,
    
    // === CAREERS ===
    /\/careers/i,
    /\/empleo/i,
    /\/trabaja/i,
    /\/jobs/i,
  ],

  // User agent
  userAgent: 'Mozilla/5.0 (compatible; LeoBot/2.0; +https://leo.casa)',

  // Phased testing
  testPhases: {
    phase1: 10,     // Test with 10 domains
    phase2: 100,    // Test with 100 domains
    phase3: 1000,   // Test with 1000 domains
    phase4: 'all',  // Full harvest
  },
};

export type CrawlStatus = 
  | 'pending' 
  | 'in_progress' 
  | 'complete' 
  | 'truncated' 
  | 'failed';

export type UrlStatus = 
  | 'pending' 
  | 'downloaded' 
  | 'failed';

export interface UrlRecord {
  url: string;
  domain: string;
  source: 'sitemap' | 'spider';
  status: UrlStatus;
  lastModified?: string;
  discoveredAt: string;
  downloadedAt?: string;
  s3Key?: string;
  error?: string;
}

export interface CrawlStatusRecord {
  domain: string;
  type: 'sitemap' | 'spider';
  status: CrawlStatus;
  pagesCrawled: number;
  listingsFound: number;
  hitPageLimit: boolean;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export function shouldSkipUrl(url: string): boolean {
  return HARVEST_CONFIG.blocklist.some(pattern => pattern.test(url));
}

export function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

