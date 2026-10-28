import * as cheerio from 'cheerio';
import { PARSING_RULES, Parsers } from '@/lib/extraction/rules';

/**
 * Shared Idealista Parsing Logic (Server-Side Cheerio Adapter)
 * Uses src/lib/extraction/rules.ts logic but applies it via Cheerio
 */
export function parseIdealistaHtml(htmlContent: string) {
  const $ = cheerio.load(htmlContent);
  const detailContent = $('.detail-content-wrapper').clone();
  const $root = cheerio.load(htmlContent);
  const $clean = cheerio.load(detailContent.html() || '');

  const rules = PARSING_RULES.idealista;

  // Helper to find text from selectors using Cheerio
  const getText = (selectors: string[]) => {
    for (const sel of selectors) {
      // Try clean context first, then root
      const el = $clean(sel).first();
      if (el.length) return el.text();
      
      const elRoot = $root(sel).first();
      if (elRoot.length) return elRoot.text();
    }
    return null;
  };

  // 1. Basic Info
  const titleRaw = getText(rules.title.selectors);
  const locationRaw = getText(rules.location.selectors);
  
  const titleClean = Parsers.cleanText(titleRaw);
  const locationClean = Parsers.cleanText(locationRaw);
  
  // Use Shared Cleaning Logic
  const specificPart = Parsers.cleanAddress(titleClean);
  const address = locationClean ? `${specificPart}, ${locationClean}` : specificPart;
  const title = locationClean ? `${titleClean.replace(/en venta /gi, '').trim()}, ${locationClean}` : titleClean;
  const city = locationClean ? locationClean.split(',').pop()?.trim() || '' : '';
  const price = Parsers.cleanPrice(getText(rules.price.selectors));
  const description = Parsers.cleanText(getText(rules.description.selectors));

  // 2. Features & Stats
  const features: string[] = [];
  $clean('.details-property_features li').each((_, li) => {
    features.push(Parsers.cleanText($(li).text()));
  });

  // Combine text for Regex scanning
  const headerFeatures = Parsers.cleanText($clean('.info-features, .main-info__features').text());
  const allStatsText = (headerFeatures + ' ' + features.join(' ')).replace(/\s+/g, ' ');
  
  // Apply Shared Regexes
  let bedrooms = 0;
  let bathrooms = 0;
  let m2_built = 0;
  let m2_useful = 0;
  let floor_number = 0;

  const stats = rules.stats;
  const bedMatch = allStatsText.match(stats.bedrooms);
  if (bedMatch) bedrooms = parseInt(bedMatch[1]);
  
  const bathMatch = allStatsText.match(stats.bathrooms);
  if (bathMatch) bathrooms = parseInt(bathMatch[1]);
  
  const areaMatch = allStatsText.match(stats.m2_built);
  if (areaMatch) m2_built = parseInt(areaMatch[1].replace(/\./g, ''));

  const usefulMatch = allStatsText.match(stats.m2_useful);
  if (usefulMatch) m2_useful = parseInt(usefulMatch[1].replace(/\./g, ''));

  const floorMatch = allStatsText.match(stats.floor_number);
  if (floorMatch) floor_number = parseInt(floorMatch[1] || floorMatch[2]);

  // Apply Shared Booleans & Enums
  // We can't dynamically assign to variables, so we build an object
  const extraData: any = {};
  const lowerFeatures = allStatsText.toLowerCase();
  
  Object.entries(rules.booleans).forEach(([key, keywords]) => {
    if (keywords.some(k => lowerFeatures.includes(k))) {
      extraData[key] = true;
    }
  });

  Object.entries(rules.enums).forEach(([key, options]) => {
    for (const opt of options) {
      if (opt.keywords.some(k => lowerFeatures.includes(k))) {
        extraData[key] = opt.value;
        break;
      }
    }
  });

  // 3. Contact (Using Rules)
  const phone = Parsers.cleanText(getText(rules.phone.selectors));
  const reference = Parsers.cleanText(getText(rules.reference.selectors)).replace(/ref\.?|referencia|:|reference/gi, '').trim();

  // Agency (Special Cheerio logic for scripts)
  let agency = null;
  const agencyScriptRaw = $root('#agency-branding').html() || '';
  if (agencyScriptRaw) {
    const $branding = cheerio.load(agencyScriptRaw);
    const imgEl = $branding('img.agency-video__logo').first();
    if (imgEl.length) {
      agency = {
        name: imgEl.attr('alt')?.trim() || null,
        logo_url: imgEl.attr('data-ondemand-img') || imgEl.attr('src') || null
      };
    }
  }
  
  // 4. Coordinates (Server-Side Cheerio Strategy)
  let lat: number | null = null;
  let lng: number | null = null;

  const mapContainer = $root('#ideMapDetail, #main-map');
  if (mapContainer.length) {
    const rawLat = mapContainer.attr('data-latitude');
    const rawLng = mapContainer.attr('data-longitude');
    if (rawLat && rawLng) {
      lat = parseFloat(rawLat);
      lng = parseFloat(rawLng);
  }
  }

  if (!lat) {
    const scripts = $root('script').map((_, el) => $(el).text()).get();
    for (const script of scripts) {
      if (script.includes('latitude') && script.includes('longitude')) {
        const latMatch = script.match(/["']?latitude["']?\s*:\s*"?([-0-9.]+)"?/);
        const lngMatch = script.match(/["']?longitude["']?\s*:\s*"?([-0-9.]+)"?/);
        if (latMatch && lngMatch) {
          lat = parseFloat(latMatch[1]);
          lng = parseFloat(lngMatch[1]);
          break;
        }
      }
    }
  }

  // 5. Photos (Robust Extraction)
  let photos: { url: string, tag: string }[] = [];
  const lines = htmlContent.split('\n');
  const galleryLine = lines.find((line: string) => line.includes('fullScreenGalleryPics'));

  if (galleryLine) {
    try {
        const startIndex = galleryLine.indexOf('[');
        if (startIndex !== -1) {
          let bracketCount = 0;
          let endIndex = startIndex;
          for (let i = startIndex; i < galleryLine.length; i++) {
            if (galleryLine[i] === '[') bracketCount++;
            if (galleryLine[i] === ']') bracketCount--;
            if (bracketCount === 0) {
              endIndex = i;
              break;
            }
          }
          
          const arrayString = galleryLine.substring(startIndex, endIndex + 1);
          const jsonString = arrayString
            .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
            .replace(/:\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*([,}])/g, ': "$1"$2');
            
          const galleryArray = JSON.parse(jsonString);
          if (Array.isArray(galleryArray)) {
            photos = galleryArray.map((p: any, idx: number) => ({
              url: p.imageDataService || p.url || p.src,
              tag: p.tag || `photo_${idx}`
            }));
          }
        }
    } catch (e) {
      console.warn('Error parsing fullScreenGalleryPics in parser:', e);
    }
  }

  const result = {
    title: title || undefined,
    price_eur: price || undefined,
    city: city || undefined,
    address: address || undefined,
    description: description || undefined,
    amenities: features.length ? features : undefined,
    additionalFeatures: features.length ? features : undefined,
    bedrooms: bedrooms || undefined,
    bathrooms: bathrooms || undefined,
    m2_built: m2_built || undefined,
    m2_useful: m2_useful || undefined,
    floor_number: floor_number || undefined,
    lat: lat || undefined,
    lng: lng || undefined,
    reference: reference || undefined,
    agency: agency ? { ...agency, phone } : undefined,
    photos: photos.length ? photos : undefined,
    contact: { phone, reference },
    ...extraData
  };

  // Remove undefined keys
  Object.keys(result).forEach(key => (result as any)[key] === undefined && delete (result as any)[key]);

  return result;
}
