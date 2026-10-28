/**
 * Leo Vibe Maps - Injected Script (runs in MAIN world)
 * This file is loaded externally to bypass CSP restrictions
 * 
 * Supports both default vibe areas and AI-generated custom areas
 */

(function() {
  'use strict';
  
  // Get config from data attributes on the script tag
  const scriptTag = document.getElementById('leo-vibe-injected-script');
  const HEATMAP_URL = scriptTag?.dataset.heatmapUrl || '';
  const BOUNDS = JSON.parse(scriptTag?.dataset.bounds || '{"south":41.32,"west":2.02,"north":41.47,"east":2.23}');
  
  // Check for custom AI-generated areas
  const customAreasJson = scriptTag?.dataset.customAreas;
  let CUSTOM_AREAS = null;
  if (customAreasJson) {
    try {
      CUSTOM_AREAS = JSON.parse(customAreasJson);
      console.log('🤖 Custom AI-generated areas loaded:', CUSTOM_AREAS.length);
    } catch (e) {
      console.error('❌ Failed to parse custom areas:', e);
    }
  }
  
  console.log('🗺️ Leo Vibe Maps: Main world script executing...');
  const detectedSite = window.location.hostname.includes('airbnb') ? 'Airbnb' : 
                       window.location.hostname.includes('booking') ? 'Booking.com' : 
                       (window.location.hostname.includes('google.com') && window.location.pathname.startsWith('/maps')) ? 'Google Maps' : 'Unknown';
  console.log('🌐 Site detected:', detectedSite);
  console.log('📦 Mode:', CUSTOM_AREAS ? 'AI-Generated Areas' : 'Default Areas');
  
  // ============================================
  // DEFAULT VIBE AREAS - Used when no custom areas provided
  // See docs/VIBE_AREAS.md for documentation
  // ============================================
  const DEFAULT_VIBE_AREAS = [
    { 
      name: "Gothic Quarter", 
      lat: 41.3833, 
      lng: 2.1777, 
      radius: 400,
      color: "#E74C3C", // Red
      vibes: ["romantic", "historic", "nightlife"]
    },
    { 
      name: "El Born", 
      lat: 41.3850, 
      lng: 2.1825, 
      radius: 350,
      color: "#3498DB", // Blue
      vibes: ["hipster", "trendy", "boutiques"]
    },
    { 
      name: "Gràcia", 
      lat: 41.4025, 
      lng: 2.1530, 
      radius: 500,
      color: "#2ECC71", // Green
      vibes: ["local", "bohemian", "authentic"]
    },
    { 
      name: "Barceloneta", 
      lat: 41.3807, 
      lng: 2.1897, 
      radius: 400,
      color: "#F39C12", // Orange
      vibes: ["beach", "seafood", "sunny"]
    },
    { 
      name: "Eixample", 
      lat: 41.3917, 
      lng: 2.1649, 
      radius: 600,
      color: "#9B59B6", // Purple
      vibes: ["upscale", "modernist", "shopping"]
    }
  ];
  
  // Use custom areas if provided, otherwise use defaults
  const VIBE_AREAS = CUSTOM_AREAS || DEFAULT_VIBE_AREAS;
  
  // Module-scoped navigation state (accessible to event listeners)
  let currentAreasArray = VIBE_AREAS;
  let currentAreaIndex = 0;
  let currentMapRef = null;
  let navigationCooldown = false; // Prevents idle listener during navigation
  
  // Store created circles for later manipulation
  let vibeCircles = [];
  
  // Prevent multiple executions
  if (window.__leoVibeInitialized) {
    console.log('⚠️ Already initialized, vibe areas already on map');
    return;
  }
  window.__leoVibeInitialized = true;
  
  // ============================================
  // ACTIVATION CHECK - Only run if explicitly activated by button click
  // ============================================
  
  // Detect site
  const isAirbnb = window.location.hostname.includes('airbnb');
  const isBooking = window.location.hostname.includes('booking.com');
  const isGoogleMaps = window.location.hostname.includes('google.com') && window.location.pathname.startsWith('/maps');
  
  // ONLY run if script was injected with activated=true data attribute
  // This is set by content-script.js when user clicks "Show Vibe Areas"
  const wasActivated = scriptTag?.dataset.activated === 'true';
  
  if (!wasActivated) {
    console.log('⏸️ Leo Vibe Maps: Script loaded but not activated, stopping.');
    return;
  }
  
  console.log('✅ Leo Vibe Maps: Activated by user, initializing...');
  
  // Switch to full map view based on site
  function switchToMapView() {
    // Google Maps is already in map view!
    if (isGoogleMaps) {
      console.log('🗺️ Already on Google Maps - no view switch needed');
      return;
    }
    
    console.log('🗺️ Switching to map view...');
    
    if (isAirbnb) {
      switchToAirbnbMapView();
    } else if (isBooking) {
      switchToBookingMapView();
    }
  }
  
  // Airbnb: Switch to FULL map view
  function switchToAirbnbMapView() {
    console.log('🏠 Airbnb: Looking for FULL map toggle...');
    
    // Method 1: Find the expand/fullscreen button with the specific SVG icon
    const allButtons = document.querySelectorAll('button, span[role="button"], div[role="button"]');
    for (const btn of allButtons) {
      const svg = btn.querySelector('svg');
      if (svg) {
        const paths = svg.querySelectorAll('path');
        for (const path of paths) {
          const d = path.getAttribute('d') || '';
          if (d.includes('m14 29') || d.includes('m18 3h10') || d.includes('m18 14 11-11')) {
            console.log('✅ Found fullscreen expand button, clicking...');
            btn.click();
            return;
          }
        }
      }
      
      const parent = btn.closest('[data-button-content]') || btn.parentElement;
      if (parent) {
        const parentSvg = parent.querySelector('svg');
        if (parentSvg) {
          const paths = parentSvg.querySelectorAll('path');
          for (const path of paths) {
            const d = path.getAttribute('d') || '';
            if (d.includes('m14 29') || d.includes('m18 3h10')) {
              const clickable = parent.closest('button') || parent.closest('[role="button"]') || parent;
              clickable.click();
              return;
            }
          }
        }
      }
    }
    
    // Method 2: Look for data-testid or aria-label
    const expandBtns = document.querySelectorAll('[data-testid*="expand"], [data-testid*="fullscreen"], [aria-label*="expand" i], [aria-label*="full" i]');
    if (expandBtns.length > 0) {
      expandBtns[0].click();
      return;
    }
    
    // Method 3: URL params
    const url = new URL(window.location.href);
    url.searchParams.set('map_toggle', 'true');
    url.searchParams.set('search_by_map', 'true');
    window.history.replaceState({}, '', url.toString());
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    setTimeout(() => window.dispatchEvent(new Event('resize')), 500);
  }
  
  // Booking.com: Switch to map view
  function switchToBookingMapView() {
    console.log('🏨 Booking.com: Looking for map toggle...');
    
    const mapButtons = document.querySelectorAll('button, a');
    for (const btn of mapButtons) {
      const text = btn.textContent?.toLowerCase() || '';
      const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
      if (text.includes('show on map') || text.includes('show map') || 
          text.includes('view on map') || ariaLabel.includes('map')) {
        btn.click();
        setTimeout(() => window.dispatchEvent(new Event('resize')), 500);
        return;
      }
    }
    
    const mapToggle = document.querySelector('[data-testid="map-trigger"], [data-testid="sr-map-trigger"]');
    if (mapToggle) {
      mapToggle.click();
      return;
    }
    
    if (!window.location.hash.includes('map_opened')) {
      window.location.hash = 'map_opened';
    }
  }
  
  // Switch to map view immediately
  switchToMapView();
  
  // ============================================
  // GOOGLE MAPS WEBSITE - Special handling
  // Google Maps website doesn't use the standard google.maps API
  // We need to create DOM overlays instead
  // ============================================
  if (isGoogleMaps) {
    console.log('🗺️ Google Maps website detected - using DOM overlay approach');
    initGoogleMapsWebsiteOverlay();
    return; // Don't run the standard map finding logic
  }
  
  // Initialize Google Maps website overlay with clickable circles
  function initGoogleMapsWebsiteOverlay() {
    // Parse coordinates from URL (format: @lat,lng,zoom)
    function parseUrlCoordinates() {
      const match = window.location.pathname.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+\.?\d*)z/);
      if (match) {
        return {
          lat: parseFloat(match[1]),
          lng: parseFloat(match[2]),
          zoom: parseFloat(match[3])
        };
      }
      // Fallback to Barcelona center
      return { lat: 41.3874, lng: 2.1686, zoom: 13 };
    }
    
    // Convert lat/lng to pixel position relative to map container
    function latLngToPixel(lat, lng, mapCenter, zoom, containerWidth, containerHeight) {
      const TILE_SIZE = 256;
      const scale = Math.pow(2, zoom);
      
      // World coordinates
      function latLngToWorld(lat, lng) {
        const siny = Math.sin(lat * Math.PI / 180);
        const boundedSiny = Math.max(-0.9999, Math.min(0.9999, siny));
        return {
          x: TILE_SIZE * (0.5 + lng / 360),
          y: TILE_SIZE * (0.5 - Math.log((1 + boundedSiny) / (1 - boundedSiny)) / (4 * Math.PI))
        };
      }
      
      const centerWorld = latLngToWorld(mapCenter.lat, mapCenter.lng);
      const pointWorld = latLngToWorld(lat, lng);
      
      const pixelX = (pointWorld.x - centerWorld.x) * scale + containerWidth / 2;
      const pixelY = (pointWorld.y - centerWorld.y) * scale + containerHeight / 2;
      
      return { x: pixelX, y: pixelY };
    }
    
    // Calculate pixel radius based on meters and zoom
    function metersToPixels(meters, lat, zoom) {
      const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
      return meters / metersPerPixel;
    }
    
    // Find the map canvas container
    function findMapContainer() {
      // Google Maps uses canvas with class H1VXrf
      const canvas = document.querySelector('canvas.H1VXrf');
      if (canvas) {
        return canvas.parentElement;
      }
      // Fallback to scene container
      const scene = document.getElementById('scene');
      if (scene) return scene;
      // Last resort - the main content area
      return document.querySelector('[role="main"]') || document.body;
    }
    
    // Create the overlay container
    let overlayContainer = document.getElementById('leo-vibe-overlay');
    if (!overlayContainer) {
      overlayContainer = document.createElement('div');
      overlayContainer.id = 'leo-vibe-overlay';
      overlayContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
      `;
    }
    
    // Store circles for navigation
    let vibeCircleElements = [];
    let currentAreaIndex = 0;
    
    // Create circles on the overlay
    function createVibeCircles() {
      const mapContainer = findMapContainer();
      if (!mapContainer) {
        console.log('⏳ Waiting for map container...');
        setTimeout(createVibeCircles, 500);
        return;
      }
      
      // Ensure overlay is in the container
      if (!mapContainer.contains(overlayContainer)) {
        mapContainer.style.position = 'relative';
        mapContainer.appendChild(overlayContainer);
      }
      
      const coords = parseUrlCoordinates();
      const containerRect = mapContainer.getBoundingClientRect();
      
      // Clear existing circles
      overlayContainer.innerHTML = '';
      vibeCircleElements = [];
      
      // Create circle for each vibe area
      VIBE_AREAS.forEach((area, index) => {
        const pixelPos = latLngToPixel(
          area.lat, area.lng,
          { lat: coords.lat, lng: coords.lng },
          coords.zoom,
          containerRect.width,
          containerRect.height
        );
        
        const radiusPixels = metersToPixels(area.radius, area.lat, coords.zoom);
        
        // Skip if circle is way off screen
        if (pixelPos.x < -radiusPixels * 2 || pixelPos.x > containerRect.width + radiusPixels * 2 ||
            pixelPos.y < -radiusPixels * 2 || pixelPos.y > containerRect.height + radiusPixels * 2) {
          return;
        }
        
        const circle = document.createElement('div');
        circle.className = 'leo-vibe-circle';
        circle.dataset.index = index;
        circle.dataset.name = area.name;
        circle.style.cssText = `
          position: absolute;
          left: ${pixelPos.x - radiusPixels}px;
          top: ${pixelPos.y - radiusPixels}px;
          width: ${radiusPixels * 2}px;
          height: ${radiusPixels * 2}px;
          border-radius: 50%;
          background: ${area.color}40;
          border: 2px solid ${area.color};
          pointer-events: auto;
          cursor: pointer;
          transition: transform 0.2s, background 0.2s;
        `;
        
        // Hover effect
        circle.addEventListener('mouseenter', () => {
          circle.style.background = `${area.color}60`;
          circle.style.transform = 'scale(1.05)';
          showInfoCard(area, index);
        });
        
        circle.addEventListener('mouseleave', () => {
          circle.style.background = `${area.color}40`;
          circle.style.transform = 'scale(1)';
          hideInfoCard(false);
        });
        
        // Click to zoom
        circle.addEventListener('click', () => {
          currentAreaIndex = index;
          // Navigate Google Maps to this location
          const newUrl = `https://www.google.com/maps/@${area.lat},${area.lng},16z`;
          window.history.pushState({}, '', newUrl);
          window.dispatchEvent(new PopStateEvent('popstate'));
          showInfoCard(area, index, true);
        });
        
        overlayContainer.appendChild(circle);
        vibeCircleElements.push({ element: circle, area });
        console.log(`✅ Created circle: ${area.name}`);
      });
      
      console.log(`✅ Created ${vibeCircleElements.length} vibe circles on Google Maps!`);
    }
    
    // Info card state
    let currentInfoCard = null;
    let cardPersistent = false;
    
    // Show info card
    function showInfoCard(area, index, persistent = false) {
      if (cardPersistent && !persistent) return;
      
      hideInfoCard(true);
      
      const mapContainer = findMapContainer();
      if (!mapContainer) return;
      
      // Build itinerary HTML if available
      let itineraryHtml = '';
      if (area.itinerary && area.itinerary.length > 0) {
        itineraryHtml = `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.15);">
            <div style="font-size: 11px; opacity: 0.6; margin-bottom: 8px;">🗺️ Suggested itinerary:</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${area.itinerary.map(item => `
                <div style="display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; background: rgba(255,255,255,0.06); border-radius: 10px;">
                  <div style="font-size: 13px; font-weight: 500;">${item.purpose}</div>
                  <div style="display: flex; gap: 6px;">
                    <a href="https://www.google.com/maps/search/${encodeURIComponent(item.query)}/@${area.lat},${area.lng},16z" 
                       target="_blank" style="display: flex; align-items: center; gap: 4px; padding: 5px 10px; background: rgba(66, 133, 244, 0.25); border-radius: 6px; text-decoration: none; color: #93c5fd; font-size: 11px;">
                      <span>📍</span><span>Maps</span>
                    </a>
                    <a href="https://www.tiktok.com/search?q=${encodeURIComponent(item.query + ' ' + area.name)}" 
                       target="_blank" style="display: flex; align-items: center; gap: 4px; padding: 5px 10px; background: rgba(255, 0, 80, 0.2); border-radius: 6px; text-decoration: none; color: #ff6b9d; font-size: 11px;">
                      <span>🎵</span><span>TikTok</span>
                    </a>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } else if (area.vibes) {
        itineraryHtml = `<div style="margin-top: 8px;">${area.vibes.map(v => `<span style="display: inline-block; background: rgba(255,255,255,0.15); padding: 2px 8px; border-radius: 12px; margin: 2px 4px 2px 0; font-size: 12px;">${v}</span>`).join('')}</div>`;
      }
      
      // Navigation footer
      const navHtml = persistent && VIBE_AREAS.length > 1 ? `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
          <button id="leo-nav-prev" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 14px;">←</button>
          <span style="font-size: 11px; opacity: 0.5;">${index + 1} / ${VIBE_AREAS.length}</span>
          <button id="leo-nav-next" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 14px;">→</button>
        </div>
      ` : '';
      
      const card = document.createElement('div');
      card.id = 'leo-vibe-info-card';
      card.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: ${area.color}; opacity: 0.8; flex-shrink: 0;"></div>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 16px; margin-bottom: 6px;">📍 ${area.name}</div>
            <div style="font-size: 13px; opacity: 0.9;">${area.why || ''}</div>
          </div>
          <button id="leo-card-close" style="background: none; border: none; color: white; opacity: 0.6; cursor: pointer; font-size: 18px; padding: 0;">×</button>
        </div>
        ${itineraryHtml}
        ${navHtml}
      `;
      
      card.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: rgba(0, 0, 0, 0.92);
        color: white;
        padding: 16px 18px;
        border-radius: 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 4px 24px rgba(0,0,0,0.4);
        z-index: 10000;
        width: 320px;
        backdrop-filter: blur(10px);
      `;
      
      document.body.appendChild(card);
      currentInfoCard = card;
      cardPersistent = persistent;
      
      // Close button
      card.querySelector('#leo-card-close')?.addEventListener('click', () => hideInfoCard(true));
      
      // Navigation buttons
      if (persistent) {
        card.querySelector('#leo-nav-prev')?.addEventListener('click', () => navigateArea(-1));
        card.querySelector('#leo-nav-next')?.addEventListener('click', () => navigateArea(1));
      }
    }
    
    // Hide info card
    function hideInfoCard(force = false) {
      if (cardPersistent && !force) return;
      if (currentInfoCard) {
        currentInfoCard.remove();
        currentInfoCard = null;
      }
      cardPersistent = false;
    }
    
    // Navigate between areas
    function navigateArea(direction) {
      currentAreaIndex = (currentAreaIndex + direction + VIBE_AREAS.length) % VIBE_AREAS.length;
      const area = VIBE_AREAS[currentAreaIndex];
      const newUrl = `https://www.google.com/maps/@${area.lat},${area.lng},16z`;
      window.history.pushState({}, '', newUrl);
      window.dispatchEvent(new PopStateEvent('popstate'));
      showInfoCard(area, currentAreaIndex, true);
    }
    
    // Update circles when URL changes (user pans/zooms)
    function handleUrlChange() {
      console.log('🔄 URL changed, updating circles...');
      setTimeout(createVibeCircles, 300);
    }
    
    // Watch for URL changes
    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        handleUrlChange();
      }
    }, 500);
    
    // Also listen for popstate
    window.addEventListener('popstate', handleUrlChange);
    
    // Initial creation (wait for map to load)
    setTimeout(createVibeCircles, 1000);
    
    // Mark as initialized
    window.__leoVibeOverlay = {
      circles: vibeCircleElements,
      refresh: createVibeCircles,
      showInfoCard,
      hideInfoCard
    };
    
    console.log('✅ Google Maps website overlay initialized!');
  }
  
  // Wrap the rest in a function so we can call it after activation
  function initVibeOverlay() {
    // State - declare at top!
    let retryCount = 0;
    const MAX_RETRIES = 10; // Reduced since we have fallback overlay
  
  // ============================================
  // MAP VALIDATION - Must be at top level for findMapInstance to use
  // ============================================
  
  // Validate this is actually a usable Google Maps instance
  function isValidMapInstance(obj) {
    if (!obj) return false;
    
    // Check if it has the required Map methods
    const requiredMethods = ['getCenter', 'getZoom', 'getBounds', 'fitBounds', 'panBy'];
    for (const method of requiredMethods) {
      if (typeof obj[method] !== 'function') {
        console.log(`⚠️ Map missing method: ${method}`);
        return false;
      }
    }
    
    // Check if it's actually a google.maps.Map instance
    if (typeof google !== 'undefined' && google.maps && google.maps.Map) {
      if (!(obj instanceof google.maps.Map)) {
        console.log('⚠️ Object is not instanceof google.maps.Map');
        return false; // On Booking.com, this is critical - don't proceed with non-Map objects
      }
    }
    
    // Try to get the center to verify it's initialized
    try {
      const center = obj.getCenter();
      // center.lat should be a function, not a number
      if (!center || typeof center.lat !== 'function') {
        console.log('⚠️ Map center.lat is not a function - this is React state, not a Map');
        return false;
      }
      if (center.lat() === 0 && center.lng() === 0) {
        console.log('⚠️ Map has no valid center (0,0)');
        return false;
      }
    } catch(e) {
      console.log('⚠️ Map getCenter() failed:', e.message);
      return false;
    }
    
    return true;
  }
  
  // Check if obj is a REAL google.maps.Map (has getDiv method - unique to real Maps)
  function isRealGoogleMap(obj) {
    if (!obj) return false;
    if (typeof obj.getDiv !== 'function') return false;
    if (typeof obj.getCenter !== 'function') return false;
    if (typeof obj.getZoom !== 'function') return false;
    try {
      // getDiv() returns the container element - only real Maps have this
      const div = obj.getDiv();
      if (div instanceof HTMLElement) {
        console.log('✅ Found object with valid getDiv()!');
        return true;
      }
    } catch(e) {}
    return false;
  }
  
  // BOOKING.COM SPECIFIC: Find the real map from container properties
  function findBookingMap() {
    const gmStyle = document.querySelector('.gm-style');
    if (!gmStyle) return null;
    
    console.log('🔍 [Booking] Searching for real Map instance...');
    
    // Method 1: Check hooked instances first
    if (typeof google !== 'undefined' && google.maps?.Map?.__leoInstances?.length > 0) {
      for (const instance of google.maps.Map.__leoInstances) {
        if (isRealGoogleMap(instance)) {
          console.log('✅ [Booking] Found valid map in hooked instances');
          return instance;
        }
      }
    }
    
    // Method 2: Walk DOM tree and check ALL properties
    let el = gmStyle;
    for (let i = 0; i < 15; i++) {
      if (!el) break;
      
      // Check all enumerable properties
      const props = Object.keys(el);
      for (const prop of props) {
        try {
          const val = el[prop];
          if (val && typeof val === 'object') {
            // Direct check
            if (isRealGoogleMap(val)) {
              console.log(`✅ [Booking] Found map at el.${prop}`);
              return val;
            }
            // Check .map property
            if (val.map && isRealGoogleMap(val.map)) {
              console.log(`✅ [Booking] Found map at el.${prop}.map`);
              return val.map;
            }
          }
        } catch(e) {}
      }
      
      // Also check non-enumerable properties like __gm
      for (const prop of ['__gm', '__map', '_map', 'map', '__googleMap']) {
        try {
          const val = el[prop];
          if (val && isRealGoogleMap(val)) {
            console.log(`✅ [Booking] Found map at el.${prop}`);
            return val;
          }
          if (val && val.map && isRealGoogleMap(val.map)) {
            console.log(`✅ [Booking] Found map at el.${prop}.map`);
            return val.map;
          }
        } catch(e) {}
      }
      
      el = el.parentElement;
    }
    
    // Method 3: DEEP search for Map via getDiv() on all nested objects
    // The real Map is hidden somewhere - search ALL properties exhaustively
    el = gmStyle.parentElement;
    if (el) {
      console.log('🔍 [Booking] Deep searching for Map with getDiv()...');
      
      const visited = new WeakSet();
      const deepSearch = (obj, depth = 0, path = 'root') => {
        if (depth > 12 || !obj || typeof obj !== 'object') return null;
        if (visited.has(obj)) return null;
        try { visited.add(obj); } catch(e) { return null; }
        
        // Check if THIS object is a Map
        if (isRealGoogleMap(obj)) {
          console.log(`✅ [Booking] Found Map at ${path}`);
          return obj;
        }
        
        // Get ALL property names including non-enumerable
        let allKeys = [];
        try {
          allKeys = [
            ...Object.keys(obj),
            ...Object.getOwnPropertyNames(obj)
          ];
          // Remove duplicates
          allKeys = [...new Set(allKeys)];
        } catch(e) { return null; }
        
        // Prioritize certain keys that are likely to contain the Map
        const priorityKeys = ['map', '__gm', 'Eg', 'Fg', 'Gg', 'Hg', 'Ig', 'Jg', 'Kg', 
                             'instance', 'target', 'Ma', 'Na', 'Oa', 'Pa', 'g', 'h', 'i', 'j'];
        const sortedKeys = [
          ...priorityKeys.filter(k => allKeys.includes(k)),
          ...allKeys.filter(k => !priorityKeys.includes(k))
        ].slice(0, 50); // Limit to prevent hanging
        
        for (const key of sortedKeys) {
          try {
            const val = obj[key];
            if (val && typeof val === 'object') {
              const result = deepSearch(val, depth + 1, `${path}.${key}`);
              if (result) return result;
            }
          } catch(e) {}
        }
        return null;
      };
      
      // Search from the map container
      const mapFromContainer = deepSearch(el);
      if (mapFromContainer) return mapFromContainer;
      
      // Also search from gmStyle itself
      const mapFromGmStyle = deepSearch(gmStyle);
      if (mapFromGmStyle) return mapFromGmStyle;
    }
    
    // Method 4: Query ALL divs with gm-style and check their specific Google properties
    const allGmContainers = document.querySelectorAll('.gm-style');
    for (const container of allGmContainers) {
      const parent = container.parentElement;
      if (!parent) continue;
      
      // Google Maps stores the map on the container's parent with property pattern
      const allProps = Object.getOwnPropertyNames(parent);
      for (const prop of allProps) {
        try {
          const val = parent[prop];
          if (isRealGoogleMap(val)) {
            console.log(`✅ [Booking] Found map at container parent.${prop}`);
            return val;
          }
        } catch(e) {}
      }
    }
    
    // Method 5: Check window/global objects that Booking might use
    const globalNames = ['map', 'googleMap', 'gmap', 'mapInstance', 'bMap', 'hotelMap', 'searchMap'];
    for (const name of globalNames) {
      try {
        if (window[name] && isRealGoogleMap(window[name])) {
          console.log(`✅ [Booking] Found map at window.${name}`);
          return window[name];
        }
      } catch(e) {}
    }
    
    // Method 6: Find map by intercepting existing Markers/Circles
    // Booking.com has hotel markers on the map - find one and get its map
    if (typeof google !== 'undefined' && google.maps) {
      console.log('🔍 [Booking] Trying to find Map via existing overlays...');
      
      // Look for any Google Maps overlay elements in the DOM
      const overlayContainers = document.querySelectorAll('[data-marker-id], .gm-style img[src*="maps.gstatic.com"], .gm-style div[style*="cursor: pointer"]');
      console.log(`🔍 [Booking] Found ${overlayContainers.length} potential overlay elements`);
      
      // Check if there are any MVCObject instances we can find
      // Google Maps overlays inherit from MVCObject and have a map property
      const allDivs = gmStyle.querySelectorAll('*');
      for (const div of allDivs) {
        try {
          const keys = Object.getOwnPropertyNames(div);
          for (const key of keys) {
            const val = div[key];
            // Check if it's an MVCObject with a getMap() method
            if (val && typeof val.getMap === 'function') {
              const map = val.getMap();
              if (isRealGoogleMap(map)) {
                console.log(`✅ [Booking] Found map via overlay.getMap() on div.${key}`);
                return map;
              }
            }
          }
        } catch(e) {}
      }
    }
    
    // Method 6: If google.maps.Map exists, try to find instances via prototype chain
    if (typeof google !== 'undefined' && google.maps && google.maps.Map) {
      // Some maps attach themselves to the window or use a singleton pattern
      // Check if Map has any static properties with instances
      try {
        const mapProto = google.maps.Map.prototype;
        if (mapProto && mapProto.__leoLastInstance && isRealGoogleMap(mapProto.__leoLastInstance)) {
          console.log('✅ [Booking] Found map via prototype.__leoLastInstance');
          return mapProto.__leoLastInstance;
        }
      } catch(e) {}
    }
    
    console.log('❌ [Booking] Could not find real Map instance');
    return null;
  }
  
  // Booking.com specific: Set up a continuous watcher for when Map gets created
  function setupBookingMapWatcher() {
    if (!window.location.hostname.includes('booking.com')) return;
    
    console.log('🔍 [Booking] Setting up Map creation watcher...');
    
    let watchAttempts = 0;
    const maxWatchAttempts = 30; // 30 seconds
    
    const watchInterval = setInterval(() => {
      watchAttempts++;
      
      // Check hooked instances
      if (typeof google !== 'undefined' && google.maps?.Map?.__leoInstances?.length > 0) {
        const instance = google.maps.Map.__leoInstances[0];
        if (isRealGoogleMap(instance)) {
          console.log('✅ [Booking Watcher] Found valid hooked instance!');
          clearInterval(watchInterval);
          createOverlay(instance);
          return;
        }
      }
      
      // Try the Booking-specific finder
      const map = findBookingMap();
      if (map) {
        console.log('✅ [Booking Watcher] Found map via finder!');
        clearInterval(watchInterval);
        createOverlay(map);
        return;
      }
      
      if (watchAttempts >= maxWatchAttempts) {
        console.log('❌ [Booking Watcher] Gave up after 30s');
        clearInterval(watchInterval);
      }
    }, 1000);
  }
  
  // Hook into Google Maps to catch map creation
  function hookGoogleMaps() {
    if (typeof google === 'undefined' || !google.maps || !google.maps.Map) {
      return false;
    }
    
    // Don't hook twice
    if (google.maps.Map.__leoHooked) {
      return true;
    }
    
    // Mark as hooked BEFORE modifying to prevent race conditions
    google.maps.Map.__leoHooked = true;
    google.maps.Map.__leoInstances = google.maps.Map.__leoInstances || [];
    window.__leoEarlyMaps = window.__leoEarlyMaps || [];
    
    // Store original constructor
    const OriginalMap = google.maps.Map;
    
    // Replace with our wrapper
    google.maps.Map = function(...args) {
      console.log('🗺️ Google Map constructor called!');
      const map = new OriginalMap(...args);
      
      // Only track first 2 maps to avoid polluting with accidental creations
      if (google.maps.Map.__leoInstances.length < 2) {
        google.maps.Map.__leoInstances.push(map);
        window.__leoEarlyMaps.push(map);
        console.log('🗺️ New Google Map stored! Total:', google.maps.Map.__leoInstances.length);
        
        // Dispatch event only for first map
        if (google.maps.Map.__leoInstances.length === 1) {
          window.dispatchEvent(new CustomEvent('leo-map-created', { detail: { map } }));
          
          // Create overlay only for FIRST map
          if (!window.__leoVibeOverlay) {
            setTimeout(() => createOverlay(map), 500);
          }
        }
      } else {
        console.log('⚠️ Ignoring map #' + (google.maps.Map.__leoInstances.length + 1) + ' (not the main Airbnb map)');
      }
      
      return map;
    };
    
    // Copy prototype and static properties
    google.maps.Map.prototype = OriginalMap.prototype;
    google.maps.Map.__leoHooked = true;
    google.maps.Map.__leoInstances = google.maps.Map.__leoInstances || [];
    
    Object.keys(OriginalMap).forEach(key => {
      try {
        if (key !== '__leoHooked' && key !== '__leoInstances') {
          google.maps.Map[key] = OriginalMap[key];
        }
      } catch(e) {}
    });
    
    // ALSO hook Marker to capture the map when Booking creates markers
    if (google.maps.Marker && !google.maps.Marker.__leoHooked) {
      const OriginalMarker = google.maps.Marker;
      google.maps.Marker = function(opts) {
        const marker = new OriginalMarker(opts);
        
        // If marker has a map, capture it!
        if (opts && opts.map && isRealGoogleMap(opts.map)) {
          console.log('📍 Captured map from Marker creation!');
          if (!google.maps.Map.__leoInstances.includes(opts.map)) {
            google.maps.Map.__leoInstances.push(opts.map);
            if (!window.__leoVibeOverlay) {
              setTimeout(() => createOverlay(opts.map), 500);
            }
          }
        }
        
        return marker;
      };
      google.maps.Marker.prototype = OriginalMarker.prototype;
      google.maps.Marker.__leoHooked = true;
      Object.keys(OriginalMarker).forEach(key => {
        try { google.maps.Marker[key] = OriginalMarker[key]; } catch(e) {}
      });
      console.log('✅ Also hooked Marker constructor');
    }
    
    // Hook OverlayView to capture map from custom overlays
    if (google.maps.OverlayView && !google.maps.OverlayView.__leoHooked) {
      const origSetMap = google.maps.OverlayView.prototype.setMap;
      if (origSetMap) {
        google.maps.OverlayView.prototype.setMap = function(map) {
          if (map && isRealGoogleMap(map)) {
            console.log('🎯 Captured map from OverlayView.setMap()!');
            if (!google.maps.Map.__leoInstances.includes(map)) {
              google.maps.Map.__leoInstances.push(map);
              if (!window.__leoVibeOverlay) {
                setTimeout(() => createOverlay(map), 500);
              }
            }
          }
          return origSetMap.call(this, map);
        };
        google.maps.OverlayView.__leoHooked = true;
        console.log('✅ Also hooked OverlayView.setMap');
      }
    }
    
    console.log('✅ Hooked into Google Maps API');
    return true;
  }
  
  function findAndInject() {
    // Stop if we already have an overlay
    if (window.__leoVibeOverlay) {
      console.log('✅ Overlay exists, stopping findAndInject');
      return;
    }
    
    retryCount++;
    console.log(`🔍 Finding map (attempt ${retryCount}/${MAX_RETRIES})...`);
    
    const map = findMapInstance();
    if (map) {
      console.log('✅ Got map instance!');
      createOverlay(map);
      return;
    }
    
    if (retryCount < MAX_RETRIES) {
      // Use longer delays as we get further
      const delay = retryCount < 5 ? 1000 : retryCount < 10 ? 2000 : 3000;
      setTimeout(findAndInject, delay);
    } else {
      console.error('❌ FAILED: Map instance not found after max retries!');
      console.error('❌ The Google Maps hook did not catch the map creation.');
      console.error('❌ This means Airbnb created the map BEFORE our hook was installed.');
      
      // Log diagnostic info
      console.log('📊 DIAGNOSTIC INFO:');
      console.log('  - google defined:', typeof google !== 'undefined');
      console.log('  - google.maps defined:', typeof google !== 'undefined' && !!google.maps);
      console.log('  - google.maps.Map hooked:', typeof google !== 'undefined' && google.maps?.Map?.__leoHooked);
      console.log('  - Hooked instances:', typeof google !== 'undefined' && google.maps?.Map?.__leoInstances?.length || 0);
      console.log('  - Early maps:', window.__leoEarlyMaps?.length || 0);
      console.log('  - .gm-style elements:', document.querySelectorAll('.gm-style').length);
      
      // Dispatch failure event
      window.dispatchEvent(new CustomEvent('leo-vibe-failed', { 
        detail: { error: 'Map instance not found - hook did not catch map creation' } 
      }));
    }
  }
  
  function findMapInstance() {
    // Detect site
    const isBooking = window.location.hostname.includes('booking.com');
    
    // Method 0: Check early hook maps (injected by content script before Google Maps loaded)
    if (window.__leoEarlyMaps && window.__leoEarlyMaps.length > 0) {
      const earlyMap = window.__leoEarlyMaps[0];
      if (isValidMapInstance(earlyMap)) {
        console.log('✅ Found VALID map via EARLY hook!');
        return earlyMap;
      }
    }
    
    // Method 1: Check hooked instances first (MOST RELIABLE)
    if (typeof google !== 'undefined' && google.maps && google.maps.Map && 
        google.maps.Map.__leoInstances && google.maps.Map.__leoInstances.length > 0) {
      const hookedMap = google.maps.Map.__leoInstances[0];
      // Use isRealGoogleMap for Booking, isValidMapInstance for others
      const checker = isBooking ? isRealGoogleMap : isValidMapInstance;
      if (checker(hookedMap)) {
        console.log('✅ Found VALID map via hooked instances');
        return hookedMap;
      }
    }
    
    // Method 1.5: BOOKING.COM SPECIFIC - use comprehensive finder
    if (isBooking) {
      const bookingMap = findBookingMap();
      if (bookingMap) {
        console.log('✅ Found VALID map via Booking.com finder');
        return bookingMap;
      }
    }
    
    // Method 2: Search divs for __gm property with VALIDATION
    const allDivs = document.querySelectorAll('div');
    for (const div of allDivs) {
      try {
        if (div.__gm && div.__gm.map) {
          if (isValidMapInstance(div.__gm.map)) {
            console.log('✅ Found VALID map via __gm on div');
            return div.__gm.map;
          }
        }
      } catch(e) {}
    }
    
    // Method 3: Look for gm-style and traverse both up AND down
    const gmStyles = document.querySelectorAll('.gm-style');
    console.log(`🔍 Found ${gmStyles.length} .gm-style elements`);
    
    for (const gmStyle of gmStyles) {
      // First check the immediate parent - often this is the map container
      const mapContainer = gmStyle.parentElement;
      if (mapContainer) {
        // Check for __gm which is where Google Maps stores the map reference
        if (mapContainer.__gm) {
          console.log('🔍 Found __gm on map container:', Object.keys(mapContainer.__gm));
          if (mapContainer.__gm.map) {
            console.log('✅ Found map via mapContainer.__gm.map!');
            return mapContainer.__gm.map;
          }
          // Sometimes it's stored directly
          if (typeof mapContainer.__gm.getCenter === 'function') {
            console.log('✅ Found map directly on mapContainer.__gm!');
            return mapContainer.__gm;
          }
          // Search deeper
          for (const key of Object.keys(mapContainer.__gm)) {
            const val = mapContainer.__gm[key];
            if (val && typeof val.getCenter === 'function') {
              console.log(`✅ Found map on mapContainer.__gm.${key}!`);
              return val;
            }
          }
        }
        
        // Also check with Object.getOwnPropertyNames for non-enumerable props
        try {
          const props = Object.getOwnPropertyNames(mapContainer);
          for (const prop of props) {
            if (prop.includes('gm') || prop.includes('map') || prop.includes('__')) {
              try {
                const val = mapContainer[prop];
                if (val && typeof val.getCenter === 'function') {
                  console.log(`✅ Found map on mapContainer[${prop}]!`);
                  return val;
                }
              } catch(e) {}
            }
          }
        } catch(e) {}
      }
      
      // Traverse UP
      let el = gmStyle;
      let depth = 0;
      while (el && el !== document.body && depth < 20) {
        try {
          if (el.__gm && el.__gm.map) {
            console.log(`✅ Found map via __gm at depth ${depth} UP`);
            return el.__gm.map;
          }
          // Also check all properties
          for (const key of Object.keys(el)) {
            try {
              if (el[key] && el[key].map && typeof el[key].map.getCenter === 'function') {
                console.log(`✅ Found map via el[${key}] at depth ${depth}`);
                return el[key].map;
              }
            } catch(e) {}
          }
        } catch(e) {}
        el = el.parentElement;
        depth++;
      }
      
      // Also traverse DOWN from gm-style
      const children = gmStyle.querySelectorAll('*');
      for (const child of children) {
        try {
          if (child.__gm && child.__gm.map) {
            console.log('✅ Found map via __gm on child of gm-style');
            return child.__gm.map;
          }
        } catch(e) {}
      }
    }
    
    // Method 4: Check window for map references
    const windowProps = ['map', 'googleMap', '__googleMap', '_map', '__leoVibeMap'];
    for (const prop of windowProps) {
      try {
        if (window[prop] && typeof window[prop].getCenter === 'function') {
          console.log(`✅ Found map on window.${prop}`);
          return window[prop];
        }
      } catch(e) {}
    }
    
    // Method 5: Try to find via React/Airbnb internals
    try {
      const reactRoot = document.querySelector('#react-application, #app-container, [data-reactroot]');
      if (reactRoot) {
        const fiberKey = Object.keys(reactRoot).find(k => k.startsWith('__reactFiber'));
        if (fiberKey) {
          console.log('🔍 Found React fiber, searching for map...');
          // Walk the fiber tree looking for map
          let fiber = reactRoot[fiberKey];
          let searchDepth = 0;
          const visited = new Set();
          const queue = [fiber];
          
          while (queue.length > 0 && searchDepth < 500) {
            const current = queue.shift();
            searchDepth++;
            if (!current || visited.has(current)) continue;
            visited.add(current);
            
            try {
              if (current.stateNode && current.stateNode.__gm && current.stateNode.__gm.map) {
                console.log('✅ Found map via React fiber stateNode');
                return current.stateNode.__gm.map;
              }
            } catch(e) {}
            
            if (current.child) queue.push(current.child);
            if (current.sibling) queue.push(current.sibling);
          }
        }
      }
    } catch(e) {
      console.log('⚠️ React search failed:', e.message);
    }
    
    // Method 6: Try to extract from existing Google Maps overlay panes
    try {
      const panes = document.querySelectorAll('[class*="gm-style-pane"], .gm-style > div > div');
      for (const pane of panes) {
        // Check if pane has __gmp (Google Maps Pane)
        if (pane.__gmp && pane.__gmp.h) {
          console.log('✅ Found map via overlay pane __gmp');
          return pane.__gmp.h;
        }
        // Check parent
        if (pane.parentElement?.__gm?.map) {
          console.log('✅ Found map via pane parent __gm');
          return pane.parentElement.__gm.map;
        }
      }
    } catch(e) {}
    
    // Method 7: Search through mapPane ancestors
    try {
      const gmStyles = document.querySelectorAll('.gm-style');
      for (const gmStyle of gmStyles) {
        // Look for the mapPane div
        const mapPane = gmStyle.querySelector('div > div > div > div');
        if (mapPane && mapPane.parentElement) {
          // Try to access __gm on various parent levels
          let parent = mapPane;
          for (let i = 0; i < 8; i++) {
            if (!parent) break;
            if (parent.__gm && parent.__gm.map) {
              console.log(`✅ Found map via mapPane ancestor level ${i}`);
              return parent.__gm.map;
            }
            // Also check gm property
            if (parent.gm && parent.gm.map) {
              console.log(`✅ Found map via gm property at level ${i}`);
              return parent.gm.map;
            }
            parent = parent.parentElement;
          }
        }
      }
    } catch(e) {}
    
    // Method 8: Try google.maps internal event listeners
    try {
      if (typeof google !== 'undefined' && google.maps && google.maps.event) {
        // Check if there are any registered listeners that might have map references
        const eventKeys = Object.keys(google.maps.event);
        console.log('🔍 Google Maps event keys:', eventKeys);
      }
    } catch(e) {}
    
    // Method 8b: REMOVED - was creating NEW maps instead of finding existing ones!
    
    // Method 8c: Look for __e3_ property which Google Maps adds to the container
    try {
      const gmStyle = document.querySelector('.gm-style');
      if (gmStyle) {
        let el = gmStyle.parentElement;
        for (let i = 0; i < 10; i++) {
          if (!el) break;
          // Look for Google Maps internal properties
          const keys = Object.getOwnPropertyNames(el);
          for (const key of keys) {
            if (key.startsWith('__e3_') || key.startsWith('gm')) {
              try {
                const val = el[key];
                console.log(`🔍 Found property ${key} on map container:`, typeof val);
                if (val && typeof val === 'object') {
                  // Search for map in this object
                  const searchQueue = [[val, key]];
                  const visited = new Set();
                  while (searchQueue.length > 0) {
                    const [obj, path] = searchQueue.shift();
                    if (!obj || visited.has(obj)) continue;
                    visited.add(obj);
                    if (visited.size > 100) break;
                    
                    if (typeof obj.getCenter === 'function' && typeof obj.getBounds === 'function') {
                      console.log(`✅ Found map in ${path}!`);
                      return obj;
                    }
                    
                    if (typeof obj === 'object') {
                      for (const k of Object.keys(obj).slice(0, 20)) {
                        try {
                          if (obj[k] && typeof obj[k] === 'object') {
                            searchQueue.push([obj[k], `${path}.${k}`]);
                          }
                        } catch(e) {}
                      }
                    }
                  }
                }
              } catch(e) {}
            }
          }
          el = el.parentElement;
        }
      }
    } catch(e) {
      console.log('⚠️ Method 8c failed:', e.message);
    }
    
    // Method 8d: Try accessing via Google Maps' internal map registry
    try {
      if (typeof google !== 'undefined' && google.maps) {
        // Google Maps sometimes stores instances in internal registries
        const checkObject = (obj, name) => {
          if (!obj) return null;
          try {
            const keys = Object.keys(obj);
            for (const key of keys) {
              try {
                const val = obj[key];
                if (val && typeof val.getCenter === 'function' && typeof val.getBounds === 'function') {
                  console.log(`✅ Found map in ${name}.${key}!`);
                  return val;
                }
                // Check for arrays of maps
                if (Array.isArray(val) && val.length > 0) {
                  for (const item of val) {
                    if (item && typeof item.getCenter === 'function') {
                      console.log(`✅ Found map in ${name}.${key}[]!`);
                      return item;
                    }
                  }
                }
              } catch(e) {}
            }
          } catch(e) {}
          return null;
        };
        
        // Check various Google Maps internal objects
        const map = checkObject(google.maps, 'google.maps') ||
                    checkObject(google.maps.Map, 'google.maps.Map') ||
                    checkObject(google.maps.event, 'google.maps.event');
        if (map) return map;
      }
    } catch(e) {}
    
    // Method 9: Deep scan ALL window properties for map-like objects
    try {
      const scanForMap = (obj, path = 'window', depth = 0) => {
        if (depth > 3) return null;
        if (!obj || typeof obj !== 'object') return null;
        
        // Check if this is a map
        if (typeof obj.getCenter === 'function' && typeof obj.getBounds === 'function') {
          console.log(`✅ Found map-like object at ${path}`);
          return obj;
        }
        
        // Recurse into properties
        for (const key of Object.keys(obj).slice(0, 50)) { // Limit to avoid infinite loops
          try {
            const val = obj[key];
            if (val && typeof val === 'object') {
              const found = scanForMap(val, `${path}.${key}`, depth + 1);
              if (found) return found;
            }
          } catch(e) {}
        }
        return null;
      };
      
      // Scan a few likely locations
      const locations = ['__NEXT_DATA__', '__REDUX_STORE__', 'Airbnb', '__airbnb'];
      for (const loc of locations) {
        if (window[loc]) {
          const map = scanForMap(window[loc], loc);
          if (map) return map;
        }
      }
    } catch(e) {}
    
    // Method 10: Check the canvas element's parent for map reference
    try {
      const canvas = document.querySelector('.gm-style canvas');
      if (canvas) {
        let el = canvas;
        for (let i = 0; i < 15; i++) {
          if (!el) break;
          // Check for any property that might be a map
          for (const key of Object.getOwnPropertyNames(el)) {
            try {
              const val = el[key];
              if (val && typeof val === 'object' && typeof val.getCenter === 'function') {
                console.log(`✅ Found map via canvas ancestor[${key}] at depth ${i}`);
                return val;
              }
            } catch(e) {}
          }
          el = el.parentElement;
        }
      }
    } catch(e) {}
    
    return null;
  }
  
  function createOverlay(map) {
    // Guard: Don't create overlay if we already have one that's working
    if (window.__leoVibeOverlay && window.__leoVibeMap === map) {
      console.log('⚠️ Overlay already exists for this map, skipping');
      return;
    }
    
    // Validate using top-level function
    if (!isValidMapInstance(map)) {
      console.log('❌ Invalid map instance, waiting for real map...');
      window.__leoVibeOverlay = null;
      return;
    }
    
    console.log('✅ Valid map instance confirmed');
    console.log('🎨 Creating vibe areas on map...');
    
    // NOTE: Cannot hide POIs on Airbnb/Booking maps because they use mapId
    // which locks styling to Google Cloud Console. This is a Google Maps API restriction.
    // See: https://developers.google.com/maps/documentation/javascript/styling#cloud_tooling
    
    // Remove existing circles
    if (vibeCircles.length > 0) {
      console.log('🔄 Removing existing circles before creating new ones');
      vibeCircles.forEach(circle => {
        try { circle.setMap(null); } catch(e) {}
      });
      vibeCircles = [];
    }
    
    // Create circles for each vibe area
    let successCount = 0;
    VIBE_AREAS.forEach(area => {
      try {
        // Try to create circle without map first, then setMap
        const circle = new google.maps.Circle({
          center: { lat: area.lat, lng: area.lng },
          radius: area.radius,
          fillColor: area.color,
          fillOpacity: 0.25,
          strokeColor: area.color,
          strokeOpacity: 0.7,
          strokeWeight: 2,
          clickable: true,
          zIndex: 1
        });
        
        // Now try to set the map
        try {
          circle.setMap(map);
          successCount++;
        } catch(setMapError) {
          console.warn(`⚠️ setMap failed for ${area.name}:`, setMapError.message);
          // Circle exists but not on map - try alternative approach
          try {
            // Try to find the actual map from the container
            const gmStyle = document.querySelector('.gm-style');
            if (gmStyle && gmStyle.parentElement && gmStyle.parentElement.__gm) {
              const realMap = gmStyle.parentElement.__gm.map || gmStyle.parentElement.__gm;
              if (realMap && typeof realMap.getCenter === 'function') {
                circle.setMap(realMap);
                successCount++;
                console.log(`✅ Used fallback map for ${area.name}`);
              }
            }
          } catch(e) {
            console.warn(`⚠️ Fallback also failed for ${area.name}`);
          }
        }
        
        // Add click handler to zoom to this area
        circle.addListener('click', () => {
          console.log(`🔍 Zooming to: ${area.name}`);
          
          // Set flag to prevent map click from dismissing immediately
          window.__leoCircleJustClicked = true;
          setTimeout(() => { window.__leoCircleJustClicked = false; }, 100);
          
          // Get the active map
          const activeMap = circle.getMap() || map;
          
          // IMMEDIATELY show persistent card (before zoom, so mouseout doesn't hide it)
          showVibeInfoCard(area.name, area, activeMap, true);
          
          // Get the circle's bounds and fit the map to them with padding
          const bounds = circle.getBounds();
          if (bounds) {
            // Try to fit bounds - use whichever map works
            try {
              map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
            } catch(e) {
              // Try with the circle's map
              if (activeMap) {
                activeMap.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
              }
            }
          }
          
          // Trigger site's search refresh after zoom completes
          triggerSearchRefresh(activeMap, area);
        });
        
        // Add hover effect - show info card and highlight
        circle.addListener('mouseover', () => {
          circle.setOptions({ fillOpacity: 0.45, strokeWeight: 3 });
          // Show info card on hover (not persistent - hides on mouseout)
          const activeMap = circle.getMap() || map;
          showVibeInfoCard(area.name, area, activeMap, false);
        });
        
        circle.addListener('mouseout', () => {
          circle.setOptions({ fillOpacity: 0.25, strokeWeight: 2 });
          // Hide info card when mouse leaves (but not persistent ones)
          hideVibeInfoCard(false);
        });
        
        vibeCircles.push(circle);
        console.log(`✅ Created circle: ${area.name} (${area.color})`);
        
      } catch(error) {
        console.error(`❌ Failed to create circle for ${area.name}:`, error.message);
      }
    });
    
    // If no circles were successfully added to map, try harder to find the real map
    if (successCount === 0) {
      console.log('⚠️ No circles on map - attempting to find real map instance...');
      tryFindRealMapAndRetry();
    } else {
      // Zoom to fit all circles on the map
      zoomToFitAllCircles(map);
    }
    
    // Helper: Zoom map to show all circles
    function zoomToFitAllCircles(targetMap) {
      if (!targetMap || vibeCircles.length === 0) return;
      
      try {
        const bounds = new google.maps.LatLngBounds();
        vibeCircles.forEach(circle => {
          const circleBounds = circle.getBounds();
          if (circleBounds) {
            bounds.extend(circleBounds.getNorthEast());
            bounds.extend(circleBounds.getSouthWest());
          }
        });
        
        // Fit with padding
        targetMap.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
        console.log('🗺️ Zoomed to fit all circles');
      } catch(e) {
        console.warn('⚠️ Could not zoom to fit circles:', e.message);
      }
    }
    
    // Helper: Try harder to find the REAL map instance
    function tryFindRealMapAndRetry() {
      console.log('🔍 Deep search for real Map instance...');
      
      // Method 1: Wait for hooked instance (may arrive late)
      const checkHooked = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps?.Map?.__leoInstances?.length > 0) {
          clearInterval(checkHooked);
          const realMap = google.maps.Map.__leoInstances[0];
          console.log('✅ Found hooked map instance!');
          applyCirclesToMap(realMap);
        }
      }, 500);
      setTimeout(() => clearInterval(checkHooked), 10000);
      
      // Method 2: Listen for map idle event on the container
      const gmStyle = document.querySelector('.gm-style');
      if (gmStyle && gmStyle.parentElement) {
        // Try to find internal Google Maps object
        const container = gmStyle.parentElement;
        const props = Object.getOwnPropertyNames(container);
        for (const prop of props) {
          try {
            const val = container[prop];
            if (val && typeof val === 'object' && val.constructor?.name === 'Map') {
              console.log(`✅ Found Map by constructor name at ${prop}`);
              applyCirclesToMap(val);
              return;
            }
          } catch(e) {}
        }
      }
      
      // Method 3: Listen for a map to be set on any of our created circles
      setTimeout(() => {
        for (const circle of vibeCircles) {
          const circleMap = circle.getMap();
          if (circleMap) {
            console.log('✅ Found map from existing circle');
            applyCirclesToMap(circleMap);
            return;
          }
        }
      }, 2000);
    }
    
    // Helper: Apply circles to a confirmed real map
    function applyCirclesToMap(realMap) {
      console.log('🎯 Applying circles to confirmed real map...');
      let applied = 0;
      for (const circle of vibeCircles) {
        try {
          if (!circle.getMap()) {
            circle.setMap(realMap);
            applied++;
          }
        } catch(e) {
          console.warn('Failed to set circle map:', e.message);
        }
      }
      console.log(`✅ Applied ${applied} circles to real map`);
    }
    
    // Detect which site we're on
    function detectSite() {
      const host = window.location.hostname;
      const path = window.location.pathname;
      if (host.includes('airbnb')) return 'airbnb';
      if (host.includes('booking.com')) return 'booking';
      if (host.includes('google.com') && path.startsWith('/maps')) return 'googlemaps';
      if (host === 'maps.google.com') return 'googlemaps';
      return 'unknown';
    }
    
    // Helper: Trigger search refresh (site-aware)
    function triggerSearchRefresh(map, area) {
      const site = detectSite();
      
      // Google Maps doesn't need refresh - we're already on the map!
      if (site === 'googlemaps') {
        console.log('🗺️ On Google Maps - no search refresh needed');
        return;
      }
      
      console.log(`🔄 Triggering ${site} search refresh...`);
      
      // Wait for fitBounds animation to complete
      setTimeout(() => {
        const bounds = map.getBounds();
        if (!bounds) {
          console.log('❌ No bounds available');
          return;
        }
        
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const zoom = map.getZoom();
        const center = map.getCenter();
        
        if (site === 'airbnb') {
          triggerAirbnbSearch(ne, sw, zoom);
        } else if (site === 'booking') {
          triggerBookingSearch(center, zoom, map);
        } else {
          // Generic fallback: just pan nudge
          map.panBy(2, 0);
          setTimeout(() => map.panBy(-2, 0), 100);
        }
        
      }, 700); // Wait for fitBounds animation
    }
    
    // Airbnb-specific search trigger
    function triggerAirbnbSearch(ne, sw, zoom) {
      const url = new URL(window.location.href);
      url.searchParams.set('ne_lat', ne.lat().toFixed(6));
      url.searchParams.set('ne_lng', ne.lng().toFixed(6));
      url.searchParams.set('sw_lat', sw.lat().toFixed(6));
      url.searchParams.set('sw_lng', sw.lng().toFixed(6));
      url.searchParams.set('zoom', zoom.toFixed(1));
      url.searchParams.set('zoom_level', zoom.toFixed(1));
      url.searchParams.set('search_by_map', 'true');
      url.searchParams.set('search_type', 'user_map_move');
      
      console.log('📍 [Airbnb] Updating URL with new bounds...');
      window.history.pushState({}, '', url.toString());
      
      // Dispatch popstate to trigger React router update
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
      
      // Find and click any search/redo button
      setTimeout(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const searchButton = buttons.find(b => {
          const text = b.textContent?.toLowerCase() || '';
          return text.includes('search') || text.includes('redo') || text.includes('update');
        });
        if (searchButton) {
          searchButton.click();
          console.log('✅ [Airbnb] Clicked search button:', searchButton.textContent?.trim());
        }
      }, 300);
    }
    
    // Booking.com-specific search trigger
    function triggerBookingSearch(center, zoom, map) {
      console.log('📍 [Booking] Triggering map search...');
      
      // Method 1: Click "Search this area" button if visible
      const searchAreaBtn = document.querySelector('[data-testid="map-trigger-search-button"]') ||
                           document.querySelector('button[aria-label*="search"]') ||
                           Array.from(document.querySelectorAll('button')).find(b => {
                             const text = b.textContent?.toLowerCase() || '';
                             return text.includes('search this area') || 
                                    text.includes('search map') ||
                                    text.includes('update results');
                           });
      
      if (searchAreaBtn) {
        searchAreaBtn.click();
        console.log('✅ [Booking] Clicked search area button');
        return;
      }
      
      // Method 2: Update URL with lat/lng (Booking uses different params)
      const url = new URL(window.location.href);
      url.searchParams.set('latitude', center.lat().toFixed(6));
      url.searchParams.set('longitude', center.lng().toFixed(6));
      url.searchParams.set('map', '1');
      
      console.log('📍 [Booking] Updating URL with coordinates...');
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
      
      // Method 3: Try to trigger map reload via Booking's global objects
      setTimeout(() => {
        // Booking.com often has a B.maps or similar global
        if (window.B && window.B.maps) {
          console.log('🔍 [Booking] Found B.maps, attempting refresh...');
        }
        
        // Trigger resize event which often refreshes map data
        window.dispatchEvent(new Event('resize'));
        
        // Pan nudge as last resort
        map.panBy(1, 0);
        setTimeout(() => map.panBy(-1, 0), 100);
        console.log('✅ [Booking] Triggered resize + pan nudge');
      }, 300);
    }
    
    // Store the current info card and listeners
    let currentInfoCard = null;
    let currentCardArea = null; // Store area for bounds checking
    let idleListener = null;
    let mapClickListener = null;
    let cardPersistent = false; // If true, card persists until explicitly dismissed
    
    // Helper: Clean up card listeners
    function cleanupCardListeners() {
      if (idleListener) {
        try { google.maps.event.removeListener(idleListener); } catch(e) {}
        idleListener = null;
      }
      if (mapClickListener) {
        try { google.maps.event.removeListener(mapClickListener); } catch(e) {}
        mapClickListener = null;
      }
    }
    
    // Helper: Navigate to prev/next area
    function navigateToArea(direction) {
      if (!currentAreasArray || currentAreasArray.length === 0) return;
      
      // Prevent rapid-fire navigation issues
      if (navigationCooldown) return;
      navigationCooldown = true;
      setTimeout(() => { navigationCooldown = false; }, 1000); // Cooldown for zoom + URL update
      
      // Calculate new index with wrap-around
      const newIndex = (currentAreaIndex + direction + currentAreasArray.length) % currentAreasArray.length;
      const newArea = currentAreasArray[newIndex];
      
      console.log(`🔀 Navigating ${direction > 0 ? 'next' : 'prev'}: ${newArea.name} (${newIndex + 1}/${currentAreasArray.length})`);
      
      // Update index
      currentAreaIndex = newIndex;
      
      // Show new card FIRST (so currentCardArea is updated before zoom)
      cardPersistent = false;
      showVibeInfoCard(newArea.name, newArea, currentMapRef, true);
      
      // Then zoom to new area
      if (currentMapRef && vibeCircles[newIndex]) {
        const bounds = vibeCircles[newIndex].getBounds();
        if (bounds) {
          currentMapRef.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
        }
      }
      
      // Update URL so Airbnb/Booking doesn't bounce back to previous location
      triggerSearchRefresh(currentMapRef, newArea);
    }
    
    // Helper: Show info card when clicking/hovering an area
    // persistent = true means card stays until pan (for click)
    // persistent = false means card hides on mouseout (for hover)
    function showVibeInfoCard(name, area, activeMap, persistent = false) {
      // If there's a persistent card showing, don't replace it with hover card
      if (cardPersistent && !persistent) {
        return;
      }
      
      // Cancel any pending removal and remove existing card
      if (cardRemovalTimeout) {
        clearTimeout(cardRemovalTimeout);
        cardRemovalTimeout = null;
      }
      // Remove existing card (respects cardPersistent flag)
      hideVibeInfoCard();
      
      // Find the map container to position the card inside it
      const gmStyle = document.querySelector('.gm-style');
      const mapContainer = gmStyle ? gmStyle.parentElement : null;
      
      // Helper: Build Google Maps search URL
      function buildMapsSearchUrl(query, lat, lng, zoom = 16) {
        const encodedQuery = encodeURIComponent(query).replace(/%20/g, '+');
        return `https://www.google.com/maps/search/${encodedQuery}/@${lat},${lng},${zoom}z`;
      }
      
      // Helper: Build TikTok search URL (includes area name for context)
      function buildTikTokSearchUrl(query, areaName) {
        const fullQuery = `${query} ${areaName}`;
        const encodedQuery = encodeURIComponent(fullQuery);
        return `https://www.tiktok.com/search?q=${encodedQuery}`;
      }
      
      // Get description - support both 'why' (AI) and 'vibes' (default) formats
      let description = '';
      let itineraryHtml = '';
      let groundedBadge = '';
      
      if (area.why) {
        // AI-generated description (short, 140 chars)
        description = `<div style="font-size: 13px; opacity: 0.9; line-height: 1.4;">${area.why}</div>`;
        
        // Show itinerary with Google Maps + TikTok links
        if (area.itinerary && area.itinerary.length > 0) {
          itineraryHtml = `
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.15);">
              <div style="font-size: 11px; opacity: 0.6; margin-bottom: 8px;">🗺️ Suggested itinerary:</div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${area.itinerary.map(item => `
                  <div style="
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    padding: 10px 12px;
                    background: rgba(255,255,255,0.06);
                    border-radius: 10px;
                  ">
                    <div style="font-size: 13px; font-weight: 500;">${item.purpose}</div>
                    <div style="display: flex; gap: 6px;">
                      <a href="${buildMapsSearchUrl(item.query, area.lat, area.lng)}" 
                         target="_blank" 
                         rel="noopener noreferrer"
                         style="
                           display: flex;
                           align-items: center;
                           gap: 4px;
                           padding: 5px 10px;
                           background: rgba(66, 133, 244, 0.25);
                           border-radius: 6px;
                           text-decoration: none;
                           color: #93c5fd;
                           font-size: 11px;
                           transition: background 0.2s;
                         "
                         onmouseover="this.style.background='rgba(66, 133, 244, 0.4)'"
                         onmouseout="this.style.background='rgba(66, 133, 244, 0.25)'"
                      >
                        <span>📍</span>
                        <span>Maps</span>
                      </a>
                      <a href="${buildTikTokSearchUrl(item.query, area.name)}" 
                         target="_blank" 
                         rel="noopener noreferrer"
                         style="
                           display: flex;
                           align-items: center;
                           gap: 4px;
                           padding: 5px 10px;
                           background: rgba(255, 0, 80, 0.2);
                           border-radius: 6px;
                           text-decoration: none;
                           color: #ff6b9d;
                           font-size: 11px;
                           transition: background 0.2s;
                         "
                         onmouseover="this.style.background='rgba(255, 0, 80, 0.35)'"
                         onmouseout="this.style.background='rgba(255, 0, 80, 0.2)'"
                      >
                        <span>🎵</span>
                        <span>TikTok</span>
                      </a>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        } else if (area.places && area.places.length > 0) {
          // Fallback to places if no itinerary (backwards compat)
          itineraryHtml = `
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.15);">
              <div style="font-size: 11px; opacity: 0.6; margin-bottom: 6px;">📍 Places to check out:</div>
              <div style="font-size: 12px; opacity: 0.9;">
                ${area.places.map(p => `<span style="
                  display: inline-block;
                  background: rgba(255,255,255,0.12);
                  padding: 3px 10px;
                  border-radius: 12px;
                  margin: 2px 4px 2px 0;
                ">${p}</span>`).join('')}
              </div>
            </div>
          `;
        }
        
        // Show grounding indicator
        if (area.grounded) {
          groundedBadge = `<span style="
            display: inline-block;
            background: rgba(52, 211, 153, 0.25);
            color: #34d399;
            padding: 2px 8px;
            border-radius: 8px;
            font-size: 10px;
            margin-left: 8px;
          ">🔍 Web verified</span>`;
        }
      } else if (area.vibes && Array.isArray(area.vibes)) {
        // Default vibes badges
        description = `<div style="font-size: 13px; opacity: 0.85; line-height: 1.4;">
          ${area.vibes.map(v => `<span style="
            display: inline-block;
            background: rgba(255,255,255,0.15);
            padding: 2px 8px;
            border-radius: 12px;
            margin: 2px 4px 2px 0;
            font-size: 12px;
          ">${v}</span>`).join('')}
        </div>`;
      }
      
      // Find current area index
      const areaIndex = currentAreasArray.findIndex(a => a.name === area.name);
      if (areaIndex >= 0) currentAreaIndex = areaIndex;
      
      // Navigation footer (only for persistent cards with multiple areas)
      const showNav = persistent && currentAreasArray.length > 1;
      const navFooter = showNav ? `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
          <button id="leo-nav-prev" style="
            background: rgba(255,255,255,0.1);
            border: none;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
          " aria-label="Previous area">←</button>
          <span style="font-size: 11px; opacity: 0.5;">${currentAreaIndex + 1} / ${currentAreasArray.length}</span>
          <button id="leo-nav-next" style="
            background: rgba(255,255,255,0.1);
            border: none;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
          " aria-label="Next area">→</button>
        </div>
      ` : `
        <div style="font-size: 11px; opacity: 0.6; margin-top: 10px; text-align: center;">
          ${persistent ? 'Pan the map to dismiss' : 'Click to zoom in'}
        </div>
      `;
      
      // Create the info card
      const card = document.createElement('div');
      card.id = 'leo-vibe-info-card';
      card.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <div style="
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: ${area.color};
            opacity: 0.8;
            flex-shrink: 0;
          "></div>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 16px; margin-bottom: 6px;">📍 ${name}${groundedBadge}</div>
            ${description}
          </div>
          <button id="leo-card-close" style="
            background: none;
            border: none;
            color: white;
            opacity: 0.6;
            cursor: pointer;
            font-size: 18px;
            padding: 0;
            line-height: 1;
          " aria-label="Close">×</button>
        </div>
        ${itineraryHtml}
        ${navFooter}
      `;
      
      card.style.cssText = `
        position: absolute;
        bottom: 20px;
        left: 20px;
        background: rgba(0, 0, 0, 0.92);
        color: white;
        padding: 16px 18px;
        border-radius: 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 4px 24px rgba(0,0,0,0.4);
        z-index: 1000;
        width: 320px;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.25s ease;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      `;
      
      // Append to map container if possible, otherwise to body
      if (mapContainer && mapContainer.style.position !== 'static') {
        mapContainer.style.position = 'relative';
        mapContainer.appendChild(card);
      } else if (gmStyle) {
        gmStyle.style.position = 'relative';
        gmStyle.appendChild(card);
      } else {
        // Fallback: position fixed in viewport
        card.style.position = 'fixed';
        document.body.appendChild(card);
      }
      
      currentInfoCard = card;
      cardPersistent = persistent;
      currentCardArea = area; // Store area for bounds checking
      
      // Animate in
      requestAnimationFrame(() => {
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      });
      
      // Close button handler
      const closeBtn = card.querySelector('#leo-card-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          hideVibeInfoCard(true); // Force hide
        });
      }
      
      // Navigation button handlers (only for persistent cards)
      if (persistent) {
        currentMapRef = activeMap; // Store map reference for navigation
        
        const prevBtn = card.querySelector('#leo-nav-prev');
        const nextBtn = card.querySelector('#leo-nav-next');
        
        if (prevBtn) {
          prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateToArea(-1);
          });
          prevBtn.addEventListener('mouseenter', () => {
            prevBtn.style.background = 'rgba(255,255,255,0.2)';
          });
          prevBtn.addEventListener('mouseleave', () => {
            prevBtn.style.background = 'rgba(255,255,255,0.1)';
          });
        }
        
        if (nextBtn) {
          nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateToArea(1);
          });
          nextBtn.addEventListener('mouseenter', () => {
            nextBtn.style.background = 'rgba(255,255,255,0.2)';
          });
          nextBtn.addEventListener('mouseleave', () => {
            nextBtn.style.background = 'rgba(255,255,255,0.1)';
          });
        }
      }
      
      // Set up listeners for persistent cards
      if (persistent && activeMap && typeof activeMap.addListener === 'function') {
        // Remove previous listeners
        cleanupCardListeners();
        
        // Listen for map 'idle' event (fires after pan/zoom completes)
        // Check if circle is still visible - if not, hide card
        idleListener = activeMap.addListener('idle', () => {
          // Skip during navigation cooldown (prevents false "out of view" during zoom)
          if (navigationCooldown) return;
          
          if (currentInfoCard && cardPersistent && currentCardArea) {
            const bounds = activeMap.getBounds();
            if (bounds) {
              const circleCenter = new google.maps.LatLng(currentCardArea.lat, currentCardArea.lng);
              if (!bounds.contains(circleCenter)) {
                console.log('📍 Circle out of view - hiding card');
                hideVibeInfoCard(true);
              }
            }
          }
        });
        
        // Listen for clicks on empty map area to dismiss
        mapClickListener = activeMap.addListener('click', (e) => {
          // Small delay to let circle click handler fire first
          setTimeout(() => {
            // Don't hide if a circle was just clicked
            if (window.__leoCircleJustClicked) return;
            
            if (currentInfoCard && cardPersistent) {
              console.log('🗺️ Map clicked - hiding card');
              hideVibeInfoCard(true);
            }
          }, 50);
        });
      }
    }
    
    // Track removal timeout so we can cancel it
    let cardRemovalTimeout = null;
    
    // Helper: Hide info card (force = true to ignore persistent flag)
    function hideVibeInfoCard(force = false) {
      // Don't hide persistent card unless forced
      if (cardPersistent && !force) {
        return;
      }
      
      // Cancel any pending removal
      if (cardRemovalTimeout) {
        clearTimeout(cardRemovalTimeout);
        cardRemovalTimeout = null;
      }
      
      if (currentInfoCard) {
        const cardToRemove = currentInfoCard; // Capture reference
        currentInfoCard = null; // Clear immediately to prevent race conditions
        
        cardToRemove.style.opacity = '0';
        cardToRemove.style.transform = 'translateY(10px)';
        cardRemovalTimeout = setTimeout(() => {
          cardToRemove.remove();
          cardRemovalTimeout = null;
        }, 250);
      }
      
      cardPersistent = false;
      currentCardArea = null;
      
      // Clean up listeners
      cleanupCardListeners();
    }
    
    
    // Mark as created and expose functions for external access
    window.__leoVibeOverlay = { 
      circles: vibeCircles,
      setOpacity: (opacity) => {
        vibeCircles.forEach(c => c.setOptions({ fillOpacity: opacity * 0.4, strokeOpacity: opacity }));
      },
      setMap: (map) => {
        vibeCircles.forEach(c => c.setMap(map));
      },
      // Expose functions for AI area updates
      showVibeInfoCard,
      hideVibeInfoCard,
      navigateToArea
    };
    window.__leoVibeMap = map;
    currentMapRef = map; // Store for navigation
    
    console.log(`✅ Created ${vibeCircles.length} vibe area circles!`);
    
    // Dispatch success event
    window.dispatchEvent(new CustomEvent('leo-vibe-injected', { 
      detail: { success: true, areas: VIBE_AREAS.length } 
    }));
  }
  
  // Listen for vibe changes (circles don't need image updates, but keep for future)
  window.addEventListener('leo-vibe-change', (e) => {
    console.log('🔄 Vibe change event received');
    // Circles are static for now - future: filter by vibe type
  });
  
  // Listen for toggle
  window.addEventListener('leo-vibe-toggle', () => {
    if (window.__leoVibeOverlay) {
      // Toggle visibility
      if (!window.__leoVibeAreasVisible) {
        window.__leoVibeAreasVisible = true;
      }
      window.__leoVibeAreasVisible = !window.__leoVibeAreasVisible;
      window.__leoVibeOverlay.setOpacity(window.__leoVibeAreasVisible ? 1 : 0);
      console.log('👁️ Vibe areas visibility:', window.__leoVibeAreasVisible);
    }
  });
  
  // Listen for area updates (AI-generated areas)
  window.addEventListener('leo-vibe-update-areas', (e) => {
    const newAreas = e.detail?.areas;
    if (!newAreas || !Array.isArray(newAreas)) {
      console.error('❌ Invalid areas in update event');
      return;
    }
    
    console.log('🔄 Updating vibe areas with AI-generated areas:', newAreas.length);
    
    // Update the areas array reference for navigation
    currentAreasArray = newAreas;
    currentAreaIndex = 0;
    
    // Remove existing circles
    if (vibeCircles.length > 0) {
      vibeCircles.forEach(circle => {
        try { circle.setMap(null); } catch(e) {}
      });
      vibeCircles = [];
    }
    
    // Get the current map
    const map = window.__leoVibeMap;
    if (!map) {
      console.error('❌ No map available for area update');
      return;
    }
    
    // Store map ref for navigation
    currentMapRef = map;
    
    // Create new circles for each area
    newAreas.forEach(area => {
      try {
        const circle = new google.maps.Circle({
          center: { lat: area.lat, lng: area.lng },
          radius: area.radius || 400,
          fillColor: area.color,
          fillOpacity: 0.25,
          strokeColor: area.color,
          strokeOpacity: 0.7,
          strokeWeight: 2,
          clickable: true,
          zIndex: 1
        });
        
        circle.setMap(map);
        
        // Add click handler - show PERSISTENT card immediately
        circle.addListener('click', () => {
          console.log(`🔍 [AI] Zooming to: ${area.name}`);
          
          // Set flag to prevent map click from dismissing immediately
          window.__leoCircleJustClicked = true;
          setTimeout(() => { window.__leoCircleJustClicked = false; }, 100);
          
          // IMMEDIATELY show persistent card (before zoom)
          if (window.__leoVibeOverlay?.showVibeInfoCard) {
            window.__leoVibeOverlay.showVibeInfoCard(area.name, area, map, true);
          }
          
          const bounds = circle.getBounds();
          if (bounds) {
            map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
          }
          
          // Trigger search refresh so Airbnb/Booking doesn't bounce back
          if (window.__leoVibeOverlay?.triggerSearchRefresh) {
            window.__leoVibeOverlay.triggerSearchRefresh(map, area);
          }
        });
        
        // Add hover effect - show NON-persistent card
        circle.addListener('mouseover', () => {
          circle.setOptions({ fillOpacity: 0.45, strokeWeight: 3 });
          if (window.__leoVibeOverlay?.showVibeInfoCard) {
            window.__leoVibeOverlay.showVibeInfoCard(area.name, area, map, false);
          }
        });
        
        circle.addListener('mouseout', () => {
          circle.setOptions({ fillOpacity: 0.25, strokeWeight: 2 });
          // Only hide non-persistent cards
          if (window.__leoVibeOverlay?.hideVibeInfoCard) {
            window.__leoVibeOverlay.hideVibeInfoCard(false);
          }
        });
        
        vibeCircles.push(circle);
        console.log(`✅ Created AI circle: ${area.name} (${area.color})`);
        
      } catch(error) {
        console.error(`❌ Failed to create circle for ${area.name}:`, error);
      }
    });
    
    // Update the overlay reference - PRESERVE existing functions!
    const existingOverlay = window.__leoVibeOverlay || {};
    window.__leoVibeOverlay = {
      ...existingOverlay, // Preserve showVibeInfoCard, hideVibeInfoCard, navigateToArea, triggerSearchRefresh
      circles: vibeCircles,
      setOpacity: (opacity) => {
        vibeCircles.forEach(c => c.setOptions({ fillOpacity: opacity * 0.4, strokeOpacity: opacity }));
      },
      setMap: (map) => {
        vibeCircles.forEach(c => c.setMap(map));
      }
    };
    
    console.log(`✅ Updated to ${vibeCircles.length} AI-generated circles!`);
    
    // Zoom to fit all AI-generated circles
    if (vibeCircles.length > 0) {
      try {
        const bounds = new google.maps.LatLngBounds();
        vibeCircles.forEach(circle => {
          const circleBounds = circle.getBounds();
          if (circleBounds) {
            bounds.extend(circleBounds.getNorthEast());
            bounds.extend(circleBounds.getSouthWest());
          }
        });
        
        // Fit with padding
        map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
        console.log('🗺️ Zoomed to fit all AI circles');
      } catch(e) {
        console.warn('⚠️ Could not zoom to fit AI circles:', e.message);
      }
    }
  });
  
  // Initialize visibility state
  window.__leoVibeAreasVisible = true;
  
  // ============================================
  // NOTE: Listing filtering code has been removed for simplicity.
  // See docs/VIBE_AREAS.md "Parked Features" section for the 
  // full filtering implementation if needed in the future.
  // ============================================
  
  // Watch for map container appearing in DOM
  function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          
          // Check if this is a map container or contains one
          const gmStyle = node.classList?.contains('gm-style') ? node : node.querySelector?.('.gm-style');
          if (gmStyle && !window.__leoVibeOverlay) {
            console.log('🔍 Map container detected via MutationObserver!');
            
            // First try to find map directly (only once)
            setTimeout(() => {
              if (window.__leoVibeOverlay) return; // Already done
              
              const map = findMapInstance();
              if (map) {
                console.log('✅ Found map after DOM mutation!');
                createOverlay(map);
              }
            }, 500);
          }
        }
      }
    });
    
    // Wait for document.body to exist before observing
    const startObserving = () => {
      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        console.log('👀 MutationObserver watching for map containers');
      } else {
        // Try again when body exists
        setTimeout(startObserving, 50);
      }
    };
    startObserving();
  }
  
  // Periodic check for map (catches desktop lazy-loaded maps)
  function setupPeriodicMapCheck() {
    let checkCount = 0;
    const maxChecks = 30; // Check for up to 60 seconds
    
    const checker = setInterval(() => {
      checkCount++;
      
      if (window.__leoVibeOverlay) {
        console.log('✅ Overlay already exists, stopping periodic check');
        clearInterval(checker);
        return;
      }
      
      // Try to find map (only if we don't have overlay yet)
      const map = findMapInstance();
      if (map && !window.__leoVibeOverlay) {
        console.log('✅ Found map via periodic check!');
        createOverlay(map);
        clearInterval(checker);
        return;
      }
      
      // Also check if there's a visible .gm-style container we can work with
      const gmStyles = document.querySelectorAll('.gm-style');
      for (const gmStyle of gmStyles) {
        if (gmStyle.offsetWidth > 100 && gmStyle.offsetHeight > 100) {
          // This is a visible map container, try harder to find the map
          console.log(`🔍 Periodic check ${checkCount}: Found visible map container ${gmStyle.offsetWidth}x${gmStyle.offsetHeight}`);
          
          // Try to find map in parent hierarchy
          let el = gmStyle.parentElement;
          for (let i = 0; i < 10; i++) {
            if (!el) break;
            try {
              // Check ALL properties of each element
              for (const key of Object.getOwnPropertyNames(el)) {
                try {
                  const val = el[key];
                  if (val && typeof val === 'object' && typeof val.getCenter === 'function') {
                    console.log(`✅ Found map on element property ${key} via periodic check!`);
                    createOverlay(val);
                    clearInterval(checker);
                    return;
                  }
                } catch(e) {}
              }
            } catch(e) {}
            el = el.parentElement;
          }
        }
      }
      
      // After 3 checks (6 seconds), try to trigger map refresh
      if (checkCount === 3 && !window.__leoVibeOverlay) {
        console.warn('⏱️ 6s elapsed, still no map instance found');
        console.warn('📊 Hook status: hooked =', typeof google !== 'undefined' && google.maps?.Map?.__leoHooked);
        console.warn('📊 Instances:', typeof google !== 'undefined' && google.maps?.Map?.__leoInstances?.length || 0);
        triggerMapRefresh();
      }
      
      // At 5 checks (10 seconds), try again with refresh
      if (checkCount === 5 && !window.__leoVibeOverlay) {
        console.log('⏱️ 10s elapsed, trying map refresh again...');
        triggerMapRefresh();
      }
      
      if (checkCount >= maxChecks) {
        console.log('⏱️ Periodic map check timed out after 60s');
        clearInterval(checker);
      }
    }, 2000);
    
    console.log('⏰ Periodic map check started (every 2s for 60s)');
  }
  
  // Setup click listener on map container to find map after user interaction
  function setupMapClickFinder() {
    document.addEventListener('click', (e) => {
      if (window.__leoVibeOverlay) return; // Already have overlay
      
      // Check if click was in or near a map container
      const gmStyle = e.target.closest('.gm-style');
      if (gmStyle) {
        console.log('🖱️ Click detected in map area, searching for map...');
        
        setTimeout(() => {
          const map = findMapInstance();
          if (map) {
            console.log('✅ Found map after click interaction!');
            createOverlay(map);
          }
        }, 500);
      }
    }, { capture: true });
    
    console.log('🖱️ Click-based map finder active');
  }
  
  // Also try to find map on scroll/zoom in map area
  function setupMapScrollFinder() {
    let lastScrollTime = 0;
    
    document.addEventListener('wheel', (e) => {
      if (window.__leoVibeOverlay) return;
      
      const now = Date.now();
      if (now - lastScrollTime < 2000) return; // Debounce
      lastScrollTime = now;
      
      const gmStyle = e.target.closest('.gm-style');
      if (gmStyle) {
        console.log('🔄 Scroll detected in map area, searching for map...');
        
        setTimeout(() => {
          const map = findMapInstance();
          if (map) {
            console.log('✅ Found map after scroll interaction!');
            createOverlay(map);
          }
        }, 500);
      }
    }, { capture: true, passive: true });
    
    console.log('🔄 Scroll-based map finder active');
  }
  
  // Try to force map recreation by triggering a tiny pan
  function triggerMapRefresh() {
    console.log('🔄 Attempting to trigger map refresh...');
    
    // Find the map container and dispatch events to trigger map recreation
    const gmStyle = document.querySelector('.gm-style');
    if (!gmStyle) {
      console.log('❌ No .gm-style found for refresh trigger');
      return false;
    }
    
    // Try clicking the map area to trigger any lazy initialization
    const rect = gmStyle.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Dispatch mouse events
    const events = ['mouseenter', 'mousemove', 'mousedown', 'mouseup'];
    events.forEach(eventType => {
      const event = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: centerX,
        clientY: centerY
      });
      gmStyle.dispatchEvent(event);
    });
    
    // Also try triggering resize which often recreates map
    window.dispatchEvent(new Event('resize'));
    
    console.log('✅ Map refresh events dispatched');
    return true;
  }

  // Start initialization - IMMEDIATELY try to hook Google Maps
  function init() {
    // Start polling for Google Maps API immediately - don't wait!
    let attempts = 0;
    const pollInterval = 10; // Check every 10ms - SUPER aggressive hooking
    
    const tryHook = () => {
      attempts++;
      
      // Try to hook if Google Maps is available
      if (typeof google !== 'undefined' && google.maps && google.maps.Map) {
        if (!google.maps.Map.__leoHooked) {
          console.log('✅ Google Maps API found! Hooking...');
          hookGoogleMaps();
        }
      }
      
      // Keep polling even after hooking to catch late initialization
      if (attempts < 3000) { // Poll for 30 seconds (3000 * 10ms)
        setTimeout(tryHook, pollInterval);
      }
    };
    
    // Start polling immediately
    tryHook();
    
    // Wait for DOM ready to set up other finders
    const initWhenReady = () => {
      if (document.body) {
        setupMutationObserver();
        setupPeriodicMapCheck();
        setupMapClickFinder();
        setupMapScrollFinder();
        
        // For Booking.com: Set up continuous watcher
        setupBookingMapWatcher();
        
        // Start looking for map instance
        setTimeout(findAndInject, 1000);
        
        // If no overlay after 5 seconds, try triggering refresh
        setTimeout(() => {
          if (!window.__leoVibeOverlay) {
            console.log('⏰ No overlay after 5s, trying to trigger map refresh...');
            triggerMapRefresh();
          }
        }, 5000);
        
        // If still no overlay after 8 seconds, try again
        setTimeout(() => {
          if (!window.__leoVibeOverlay) {
            console.log('⏰ No overlay after 8s, trying refresh again...');
            triggerMapRefresh();
            // Re-run findAndInject
            setTimeout(findAndInject, 500);
          }
        }, 8000);
      } else {
        setTimeout(initWhenReady, 50);
      }
    };
    
    initWhenReady();
  }
  
  // Listen for maps created by early hook
  window.addEventListener('leo-map-created', (e) => {
    console.log('📡 Received leo-map-created event in injected script');
    if (!window.__leoVibeOverlay && e.detail?.map) {
      console.log('🎨 Creating overlay for newly created map...');
      setTimeout(() => createOverlay(e.detail.map), 500);
    }
  });

  init();
  
  } // End of initVibeOverlay function
  
  // Initialize immediately since we've already confirmed activation
  initVibeOverlay();

})();
