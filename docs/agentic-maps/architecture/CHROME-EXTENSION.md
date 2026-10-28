---
status: implementing
last_updated: 2024-12-12
implemented_in: /leo-vibe-extension/
---

# Chrome Extension Integration

> Inject vibe areas onto Airbnb and Booking.com pages.

## Overview

The Leo Vibe Maps Chrome extension injects neighborhood recommendations directly onto Airbnb and Booking.com search pages. When users click booking platform links from area cards in the main app, the extension displays the same vibe areas on the booking site itself.

## Current State vs Target

| Feature | Current | Target |
|---------|---------|--------|
| Barcelona support | ✅ Hardcoded | ✅ Dynamic |
| Other cities | ❌ | ✅ Any city |
| Authentication | ❌ | ✅ Shared with main app |
| Chat sync | ❌ | ✅ Via chat ID |
| Direct search | ❌ | ✅ In extension popup |

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MAIN VIBE MAPS APP                                                         │
│  ┌─────────────────┐                                                        │
│  │  Chat Session   │                                                        │
│  │  ID: abc123     │                                                        │
│  │                 │                                                        │
│  │  Areas:         │                                                        │
│  │  - Gothic       │  ──────────────────┐                                   │
│  │  - El Born      │                    │                                   │
│  │  - Gràcia       │                    │ Sync via chat ID                  │
│  └─────────────────┘                    │                                   │
│           │                             │                                   │
│           │ Click "Search Airbnb"       │                                   │
│           ▼                             ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CHROME EXTENSION (on airbnb.com)                                   │   │
│  │                                                                     │   │
│  │  Authenticated user → Fetch areas for chat ID abc123               │   │
│  │  Display same vibe circles on Airbnb map                           │   │
│  │  User can filter listings by area                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## User Flow

### Flow 1: From Main App to Booking Platform

1. User searches in Vibe Maps app: "where to stay in Barcelona"
2. App generates 5 stay areas, creates chat session ID
3. User clicks [Search Airbnb] on Gothic Quarter card
4. Opens Airbnb search for "Gothic Quarter Barcelona"
5. **If extension installed + authenticated**:
   - Extension detects Airbnb page
   - Fetches areas for user's active chat session
   - Injects vibe circles onto Airbnb's map
   - User sees same recommendations while browsing listings

### Flow 2: Direct Extension Search

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Extension Popup                                                            │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  [🔍 "romantic trip barcelona"                              ] [Generate]   │
│                                                                             │
│  💡 This will:                                                              │
│  1. Generate stay area recommendations                                      │
│  2. Show vibe circles on current Airbnb/Booking page                       │
│  3. Refresh search to recommended area                                      │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Recent Searches:                                                           │
│  • Tokyo nightlife (yesterday)                                             │
│  • Barcelona stay (2 days ago)                                             │
│                                                                             │
│  [⚙️ Settings]  [📤 Open Full App]                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Extension Architecture

### Manifest V3 Structure

```json
{
  "manifest_version": 3,
  "name": "Leo Vibe Maps",
  "version": "2.0.0",
  "description": "See neighborhood recommendations on Airbnb and Booking.com",
  
  "permissions": [
    "storage",
    "activeTab"
  ],
  
  "host_permissions": [
    "https://www.airbnb.com/*",
    "https://www.airbnb.co.uk/*",
    "https://www.booking.com/*",
    "https://api.leovibemaps.com/*"
  ],
  
  "background": {
    "service_worker": "background.js"
  },
  
  "content_scripts": [
    {
      "matches": [
        "https://www.airbnb.com/*",
        "https://www.airbnb.co.uk/*",
        "https://www.booking.com/*"
      ],
      "js": ["content-script.js"],
      "css": ["vibe-overlay.css"]
    }
  ],
  
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

### File Structure

```
leo-vibe-extension/
├── manifest.json
├── background.js          # Service worker, auth handling
├── content-script.js      # Injects onto Airbnb/Booking
├── injected-script.js     # Map overlay logic
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic
├── vibe-overlay.css       # Styling for injected elements
├── auth.js                # Authentication helpers
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Authentication

### Shared Auth with Main App

```typescript
// auth.js - Extension authentication

const API_BASE = 'https://api.leovibemaps.com';

// Store auth token from main app
const setAuthToken = async (token: string) => {
  await chrome.storage.sync.set({ authToken: token });
};

// Get stored auth token
const getAuthToken = async (): Promise<string | null> => {
  const result = await chrome.storage.sync.get('authToken');
  return result.authToken || null;
};

// Check if authenticated
const isAuthenticated = async (): Promise<boolean> => {
  const token = await getAuthToken();
  if (!token) return false;
  
  // Verify token is still valid
  try {
    const response = await fetch(`${API_BASE}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.ok;
  } catch {
    return false;
  }
};

