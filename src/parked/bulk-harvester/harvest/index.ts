/**
 * Leo Harvest System
 * 
 * Complete web crawling and HTML archiving system.
 * 
 * SETUP:
 *   npx tsx src/harvest/setup-aws.ts
 * 
 * PHASE 0: Cleanup existing URLs
 *   npx tsx src/harvest/cleanup-urls-with-log.ts
 * 
 * PHASE 2A: Download sitemapped URLs
 *   npx tsx src/harvest/sitemap-html-downloader.ts --all
 * 
 * PHASE 2B: Spider non-sitemapped domains
 *   npx tsx src/harvest/spider-orchestrator.ts --all
 * 
 * PHASE 3: Classify all downloaded pages
 *   npx tsx src/harvest/classify-downloaded.ts --all
 *   npx tsx src/harvest/promote-delta-sources.ts
 *   npx tsx src/harvest/cleanup-junk.ts
 */

// Phase 1: Infrastructure
export * from './config';
export * from './alerts';
export * from './url-canonicalizer';
export * from './page-classifier';

// Phase 2: Harvest
export * from './sitemap-mapper';
export * from './spider-crawler';
export { 
  downloadDomainUrls, 
  orchestrateSitemapDownload, 
  handler as sitemapDownloadHandler,
  type DownloadResult 
} from './sitemap-html-downloader';
export { 
  orchestrateSpiderCrawl, 
  handler as spiderHandler 
} from './spider-orchestrator';

// Phase 3: Classification
export * from './classify-downloaded';
export * from './promote-delta-sources';
export * from './cleanup-junk';

// Legacy
export * from './orchestrator';

