// Google Maps List Saver - Content Script
// This script runs on Google Maps and automates the save process

console.log('🗺️ Maps List Saver content script loaded on:', window.location.href);

// Prevent duplicate injection
if (window.__gmapsListSaverLoaded) {
  console.log('Content script already loaded, skipping...');
} else {
  window.__gmapsListSaverLoaded = true;
}

let automationState = {
  active: false,
  place: null,
  listName: '',
  isFirstPlace: false
};

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Content script received message:', message.action);
  
  if (message.action === 'startAutomation') {
    console.log('📍 Starting automation for:', message.place.name);
    console.log('📍 Place details:', message.place);
    console.log('📍 Current URL:', window.location.href);
    
    automationState = {
      active: true,
      place: message.place,
      listName: message.listName,
      isFirstPlace: message.isFirstPlace,
      totalPlaces: message.totalPlaces,
      currentIndex: message.currentIndex
    };
    
    startAutomation();
    sendResponse({ received: true });
  }
  
  if (message.action === 'ping') {
    console.log('📡 Ping received, responding...');
    sendResponse({ pong: true, url: window.location.href });
  }
  
  return true;
});

// Watch for URL changes (Google Maps is an SPA)
let lastUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    console.log('🔄 URL changed:', lastUrl, '->', window.location.href);
    lastUrl = window.location.href;
    
    // Re-notify background that we're still here
    try {
      chrome.runtime.sendMessage({ action: 'contentReady', url: window.location.href });
    } catch (e) {
      console.log('Could not send contentReady on URL change');
    }
  }
});

// Start observing
urlObserver.observe(document.body, { childList: true, subtree: true });

// Also use History API hooks
const originalPushState = history.pushState;
history.pushState = function(...args) {
  originalPushState.apply(this, args);
  console.log('🔄 pushState detected, new URL:', window.location.href);
  lastUrl = window.location.href;
};

const originalReplaceState = history.replaceState;
history.replaceState = function(...args) {
  originalReplaceState.apply(this, args);
  console.log('🔄 replaceState detected, new URL:', window.location.href);
  lastUrl = window.location.href;
};

window.addEventListener('popstate', () => {
  console.log('🔄 popstate detected, new URL:', window.location.href);
  lastUrl = window.location.href;
});

// Notify background that we're ready
console.log('📤 Sending contentReady to background...');

// Main automation function
const startAutomation = async () => {
  try {
    showOverlay(`Saving "${automationState.place.name}" (${automationState.currentIndex + 1}/${automationState.totalPlaces})...`);
    
    // Step 1: Check if we're on search results or a place page
    await sleep(2000); // Wait for page to settle
    
    // Check if we need to click on a search result first
    const isSearchResults = window.location.href.includes('/maps/search/');
    console.log('Is search results page:', isSearchResults);
    
    if (isSearchResults) {
      console.log('On search results, clicking first result...');
      const clicked = await clickFirstSearchResult();
      if (clicked) {
        console.log('Clicked search result, waiting for place panel...');
        await sleep(2000);
      } else {
        console.log('Could not click search result, checking if place panel is already visible...');
      }
    }
    
    // Step 2: Wait for the Save button to appear (place panel loaded)
    console.log('Waiting for Save button...');
    try {
      await waitForElement('[data-value="Save"], button[aria-label*="Save"]', 10000);
    } catch (e) {
      // Try clicking search result again if Save button not found
      console.log('Save button not found, trying to click search result again...');
      await clickFirstSearchResult();
      await sleep(2000);
      await waitForElement('[data-value="Save"], button[aria-label*="Save"]', 10000);
    }
    await sleep(1000);
    
    // Step 3: Click the Save button
    console.log('Clicking Save button...');
    const saveButton = await findAndClickSaveButton();
    if (!saveButton) {
      throw new Error('Could not find Save button');
    }
    
    await sleep(1500);
    
    // Step 4: Handle the save dialog
    console.log('Handling save dialog...');
    await handleSaveDialog();
    
    // Step 5: Report success
    await sleep(1000);
    hideOverlay();
    
    console.log('✅ Save complete for:', automationState.place.name);
    chrome.runtime.sendMessage({ action: 'saveComplete' });
    
  } catch (error) {
    console.error('Automation error:', error);
    hideOverlay();
    chrome.runtime.sendMessage({ action: 'saveError', error: error.message });
  }
};

// Click the first search result to open the place
const clickFirstSearchResult = async () => {
  // Multiple selectors for search results
  const resultSelectors = [
    // Main search result items
    'div[role="feed"] > div > div > a',
    'a[href*="/maps/place/"]',
    '[data-result-index="0"]',
    '.Nv2PK', // Search result cards
    'div[jsaction*="mouseover:pane"] a',
    // Fallback - any clickable item in the results
    '[role="article"] a',
    'a.hfpxzc'
  ];
  
  for (const selector of resultSelectors) {
    try {
      const results = document.querySelectorAll(selector);
      console.log(`Found ${results.length} elements with selector: ${selector}`);
      
      for (const result of results) {
        // Make sure it's visible and looks like a place result
        if (result.offsetParent !== null && result.href && result.href.includes('/maps/place/')) {
          console.log('Clicking search result:', result.href);
          result.click();
          return true;
        }
      }
    } catch (e) {
      console.log('Selector error:', e);
    }
  }
  
  // Fallback: Try clicking any link that looks like a place
  const allLinks = document.querySelectorAll('a[href*="/maps/place/"]');
  if (allLinks.length > 0) {
    console.log('Fallback: clicking first place link');
    allLinks[0].click();
    return true;
  }
  
  // Another fallback: click elements with place names
  const placeNameElements = document.querySelectorAll('[aria-label*="' + automationState.place.name.split(' ')[0] + '"]');
  if (placeNameElements.length > 0) {
    console.log('Clicking element with place name');
    placeNameElements[0].click();
    return true;
  }
  
  console.log('Could not find any search result to click');
  return false;
};