// Open main app for login
const openLoginPage = () => {
  chrome.tabs.create({ url: 'https://vibemaps.leo.casa/login?from=extension' });
};
```

### Auth Token Handoff

When user logs into main app, pass token to extension:

```typescript
// In main app, after login
if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
  chrome.runtime.sendMessage(EXTENSION_ID, {
    type: 'AUTH_TOKEN',
    token: session.access_token
  });
}
```

```typescript
// In extension background.js
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'AUTH_TOKEN') {
    chrome.storage.sync.set({ authToken: message.token });
    sendResponse({ success: true });
  }
});
```

## Data Sync

### Fetching Areas from Main App

```typescript
// content-script.js

interface ChatAreasResponse {
  chatId: string;
  city: string;
  areas: VibeArea[];
  places?: Place[];
}

const fetchAreasForChat = async (chatId: string): Promise<ChatAreasResponse | null> => {
  const token = await getAuthToken();
  if (!token) return null;
  
  try {
    const response = await fetch(`${API_BASE}/api/chats/${chatId}/areas`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error('Failed to fetch areas:', error);
    return null;
  }
};

// Get active chat ID from storage
const getActiveChatId = async (): Promise<string | null> => {
  const result = await chrome.storage.sync.get('activeChatId');
  return result.activeChatId || null;
};
```

### Setting Active Chat

When user clicks a booking link from main app:

```typescript
// In main app - when clicking "Search Airbnb"
const handleAirbnbClick = async (area: VibeArea, chatId: string) => {
  // Tell extension which chat to use
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    await chrome.runtime.sendMessage(EXTENSION_ID, {
      type: 'SET_ACTIVE_CHAT',
      chatId: chatId,
      city: area.city
    });
  }
  
  // Open Airbnb
  window.open(area.bookingLinks.airbnb, '_blank');
};
```

## Map Injection

### Detecting the Map Element

```typescript
// content-script.js

const SELECTORS = {
  airbnb: {
    mapContainer: '[data-testid="map"]',
    searchInput: '[data-testid="structured-search-input-field-query"]'
  },
  booking: {
    mapContainer: '#map_canvas',
    searchInput: '#ss'
  }
};

const getPlatform = (): 'airbnb' | 'booking' | null => {
  if (window.location.hostname.includes('airbnb')) return 'airbnb';
  if (window.location.hostname.includes('booking')) return 'booking';
  return null;
};

const waitForMapElement = async (): Promise<HTMLElement | null> => {
  const platform = getPlatform();
  if (!platform) return null;
  
  const selector = SELECTORS[platform].mapContainer;
  
  return new Promise((resolve) => {
    // Check if already exists
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing as HTMLElement);
      return;
    }
    
    // Wait for it to appear
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element as HTMLElement);
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, 10000);
  });
};
```

### Injecting Vibe Circles

```typescript
// injected-script.js

