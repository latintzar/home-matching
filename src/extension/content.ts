// This file is bundled via `scripts/build-extension.js` to `public/extension/content.js`
// It imports shared logic from `src/lib/extraction-intelligence.ts` to ensure Server/Client parity.

import { PARSING_RULES, Parsers } from '@/lib/extraction/rules';

console.log('[Leo.casa] Content script active (v2.0 Shared Logic).');

// Configuration
const API_ENDPOINT = 'http://localhost:3000/api/ingest/browser'; 
const DASHBOARD_URL = 'http://localhost:3000'; 
const BRAND_ORANGE = '#da654d';

// State
let cachedExtraction: any = null;
let isExtracting = false;

// Detect if current page is a listing
function isListingPage() {
  // 1. URL Heuristics
  const url = window.location.href;
  if (url.includes('/property/') || 
      url.includes('/inmueble/') || 
      url.includes('/listing/') || 
      url.includes('-for-sale') || 
      url.includes('-venta') ||
      /\/\d{7,}/.test(url)) {
      return true;
  }

  // 2. Content Heuristics (Price + Stats)
  const text = document.body.innerText;
  const hasPrice = /[€$£]\s*\d/.test(text) || /\d\s*€/.test(text);
  const hasStats = /(bed|hab|dorm|bath|bañ|m²|sqm)/i.test(text);

  return hasPrice && hasStats;
}

// Selectors for popular sites to inject the button
const SITE_SELECTORS = {
  'idealista.com': '.main-info__title-main',
  'fotocasa.es': '.re-DetailHeader-propertyTitle',
  'habitaclia.com': '.summary-left h1',
  'pisos.com': '.maindata-info h1',
  'yaencontre.com': '.title-container h1',
  'indomio.es': '.nd-title',
  'engelvoelkers.com': '.ev-expose-title',
  'universal': 'h1' 
};

function getSelector() {
  const host = window.location.hostname;
  for (const [domain, selector] of Object.entries(SITE_SELECTORS)) {
    if (host.includes(domain)) return selector;
  }
  return SITE_SELECTORS['universal'];
}

