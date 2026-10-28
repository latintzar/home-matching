/**
 * Cheerio Parser (Student)
 * 
 * Fast HTML parsing using CSS selectors.
 * Uses learned selectors from DynamoDB scraping_rules table.
 */

import * as cheerio from 'cheerio';
import { ScrapingRule, ParsedListing } from './types';

/**
 * Parse HTML using Cheerio with learned selectors
 */
export function parseWithCheerio(
  html: string,
  url: string,
  domain: string,
  rule: ScrapingRule
): Partial<ParsedListing> {
  const $ = cheerio.load(html);
  const selectors = rule.selectors;
  
  const result: Partial<ParsedListing> = {
    url,
    domain,
    parse_method: 'cheerio',
  };
  
  // Extract each field using selectors
  if (selectors.title) {
    result.title = $(selectors.title).first().text().trim() || undefined;
  }
  
  if (selectors.price) {
    const priceText = $(selectors.price).first().text().trim();
    result.price_raw = priceText;
    result.price_eur = extractPrice(priceText);
  }
  
  if (selectors.sqm) {
    const sqmText = $(selectors.sqm).first().text().trim();
    result.sqm = extractNumber(sqmText);
  }
  
  if (selectors.bedrooms) {
    const bedsText = $(selectors.bedrooms).first().text().trim();
    result.bedrooms = extractNumber(bedsText);
  }
  
  if (selectors.bathrooms) {
    const bathsText = $(selectors.bathrooms).first().text().trim();
    result.bathrooms = extractNumber(bathsText);
  }
  
  if (selectors.description) {
    result.description = $(selectors.description).first().text().trim() || undefined;
  }
  
  if (selectors.address) {
    result.address = $(selectors.address).first().text().trim() || undefined;
  }
  
  if (selectors.features) {
    const features: string[] = [];
    $(selectors.features).each((_, el) => {
      const text = $(el).text().trim();
      if (text) features.push(text);
    });
    if (features.length > 0) result.features = features;
  }
  
  if (selectors.photos) {
    const photos: string[] = [];
    $(selectors.photos).each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy');
      if (src && src.startsWith('http')) {
        photos.push(src);
      }
    });
    if (photos.length > 0) result.photo_urls = photos;
  }
  
  // Calculate confidence based on fields extracted
  const fieldsExtracted = [
    result.title,
    result.price_eur,
    result.sqm,
    result.bedrooms,
    result.description,
  ].filter(Boolean).length;
  
  result.confidence = Math.min(fieldsExtracted / 5, 1);
  
  return result;
}

/**
 * Extract price from text
 */
function extractPrice(text: string): number | undefined {
  if (!text) return undefined;
  
  // Remove currency symbols and separators
  const cleaned = text
    .replace(/[€$£]/g, '')
    .replace(/\./g, '')  // Spanish thousands separator
    .replace(/,/g, '.')  // Decimal separator
    .replace(/[^\d.]/g, '');
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

/**
 * Extract number from text
 */
function extractNumber(text: string): number | undefined {
  if (!text) return undefined;
  
  const match = text.match(/[\d,.]+/);
  if (!match) return undefined;
  
  const num = parseFloat(match[0].replace(',', '.'));
  return isNaN(num) ? undefined : Math.round(num);
}

/**
 * Validate parsed result has minimum required fields
 */
export function validateParsedResult(result: Partial<ParsedListing>): boolean {
  // Minimum: must have at least title OR price OR description
  return Boolean(result.title || result.price_eur || result.description);
}

/**
 * Extract potential selectors from HTML structure (fallback)
 */
export function suggestSelectors(html: string): Partial<ScrapingRule['selectors']> {
  const $ = cheerio.load(html);
  const suggestions: Partial<ScrapingRule['selectors']> = {};
  
  // Common price patterns
  const pricePatterns = [
    '.price', '.precio', '.property-price', '[class*="price"]',
    '.listing-price', '.amount', '[data-price]'
  ];
  for (const pattern of pricePatterns) {
    if ($(pattern).length > 0) {
      suggestions.price = pattern;
      break;
    }
  }
  
  // Common title patterns
  const titlePatterns = [
    'h1', '.title', '.property-title', '[class*="title"]',
    '.listing-title', '.headline'
  ];
  for (const pattern of titlePatterns) {
    const el = $(pattern).first();
    if (el.length > 0 && el.text().trim().length > 10) {
      suggestions.title = pattern;
      break;
    }
  }
  
  // Common description patterns
  const descPatterns = [
    '.description', '.property-description', '[class*="description"]',
    '.details', '.listing-description', '.comentario'
  ];
  for (const pattern of descPatterns) {
    if ($(pattern).length > 0) {
      suggestions.description = pattern;
      break;
    }
  }
  
  // Photo patterns
  const photoPatterns = [
    '.gallery img', '.photos img', '[class*="gallery"] img',
    '.slider img', '.carousel img', '[class*="photo"] img'
  ];
  for (const pattern of photoPatterns) {
    if ($(pattern).length > 0) {
      suggestions.photos = pattern;
      break;
    }
  }
  
  return suggestions;
}