const injectVibeCircles = async (mapElement: HTMLElement, areas: VibeArea[]) => {
  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'leo-vibe-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 1000;
  `;
  
  // Position relative to map
  mapElement.style.position = 'relative';
  mapElement.appendChild(overlay);
  
  // Get map bounds (platform-specific)
  const bounds = await getMapBounds(mapElement);
  
  // Draw circles for each area
  areas.forEach((area, index) => {
    const circle = createVibeCircle(area, bounds, index);
    overlay.appendChild(circle);
  });
  
  // Update on map pan/zoom
  observeMapChanges(mapElement, overlay, areas);
};

const createVibeCircle = (area: VibeArea, bounds: MapBounds, index: number): HTMLElement => {
  const circle = document.createElement('div');
  circle.className = 'leo-vibe-circle';
  circle.dataset.areaName = area.name;
  
  // Calculate position based on coordinates and bounds
  const { x, y } = coordsToPixels(area.center, bounds);
  const radiusPx = metersToPixels(area.radius, bounds);
  
  circle.style.cssText = `
    position: absolute;
    left: ${x - radiusPx}px;
    top: ${y - radiusPx}px;
    width: ${radiusPx * 2}px;
    height: ${radiusPx * 2}px;
    border-radius: 50%;
    background: rgba(249, 115, 22, 0.2);
    border: 2px solid rgba(249, 115, 22, 0.8);
    pointer-events: auto;
    cursor: pointer;
    transition: all 0.2s;
  `;
  
  // Label
  const label = document.createElement('div');
  label.className = 'leo-vibe-label';
  label.textContent = `${index + 1}. ${area.name}`;
  label.style.cssText = `
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  `;
  circle.appendChild(label);
  
  // Click to show details
  circle.addEventListener('click', () => showAreaDetails(area));
  
  return circle;
};
```

### Area Details Popup

```typescript
const showAreaDetails = (area: VibeArea) => {
  // Remove existing popup
  document.querySelector('#leo-area-popup')?.remove();
  
  const popup = document.createElement('div');
  popup.id = 'leo-area-popup';
  popup.innerHTML = `
    <div class="leo-popup-header">
      <h3>${area.name}</h3>
      <button class="leo-popup-close">×</button>
    </div>
    <p class="leo-popup-description">${area.description}</p>
    ${area.whyReason ? `<p class="leo-popup-why">💡 ${area.whyReason}</p>` : ''}
    <div class="leo-popup-suggestions">
      ${area.searchSuggestions?.map(s => `
        <a href="${s.gmapsUrl}" target="_blank" class="leo-suggestion">
          🔍 ${s.text}
        </a>
      `).join('') || ''}
    </div>
  `;
  
  popup.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 320px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    padding: 16px;
    z-index: 10001;
  `;
  
  document.body.appendChild(popup);
  
  popup.querySelector('.leo-popup-close')?.addEventListener('click', () => {
    popup.remove();
  });
};
```

## Auto-Refresh Search

When extension generates new areas, refresh the booking platform search:

```typescript
const refreshSearchToArea = async (area: VibeArea, platform: 'airbnb' | 'booking') => {
  const selector = SELECTORS[platform].searchInput;
  const input = document.querySelector(selector) as HTMLInputElement;
  
  if (input) {
    // Update search field
    input.value = `${area.name} ${area.city}`;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Trigger search (platform-specific)
    if (platform === 'airbnb') {
      // Click search button
      const searchBtn = document.querySelector('[data-testid="structured-search-input-search-button"]');
      (searchBtn as HTMLElement)?.click();
    } else {
      // Submit form
      input.form?.submit();
    }
  }
};
```

## Extension Popup UI

```html
<!-- popup.html -->
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <header>
      <img src="icons/icon48.png" alt="Leo Vibe Maps">
      <h1>Vibe Maps</h1>
    </header>
    
    <div id="auth-status"></div>
    
    <div id="search-section" class="hidden">
      <input type="text" id="search-input" placeholder="romantic trip barcelona...">
      <button id="search-btn">Generate Areas</button>
    </div>
    
    <div id="areas-section" class="hidden">
      <h2>Active Areas</h2>
      <div id="areas-list"></div>
    </div>
    
    <div id="recent-section">
      <h2>Recent Searches</h2>
      <div id="recent-list"></div>
    </div>
    
    <footer>
      <button id="settings-btn">⚙️</button>
      <button id="open-app-btn">Open Full App</button>
    </footer>
  </div>
  
  <script src="popup.js"></script>
</body>
</html>
```

```typescript
// popup.js
document.addEventListener('DOMContentLoaded', async () => {
  const isAuth = await isAuthenticated();
  
  if (isAuth) {
    document.getElementById('auth-status').innerHTML = '✅ Connected';
    document.getElementById('search-section').classList.remove('hidden');
    
    // Load active areas
    const chatId = await getActiveChatId();
    if (chatId) {
      const areas = await fetchAreasForChat(chatId);
      if (areas) {
        displayAreas(areas.areas);
      }
    }
    
    // Load recent searches
    const recent = await getRecentSearches();
    displayRecentSearches(recent);
  } else {
    document.getElementById('auth-status').innerHTML = `
      <p>Sign in to sync with Vibe Maps</p>
      <button id="login-btn">Sign In</button>
    `;
    
    document.getElementById('login-btn')?.addEventListener('click', openLoginPage);
  }
  
  // Search handler
  document.getElementById('search-btn')?.addEventListener('click', async () => {
    const query = (document.getElementById('search-input') as HTMLInputElement).value;
    if (query) {
      // Generate areas via API
      const result = await generateAreas(query);
      if (result) {
        // Store as active chat
        await chrome.storage.sync.set({ activeChatId: result.chatId });
        // Refresh current tab with areas
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'LOAD_AREAS',
              areas: result.areas
            });
          }
        });
      }
    }
  });
});
```

## Files to Modify (from current extension)

| File | Current State | Changes Needed |
|------|--------------|----------------|
| `manifest.json` | Manifest V2 | Upgrade to V3, add permissions |
| `background.js` | Minimal | Add auth, API calls |
| `content-script.js` | Barcelona hardcoded | Dynamic city, area sync |
| `injected-script.js` | Static areas | Fetch from API |
| `popup.html` | Basic | Auth UI, search, recent |
| `popup.js` | Minimal | Full popup logic |

## API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /api/auth/verify` | Verify auth token |
| `GET /api/chats/:id/areas` | Fetch areas for a chat |
| `POST /api/chats` | Create new chat from extension search |
| `GET /api/chats?limit=5` | Get recent searches |

---

[← Chat History](CHAT-HISTORY.md) | [Back to Index](../AGENTIC_MAPS.md) | [API Reference →](API-REFERENCE.md)