function injectButton() {
  // Only inject if it looks like a listing page
  if (!isListingPage()) return;

  if (document.getElementById('leo-casa-inject-btn')) return;

  const selector = getSelector();
  // Try specific selector first, then fallbacks
  let titleEl = document.querySelector(selector);
  if (!titleEl && selector === 'h1') {
      // Fallback for universal: find the biggest H1 or H2
      titleEl = document.querySelector('h1') || document.querySelector('h2');
  }
  
  if (!titleEl) return;

  const btn = document.createElement('button');
  btn.id = 'leo-casa-inject-btn';
  btn.innerHTML = 'Analyze with Leo';
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 12px;
    margin-bottom: 12px;
    padding: 10px 24px;
    background: ${BRAND_ORANGE};
    color: #FFFFFF;
    font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
    font-weight: 500;
    font-size: 16px;
    letter-spacing: -0.01em;
    border: 1px solid rgba(0,0,0,0.1);
    border-radius: 9999px;
    cursor: pointer;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 9999;
  `;

  btn.onmouseover = () => {
    btn.style.background = '#c8553d'; // Darker orange
    btn.style.transform = 'translateY(-1px)';
    btn.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.1)';
  };
  btn.onmouseout = () => {
    btn.style.background = BRAND_ORANGE;
    btn.style.transform = 'translateY(0)';
    btn.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
  };

  // Handle click via shared function
  btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      performAnalysis(API_ENDPOINT, btn);
  };
  
  if (titleEl.parentNode) {
      titleEl.parentNode.insertBefore(btn, titleEl.nextSibling);
  }
  
  // Trigger pre-fetch immediately after injection
  setTimeout(preFetchData, 500);
}

// 🚀 ROCKET SPEED: Pre-calculate AND Upload (Speculative Ingestion)
let speculativeUploadPromise: Promise<any> | null = null;

function preFetchData() {
  if (cachedExtraction || isExtracting) return;
  
  console.log('[Leo.casa] 🚀 Pre-fetching & Speculative Upload starting...');
  isExtracting = true;
  
  try {
      const data = extractPageData();
      // Prepare the payload
      cachedExtraction = {
          url: window.location.href,
          html: document.documentElement.outerHTML,
          images: [], // Lightweight payload for initial metadata ingest
          extractedMetadata: data,
          timestamp: Date.now(),
          userId: null
      };
      console.log('[Leo.casa] ✅ Data pre-fetched.');

      // Speculative Upload: Start ingestion immediately!
      // This is "free" for the user experience because it happens in background
      speculativeUploadPromise = new Promise(async (resolve) => {
          try {
              // Get API URL
              const storage = await chrome.storage.local.get(['apiUrl']);
              let apiUrl = storage.apiUrl || API_ENDPOINT;
              
              // Auto-fix legacy API URL
              if (apiUrl.includes('/api/storeListing')) {
                  apiUrl = apiUrl.replace('/api/storeListing', '/api/ingest/browser');
                  chrome.storage.local.set({ apiUrl });
              }

              // Use performAnalysis internal logic but decoupled from button
              console.log('[Leo.casa] 🚀 Starting speculative background upload...');
              
              chrome.runtime.sendMessage({
                  action: "uploadData",
                  data: cachedExtraction,
                  apiUrl: apiUrl
              }, (response) => {
                  if (response && response.success) {
                      // Speculative upload done: Metadata is saved.
                      // We DO NOT start background photo upload yet (waiting for user intent).
                      console.log('[Leo.casa] ✅ Speculative upload complete. ID:', response.id);
                      resolve({ success: true, id: response.id });
                  } else {
                      console.warn('[Leo.casa] Speculative upload failed:', response?.error);
                      resolve({ success: false, error: response?.error });
                  }
              });
          } catch (e) {
              console.warn('[Leo.casa] Speculative upload error:', e);
              resolve({ success: false, error: (e as Error).message });
          }
      });

  } catch (e) {
      console.warn('[Leo.casa] Pre-fetch failed:', e);
  } finally {
      isExtracting = false;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract') {
      // Find button if it exists to update UI, otherwise pass null
      const btn = document.getElementById('leo-casa-inject-btn') as HTMLButtonElement | null;
      
      performAnalysis(request.apiUrl || API_ENDPOINT, btn)
          .then(response => sendResponse(response))
          .catch(err => sendResponse({ success: false, error: err.message }));
      
      return true; // Keep channel open for async response
  }
});

// Core Analysis Logic
async function performAnalysis(endpoint: string, btnElement: HTMLButtonElement | null) {
  const originalText = btnElement ? btnElement.innerHTML : '';
  
  try {
    const isIdealista = window.location.hostname.includes('idealista.com');
    
    if (btnElement) {
        btnElement.innerHTML = isIdealista ? 'Analyzed!' : 'Analyzing (AI)...';
        btnElement.disabled = true;
        btnElement.style.opacity = '0.8';
        btnElement.style.cursor = 'wait';
    }

    // 1. Get Payload (Instant if cached)
    let payload = cachedExtraction;
    if (!payload) {
      console.log('[Leo.casa] Cache miss, extracting now...');
      const data = extractPageData();
      payload = {
          url: window.location.href,
          html: document.documentElement.outerHTML,
          images: [],
          extractedMetadata: data,
          timestamp: Date.now(),
          userId: null
      };
    }

    // Mark for Universal AI if not Idealista
    if (!isIdealista) {
        payload.useUniversalAI = true;
    }

    // 2. Identify Photos for Background Upload
    const photosToUpload = payload.extractedMetadata.photos || [];

    // 3. Send "Hollow" Payload (Metadata Only) - Fast!
    const storage = await chrome.storage.local.get(['apiUrl']);
    let apiUrl = storage.apiUrl || endpoint;

    // Auto-fix legacy API URL if found in storage
    if (apiUrl.includes('/api/storeListing')) {
        const newUrl = apiUrl.replace('/api/storeListing', '/api/ingest/browser');
        console.log('[Leo.casa] 🛠️ Migrating legacy API URL:', apiUrl, '->', newUrl);
        apiUrl = newUrl;
        chrome.storage.local.set({ apiUrl: newUrl }); // Persist fix
    }

    // CHECK SPECULATIVE PROMISE FIRST
    if (speculativeUploadPromise) {
        console.log('[Leo.casa] ⚡ Using speculative upload result...');
        try {
            const result = await speculativeUploadPromise;
            if (result && result.success && result.id) {
                 console.log('[Leo.casa] ✅ Speculative hit! ID:', result.id);
                 
                 // NOW triggers the photo upload (Commitment)
                 if (photosToUpload.length > 0) {
                     console.log(`[Leo.casa] 📸 Starting background photo upload (${photosToUpload.length} photos)...`);
                     chrome.runtime.sendMessage({
                        action: "startBackgroundUpload",
                        listingId: result.id,
                        photos: photosToUpload.slice(0, 99),
                        apiUrl: apiUrl
                     });
                 }
                 
                 if (btnElement) {
                     const targetUrl = `${DASHBOARD_URL}/add-property?edit=${result.id}`;
                     chrome.runtime.sendMessage({ action: "openTab", url: targetUrl });
                     
                     // Reset UI
                     setTimeout(() => {
                        btnElement.innerHTML = originalText;
                        btnElement.disabled = false;
                        btnElement.style.opacity = '1';
                        btnElement.style.cursor = 'pointer';
                     }, 2000);
                 }
                 return { success: true, id: result.id };
            }
        } catch (e) {
            console.warn('[Leo.casa] Speculative promise failed, falling back to manual upload:', e);
        }
    }
    
    console.log('[Leo.casa] 🚀 Sending hollow payload (Metadata Only) to:', apiUrl);
    
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: "uploadData",
          data: payload,
          apiUrl: apiUrl
        }, (response) => {
          if (response && response.success) {
               // 4. Success! Redirect IMMEDIATELY
               console.log('[Leo.casa] ✅ Success! Redirecting...');
               
               // 5. Fire & Forget Background Uploads
               if (photosToUpload.length > 0) {
                   console.log(`[Leo.casa] 📸 Delegating ${photosToUpload.length} photos to background uploader...`);
                   chrome.runtime.sendMessage({
                      action: "startBackgroundUpload",
                      listingId: response.id,
                      photos: photosToUpload.slice(0, 99), // Limit to reasonable amount
                      apiUrl: apiUrl
                   });
               }
               
               // Return success to caller
               resolve({ success: true, id: response.id });

               // Redirect logic (if triggered from button, we handle redirect here)
               if (btnElement) {
                   const targetUrl = `${DASHBOARD_URL}/add-property?edit=${response.id}`;
                   chrome.runtime.sendMessage({ action: "openTab", url: targetUrl });
                   
                   // Reset UI
                   setTimeout(() => {
                      btnElement.innerHTML = originalText;
                      btnElement.disabled = false;
                      btnElement.style.opacity = '1';
                      btnElement.style.cursor = 'pointer';
                   }, 2000);
               }
  
        } else {
               const errMsg = response ? response.error : "Communication error";
               reject(new Error(errMsg));
               if (btnElement) {
                  btnElement.innerHTML = '❌ Error';
                  alert('Analysis failed: ' + errMsg);
                  setTimeout(() => {
                      btnElement.innerHTML = originalText;
                      btnElement.disabled = false;
                      btnElement.style.opacity = '1';
                      btnElement.style.cursor = 'pointer';
                  }, 3000);
               }
        }
        });
    });

  } catch (err: any) {
    console.error('[Leo.casa] Error:', err);
    if (btnElement) {
      btnElement.innerHTML = '❌ Error';
      alert('Analysis failed: ' + err.message);
      setTimeout(() => {
          btnElement.innerHTML = originalText;
          btnElement.disabled = false;
          btnElement.style.opacity = '1';
          btnElement.style.cursor = 'pointer';
      }, 3000);
    }
    throw err;
  }
}

/**
 * SHARED PARSING LOGIC IMPLEMENTATION (Client-Side DOM Adapter)
 * Uses src/lib/parsers/rules.ts logic but applies it via document.querySelector
 */
function extractPageData() {
  const host = window.location.hostname;
  
  // Default Structure
  const data: any = {
    title: document.title,
    price_eur: 0, 
    city: '',
    address: '',
    description: '',
    additionalFeatures: [], 
    bedrooms: 0,
    bathrooms: 0,
    m2_built: 0,
    m2_useful: 0,
    floor_level: 'intermediate',
    condition: 'good',
    has_elevator: false,
    is_exterior: false,
    has_terrace: false,
    has_balcony: false,
    has_pool: false,
    has_garage: false,
    has_garden: false,
    photos: [], 
    agency: null,
    contact: null
  };

  if (host.includes('idealista.com')) {
    const rules = PARSING_RULES.idealista;

    // Helper to find text from selectors
    const getText = (selectors: string[]) => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el?.textContent) return el.textContent;
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
    data.address = locationClean ? `${specificPart}, ${locationClean}` : specificPart;
    data.title = locationClean ? `${titleClean.replace(/en venta /gi, '').trim()}, ${locationClean}` : titleClean;
    data.city = locationClean ? locationClean.split(',').pop()?.trim() || '' : '';
    data.price_eur = Parsers.cleanPrice(getText(rules.price.selectors));
    data.description = Parsers.cleanText(getText(rules.description.selectors));

    // 2. Features & Stats
    const features: string[] = [];
    document.querySelectorAll('.details-property_features li').forEach(li => {
      features.push(Parsers.cleanText(li.textContent));
    });
    data.additionalFeatures = features;

    // Combine text for Regex scanning
    const headerFeatures = Parsers.cleanText(document.querySelector('.info-features, .main-info__features')?.textContent);
    const allStatsText = (headerFeatures + ' ' + features.join(' ')).replace(/\s+/g, ' ');
    
    // Apply Shared Regexes
    const stats = rules.stats;
    const bedMatch = allStatsText.match(stats.bedrooms);
    if (bedMatch) data.bedrooms = parseInt(bedMatch[1]);
    
    const bathMatch = allStatsText.match(stats.bathrooms);
    if (bathMatch) data.bathrooms = parseInt(bathMatch[1]);
    
    const areaMatch = allStatsText.match(stats.m2_built);
    if (areaMatch) data.m2_built = parseInt(areaMatch[1].replace(/\./g, ''));

    const usefulMatch = allStatsText.match(stats.m2_useful);
    if (usefulMatch) data.m2_useful = parseInt(usefulMatch[1].replace(/\./g, ''));

    const floorMatch = allStatsText.match(stats.floor_number);
    if (floorMatch) data.floor_number = parseInt(floorMatch[1] || floorMatch[2]);

    // Apply Shared Booleans
    const lowerFeatures = allStatsText.toLowerCase();
    Object.entries(rules.booleans).forEach(([key, keywords]) => {
      if (keywords.some(k => lowerFeatures.includes(k))) {
        data[key] = true;
      }
    });

    // Apply Shared Enums
    Object.entries(rules.enums).forEach(([key, options]) => {
      for (const opt of options) {
        if (opt.keywords.some(k => lowerFeatures.includes(k))) {
          data[key] = opt.value;
          break; 
        }
      }
    });

    // 3. Contact & Agency
    data.contact = {
      phone: Parsers.cleanText(getText(rules.phone.selectors)),
      reference: Parsers.cleanText(getText(rules.reference.selectors)).replace(/ref\.?|referencia|:|reference/gi, '').trim()
    };
    data.reference = data.contact.reference;

    const agencyImg = document.querySelector('#agency-branding img.agency-video__logo') || document.querySelector('.professional-name img');
    if (agencyImg) {
        data.agency = {
            name: agencyImg.getAttribute('alt')?.trim() || null,
            logo_url: agencyImg.getAttribute('data-ondemand-img') || agencyImg.getAttribute('src') || null,
            phone: data.contact.phone // Associate phone with agency if present
        };
    }

    // 4. Coordinates (Idealista Specific - kept here as it's DOM specific)
    const mapContainer = document.getElementById('ideMapDetail') || document.querySelector('#main-map');
    if (mapContainer) {
        const lat = mapContainer.getAttribute('data-latitude');
        const lng = mapContainer.getAttribute('data-longitude');
        if (lat && lng) {
            data.lat = parseFloat(lat);
            data.lng = parseFloat(lng);
        }
    }
    if (!data.lat) {
        const scripts = document.getElementsByTagName('script');
        for (let i = 0; i < scripts.length; i++) {
            const text = scripts[i].textContent || '';
            if (text.includes('latitude') && text.includes('longitude')) {
                const latMatch = text.match(/["']?latitude["']?\s*:\s*"?([-0-9.]+)"?/);
                const lngMatch = text.match(/["']?longitude["']?\s*:\s*"?([-0-9.]+)"?/);
                if (latMatch && lngMatch) {
                    data.lat = parseFloat(latMatch[1]);
                    data.lng = parseFloat(lngMatch[1]);
                    break;
                }
            }
        }
    }

    // 5. Photos (Robust Script Extraction)
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const content = scripts[i].textContent || '';
      if (content && content.includes('fullScreenGalleryPics')) {
        try {
          const startIdx = content.indexOf('fullScreenGalleryPics');
          const arrayStart = content.indexOf('[', startIdx);
          if (arrayStart !== -1) {
            let bracketCount = 0;
            let arrayEnd = -1;
            for (let j = arrayStart; j < content.length; j++) {
              if (content[j] === '[') bracketCount++;
              if (content[j] === ']') bracketCount--;
              if (bracketCount === 0) { arrayEnd = j; break; }
            }
            if (arrayEnd !== -1) {
              let arrayStr = content.substring(arrayStart, arrayEnd + 1);
              arrayStr = arrayStr.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
                         .replace(/:\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*([,}])/g, ': "$1"$2');
              
                  try {
                       const parsed = JSON.parse(arrayStr);
                       if (Array.isArray(parsed)) {
                           data.photos = parsed.map((p: any, idx: number) => ({
                               url: p.imageDataService || p.url || p.src,
                               tag: p.tag || `photo_${idx}`
                           }));
                       }
                  } catch(e) {}
            }
          }
        } catch (e) { console.warn('Script photo extraction error:', e); }
      }
    }
  } else {
    // UNIVERSAL PARSER (AI FALLBACK for other sites)
    console.log('[Leo.casa] Using Universal AI Path (Server-Side)');
    
    // Basic Heuristics to pass to AI as hints
    const currencyElements = Array.from(document.querySelectorAll('*')).filter(el => 
      el.children.length === 0 && el.textContent && (el.textContent.includes('€') || el.textContent.includes('EUR'))
    );
    let bestPrice = 0;
    let maxFontSize = 0;
    currencyElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const fontSize = parseFloat(style.fontSize);
        const val = Parsers.cleanPrice(el.textContent);
        if (val > 100 && fontSize >= maxFontSize) {
            maxFontSize = fontSize;
            bestPrice = val;
        }
    });
    if (bestPrice > 0) data.price_eur = bestPrice;
  }

  return data;
}

// Run injection check
const observer = new MutationObserver(() => {
  injectButton();
});

observer.observe(document.body, { childList: true, subtree: true });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectButton);
} else {
  injectButton();
}

