/**
 * HTML Compressor for LLM Context
 * 
 * Compresses HTML to ~5K tokens while preserving:
 * - All script tags (JSON-LD, data)
 * - Key structural elements
 * - Text content
 */

import * as cheerio from 'cheerio';

// Target ~5000 tokens ≈ 20,000 characters (roughly 4 chars per token)
const TARGET_CHARS = 20000;

/**
 * Compress HTML for LLM context
 * Preserves structured data (JSON-LD) and key content
 */
export function compressHtmlForLLM(html: string): string {
  if (!html || html.length < TARGET_CHARS) {
    return html;
  }

  const $ = cheerio.load(html);

  // 1. Remove obviously unnecessary elements
  $('noscript').remove();
  $('iframe').remove();
  $('svg').remove();
  $('style').remove();
  $('link[rel="stylesheet"]').remove();
  $('meta[name="viewport"]').remove();
  $('meta[http-equiv]').remove();

  // 2. Remove tracking/analytics scripts but KEEP data scripts
  $('script').each((_, el) => {
    const src = $(el).attr('src') || '';
    const type = $(el).attr('type') || '';
    const content = $(el).html() || '';

    // Keep JSON-LD
    if (type === 'application/ld+json') return;

    // Keep inline scripts with data (lat/lng, gallery, etc.)
    if (!src && (
      content.includes('latitude') ||
      content.includes('longitude') ||
      content.includes('gallery') ||
      content.includes('photos') ||
      content.includes('images') ||
      content.includes('LatLng') ||
      content.includes('precio') ||
      content.includes('price')
    )) {
      return;
    }

    // Remove external scripts and tracking
    if (src.includes('analytics') ||
        src.includes('gtag') ||
        src.includes('facebook') ||
        src.includes('twitter') ||
        src.includes('hotjar') ||
        src.includes('cookie')) {
      $(el).remove();
    }
  });

  // 3. Remove comments
  $('*').contents().filter(function() {
    return this.type === 'comment';
  }).remove();

  // 4. Remove empty elements
  $('div:empty, span:empty, p:empty').remove();

  // 5. Simplify attributes - keep only data-* and essential ones
  $('*').each((_, el) => {
    const $el = $(el);
    const tagName = el.tagName?.toLowerCase();
    
    const attribs = el.attribs || {};
    for (const attr of Object.keys(attribs)) {
      // Keep these
      if (attr === 'class' || 
          attr === 'id' || 
          attr === 'href' || 
          attr === 'src' ||
          attr === 'data-src' ||
          attr === 'alt' ||
          attr === 'type' ||
          attr.startsWith('data-')) {
        continue;
      }
      // Remove the rest
      $el.removeAttr(attr);
    }
  });

  // 6. Truncate very long text content
  $('*').each((_, el) => {
    const $el = $(el);
    if ($el.children().length === 0) {
      const text = $el.text();
      if (text.length > 500) {
        $el.text(text.substring(0, 500) + '...');
      }
    }
  });

  // 7. Get the result
  let result = $.html();

  // 8. If still too long, do aggressive truncation
  if (result.length > TARGET_CHARS) {
    // Extract and preserve important sections
    const head = $('head').html() || '';
    const scripts = $('script').map((_, el) => $.html(el)).get().join('\n');
    
    // Find main content area
    const mainContent = $('main, article, .property, .listing, .ficha, .detalle, [class*="detail"], [class*="property"]')
      .first()
      .html();

    // Build compressed version
    const parts = [];
    
    // Add minimal head
    parts.push('<head>');
    parts.push($('title').prop('outerHTML') || '');
    parts.push(scripts.substring(0, 5000)); // Keep some scripts
    parts.push('</head>');

    // Add body with main content
    parts.push('<body>');
    if (mainContent && mainContent.length < TARGET_CHARS - 5000) {
      parts.push(mainContent);
    } else {
      // Just take first chunk of body
      parts.push($('body').html()?.substring(0, TARGET_CHARS - 5000) || '');
    }
    parts.push('</body>');

    result = parts.join('\n');
  }

  // 9. Final cleanup - remove excess whitespace
  result = result
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/>\s+</g, '>\n<')
    .trim();

  // 10. Final truncation if needed
  if (result.length > TARGET_CHARS) {
    result = result.substring(0, TARGET_CHARS) + '\n<!-- truncated -->';
  }

  return result;
}

/**
 * Extract just the key data-bearing elements for validation
 * Even more aggressive compression for validation context
 */
export function extractKeyElements(html: string): string {
  const $ = cheerio.load(html);

  const keyElements: string[] = [];

  // 1. All JSON-LD
  $('script[type="application/ld+json"]').each((_, el) => {
    keyElements.push($.html(el));
  });

  // 2. Scripts with data patterns
  $('script:not([src])').each((_, el) => {
    const content = $(el).html() || '';
    if (content.includes('latitude') ||
        content.includes('longitude') ||
        content.includes('gallery') ||
        content.includes('precio') ||
        content.includes('price')) {
      // Truncate if too long
      const truncated = content.length > 3000 
        ? content.substring(0, 3000) + '...' 
        : content;
      keyElements.push(`<script>${truncated}</script>`);
    }
  });

  // 3. Price elements
  $('[class*="precio"], [class*="price"], [data-price]').each((_, el) => {
    keyElements.push($.html(el));
  });

  // 4. Location/address elements
  $('[class*="ubicacion"], [class*="location"], [class*="address"], [class*="direccion"]').each((_, el) => {
    keyElements.push($.html(el));
  });

  // 5. Property details
  $('[class*="caracteristicas"], [class*="features"], [class*="details"], [class*="info"]').slice(0, 3).each((_, el) => {
    keyElements.push($.html(el));
  });

  // 6. Gallery/photos
  $('[class*="galeria"], [class*="gallery"], [class*="carousel"], [class*="slider"]').slice(0, 1).each((_, el) => {
    const $el = $(el);
    // Just get the img tags
    const imgs = $el.find('img').slice(0, 5).map((_, img) => $.html(img)).get().join('\n');
    keyElements.push(`<div class="gallery-extract">${imgs}</div>`);
  });

  // 7. Title
  const title = $('title').text() || $('h1').first().text() || '';
  if (title) {
    keyElements.push(`<title>${title}</title>`);
  }

  const result = keyElements.join('\n\n');
  
  // Truncate if still too long
  if (result.length > 10000) {
    return result.substring(0, 10000) + '\n<!-- truncated -->';
  }

  return result;
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for mixed HTML/text
  return Math.ceil(text.length / 4);
}