// Find and click the Save button
const findAndClickSaveButton = async () => {
  console.log('Looking for Save button...');
  
  // Try multiple selectors for the Save button
  const selectors = [
    '[data-value="Save"]',
    'button[aria-label*="Save"]',
    '[aria-label="Save"]',
    'button[jsaction*="save"]',
    'button[data-tooltip*="Save"]',
    // Icon button with save icon
    'button[aria-label="Save"] img',
    'button img[src*="save"]'
  ];
  
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      console.log(`Selector "${selector}" found ${elements.length} elements`);
      
      for (const element of elements) {
        // Get the actual button (might be the element or its parent)
        const button = element.closest('button') || element;
        
        if (button && button.offsetParent !== null) {
          console.log('Found save button with selector:', selector, button);
          button.click();
          return button;
        }
      }
    } catch (e) {
      console.log('Selector error:', selector, e);
    }
  }
  
  // Fallback: find by text content or aria-label
  console.log('Trying text-based search...');
  const allElements = document.querySelectorAll('button, [role="button"], [tabindex="0"]');
  console.log('Found', allElements.length, 'clickable elements');
  
  for (const element of allElements) {
    const text = element.textContent?.toLowerCase() || '';
    const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
    const dataValue = element.getAttribute('data-value')?.toLowerCase() || '';
    
    if (text.includes('save') || ariaLabel.includes('save') || dataValue.includes('save')) {
      if (element.offsetParent !== null && !text.includes('saved')) {
        console.log('Found save element by text:', element);
        element.click();
        return element;
      }
    }
  }
  
  // Last resort: look in the action bar area
  console.log('Trying action bar search...');
  const actionBar = document.querySelector('[role="group"]');
  if (actionBar) {
    const buttons = actionBar.querySelectorAll('button');
    for (const button of buttons) {
      const ariaLabel = button.getAttribute('aria-label') || '';
      if (ariaLabel.toLowerCase().includes('save')) {
        console.log('Found save in action bar:', button);
        button.click();
        return button;
      }
    }
  }
  
  console.log('❌ Could not find Save button');
  return null;
};

// Handle the save dialog (create new list or select existing)
const handleSaveDialog = async () => {
  // Wait for the save dialog to appear
  await sleep(1000);
  
  // Look for "New list" option or existing list
  const listName = automationState.listName;
  
  // First, check if there's a "New list" button (for first place)
  if (automationState.isFirstPlace) {
    const newListButton = await findNewListButton();
    if (newListButton) {
      console.log('Creating new list:', listName);
      newListButton.click();
      await sleep(1000);
      
      // Enter list name
      const nameInput = document.querySelector('input[aria-label*="name"], input[placeholder*="name"], input[type="text"]');
      if (nameInput) {
        nameInput.value = '';
        nameInput.focus();
        // Simulate typing
        for (const char of listName) {
          nameInput.value += char;
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          await sleep(50);
        }
      }
      
      await sleep(500);
      
      // Click Create/Done button
      const createButton = await findCreateButton();
      if (createButton) {
        createButton.click();
        await sleep(1000);
      }
      
      return;
    }
  }
  
  // Look for existing list with our name
  const listOption = await findListByName(listName);
  if (listOption) {
    console.log('Selecting existing list:', listName);
    listOption.click();
    await sleep(500);
    return;
  }
  
  // Fallback: click the first available list or "Favorites"
  const anyList = document.querySelector('[role="menuitemcheckbox"], [role="option"]');
  if (anyList) {
    console.log('Selecting first available list');
    anyList.click();
    return;
  }
  
  console.log('No list found, save might have completed');
};

// Find "New list" button
const findNewListButton = async () => {
  await sleep(500);
  
  const selectors = [
    '[aria-label*="New list"]',
    '[data-value="New list"]',
    'button:contains("New list")',
    '[role="menuitem"]'
  ];
  
  // Also search by text
  const allItems = document.querySelectorAll('[role="menuitem"], [role="option"], button, div[tabindex]');
  for (const item of allItems) {
    if (item.textContent.toLowerCase().includes('new list')) {
      return item;
    }
  }
  
  return null;
};

// Find Create/Done button
const findCreateButton = async () => {
  const allButtons = document.querySelectorAll('button');
  for (const button of allButtons) {
    const text = button.textContent.toLowerCase();
    if (text.includes('create') || text.includes('done') || text.includes('save')) {
      return button;
    }
  }
  return null;
};

// Find list by name
const findListByName = async (name) => {
  const allItems = document.querySelectorAll('[role="menuitemcheckbox"], [role="option"], [role="menuitem"]');
  for (const item of allItems) {
    if (item.textContent.toLowerCase().includes(name.toLowerCase())) {
      return item;
    }
  }
  return null;
};

// Wait for an element to appear
const waitForElement = (selector, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for ${selector}`));
        return;
      }
      
      setTimeout(check, 200);
    };
    
    check();
  });
};

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Show overlay with status
const showOverlay = (message) => {
  let overlay = document.getElementById('gmaps-saver-overlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'gmaps-saver-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #4285f4, #34a853);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 12px;
      animation: slideIn 0.3s ease;
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(overlay);
  }
  
  overlay.innerHTML = `
    <span style="animation: pulse 1s infinite;">⏳</span>
    <span>${message}</span>
  `;
  overlay.style.display = 'flex';
};

// Hide overlay
const hideOverlay = () => {
  const overlay = document.getElementById('gmaps-saver-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
};

// Notify background that content script is ready
chrome.runtime.sendMessage({ action: 'contentReady' });
