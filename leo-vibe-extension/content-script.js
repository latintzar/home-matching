/**
 * Leo Vibe Maps - Content Script
 * Shows activation popup and injects vibe circles on user request
 */

(function() {
  'use strict';

  console.log('🌈 Leo Vibe Maps: Content script loaded on', window.location.href);

  // State
  let isInjected = false;
  let isActivated = false;

  /**
   * Detect city from URL
   */
  function detectCity() {
    const url = window.location.href.toLowerCase();
    if (url.includes('barcelona')) return 'barcelona';
    if (url.includes('lisbon') || url.includes('lisboa')) return 'lisbon';
    if (url.includes('madrid')) return 'madrid';
    if (url.includes('london')) return 'london';
    if (url.includes('paris')) return 'paris';
    return 'barcelona';
  }

  /**
   * Check if we're on a supported search page
   */
  function isSearchPage() {
    const host = window.location.hostname;
    const path = window.location.pathname;
    
    if (host.includes('airbnb') && path.includes('/s/')) return true;
    if (host.includes('booking.com') && path.includes('searchresults')) return true;
    // Google Maps - matches /maps, /maps/, /maps/search, /maps/place, etc.
    if (host.includes('google.com') && (path.startsWith('/maps') || path === '/maps')) return true;
    if (host === 'maps.google.com') return true;
    
    return false;
  }

  /**
   * Inject external script into main world
   * @param {Array|null} customAreas - Optional AI-generated areas to use instead of defaults
   */
  function injectMainWorldScript(customAreas = null) {
    // If already injected, dispatch event to update areas instead
    if (isInjected && customAreas) {
      console.log('🔄 Updating existing overlay with custom areas...');
      window.dispatchEvent(new CustomEvent('leo-vibe-update-areas', {
        detail: { areas: customAreas }
      }));
      return;
    }
    
    if (isInjected) return;
    
    const city = detectCity();
    const bounds = {
      south: 41.32,
      west: 2.02,
      north: 41.47,
      east: 2.23
    };
    
    console.log(`🚀 Injecting vibe script for ${city}...`);
    if (customAreas) {
      console.log('📦 With custom AI-generated areas:', customAreas.length);
    }
    
    // Remove existing script and reset state
    const existing = document.getElementById('leo-vibe-injected-script');
    if (existing) {
      existing.remove();
      window.__leoVibeInitialized = false;
      window.__leoVibeOverlay = null;
    }
    
    // Create script element
    const script = document.createElement('script');
    script.id = 'leo-vibe-injected-script';
    script.src = chrome.runtime.getURL('injected-script.js');
    script.dataset.bounds = JSON.stringify(bounds);
    script.dataset.activated = 'true'; // Mark as user-activated
    
    // Pass custom areas if provided
    if (customAreas) {
      script.dataset.customAreas = JSON.stringify(customAreas);
    }
    
    script.onload = () => {
      console.log('✅ Vibe script loaded!');
      isInjected = true;
    };
    
    script.onerror = (e) => {
      console.error('❌ Failed to load vibe script:', e);
    };
    
    (document.head || document.documentElement).appendChild(script);
  }

  /**
   * Show activation popup (top-right, like Honey)
   * Only shows if circles are NOT already visible
   */
  function showActivationPopup() {
    // Don't show if already injected
    if (isInjected) {
      console.log('⏭️ Skipping popup - already injected');
      return;
    }
    
    // Don't show if circles are already on the page (check SVG circles in map)
    const mapCircles = document.querySelectorAll('.gm-style circle, .gm-style path[fill-opacity]');
    if (mapCircles.length > 0) {
      console.log('⏭️ Skipping popup - circles already visible');
      isInjected = true; // Mark as injected
      return;
    }
    
    // Don't show if popup already exists
    if (document.getElementById('leo-activation-popup')) {
      return;
    }
    
    // Remove existing popup
    const existing = document.getElementById('leo-activation-popup');
    if (existing) existing.remove();
    
    const popup = document.createElement('div');
    popup.id = 'leo-activation-popup';
    popup.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        ">🗺️</div>
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 14px; color: #1a1a1a;">Leo Vibe Maps</div>
          <div style="font-size: 12px; color: #666; margin-top: 2px;">Discover neighborhood vibes</div>
        </div>
        <button id="leo-dismiss-btn" style="
          background: none;
          border: none;
          color: #999;
          font-size: 18px;
          cursor: pointer;
          padding: 4px;
          line-height: 1;
        " aria-label="Close">×</button>
      </div>
      <button id="leo-activate-btn" style="
        width: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 12px;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
      ">
        ✨ Show Vibe Areas
      </button>
    `;
    
    popup.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: white;
      padding: 16px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
      z-index: 2147483647;
      width: 280px;
      opacity: 0;
      transform: translateX(20px);
      transition: all 0.3s ease;
    `;
    
    document.body.appendChild(popup);
    
    // Animate in
    requestAnimationFrame(() => {
      popup.style.opacity = '1';
      popup.style.transform = 'translateX(0)';
    });
    
    // Activate button
    const activateBtn = popup.querySelector('#leo-activate-btn');
    activateBtn.addEventListener('mouseenter', () => {
      activateBtn.style.transform = 'translateY(-1px)';
      activateBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    });
    activateBtn.addEventListener('mouseleave', () => {
      activateBtn.style.transform = 'translateY(0)';
      activateBtn.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
    });
    
    activateBtn.addEventListener('click', () => {
      console.log('🚀 User activated Leo Vibe Maps!');
      isActivated = true;
      // NOTE: isInjected is set in injectMainWorldScript's onload handler
      
      // Close popup
      popup.style.opacity = '0';
      popup.style.transform = 'translateX(20px)';
      setTimeout(() => popup.remove(), 300);
      
      // Inject the script to show circles
      injectMainWorldScript();
    });
    
    // Dismiss button
    const dismissBtn = popup.querySelector('#leo-dismiss-btn');
    dismissBtn.addEventListener('click', () => {
      popup.style.opacity = '0';
      popup.style.transform = 'translateX(20px)';
      setTimeout(() => popup.remove(), 300);
    });
  }

  /**
   * Initialize
   */
  function initialize() {
    console.log('🚀 Leo Vibe Maps: Initializing...');

    // Listen for injection success
    window.addEventListener('leo-vibe-injected', () => {
      console.log('✅ Vibe areas injected successfully!');
      isInjected = true;
    });

    // ALWAYS show popup on search pages - user must click to enable
    if (isSearchPage()) {
      // Wait for page to settle, then show popup
      setTimeout(showActivationPopup, 1500);
    }

    // Re-check on URL changes (SPA navigation)
    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('🔄 URL changed');
        
        // Only show popup on new page if not already activated
        if (isSearchPage() && !isInjected) {
          setTimeout(showActivationPopup, 1500);
        }
      }
    }, 1000);
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Received message:', message.action);
    
    switch (message.action) {
      case 'getStatus':
        sendResponse({
          isInjected: isInjected,
          isActivated: isActivated,
          city: detectCity()
        });
        break;
        
      case 'activate':
        // Activate with default areas
        sessionStorage.setItem('leoVibeActivated', 'true');
        isActivated = true;
        injectMainWorldScript(null); // null = use default areas
        sendResponse({ success: true });
        break;
        
      case 'activateWithAreas':
        // Activate with AI-generated custom areas
        console.log('🎯 Activating with custom AI areas:', message.areas?.length);
        sessionStorage.setItem('leoVibeActivated', 'true');
        isActivated = true;
        isInjected = false; // Reset to force re-injection with new areas
        window.__leoVibeInitialized = false; // Reset injected script state
        injectMainWorldScript(message.areas);
        sendResponse({ success: true });
        break;
        
      case 'toggle':
        window.dispatchEvent(new CustomEvent('leo-vibe-toggle'));
        sendResponse({ success: true });
        break;
    }
    
    return true;
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
