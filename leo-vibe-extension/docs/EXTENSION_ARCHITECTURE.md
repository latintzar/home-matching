# Leo Vibe Maps - Extension Architecture

## Overview

Chrome extension that displays neighborhood vibe circles on Airbnb and Booking.com maps.

## File Structure

```
leo-vibe-extension/
├── manifest.json          # Extension configuration
├── content-script.js      # Injected on page load, shows activation popup
├── injected-script.js     # Main world script, creates circles on Google Maps
├── background.js          # Service worker for API calls (premium feature)
├── popup.html             # Toolbar popup UI
├── popup.js               # Toolbar popup logic
├── content-styles.css     # Styles for injected elements
├── icons/                 # Extension icons
└── docs/
    ├── VIBE_AREAS.md      # Vibe areas documentation
    └── EXTENSION_ARCHITECTURE.md  # This file
```

## Data Flow

### Default Flow (Free)
```
Page Load → content-script.js → Shows Popup → User Clicks
    → Injects injected-script.js → Creates Hardcoded Circles
```

### Premium Flow (AI-Generated)
```
User Types Trip Description → popup.js → background.js
    → Gemini API → Returns Areas JSON → content-script.js
    → Injects injected-script.js with customAreas → Creates AI Circles
```

## Core Components

### 1. manifest.json
- Defines extension permissions
- Registers content scripts and background service worker
- Specifies host permissions for Airbnb, Booking.com, and Gemini API

### 2. content-script.js
- Runs at `document_start` on search pages
- Shows activation popup (top-right, Honey-style)
- Listens for messages from popup.js
- Injects injected-script.js when activated

### 3. injected-script.js
- Runs in MAIN world (bypasses CSP)
- Hooks into Google Maps API
- Creates `google.maps.Circle` for each vibe area
- Handles hover (info card) and click (zoom + persistent card)
- Supports both hardcoded DEFAULT_VIBE_AREAS and custom AI areas

### 4. background.js (Premium)
- Service worker for Gemini API calls
- Handles CORS by making requests from background context
- Returns structured area data to popup

### 5. popup.html / popup.js
- Simple activation UI in toolbar
- Premium section with trip description input
- Sends messages to content-script or background

## Vibe Area Data Format

```javascript
{
  name: "Gothic Quarter",      // Display name
  lat: 41.3833,               // Latitude
  lng: 2.1777,                // Longitude
  radius: 400,                // Circle radius in meters
  color: "#E74C3C",           // Hex color
  vibes: ["romantic", "historic", "nightlife"]  // Tags
}
```

## Default Barcelona Areas

| Name | Coordinates | Color | Vibes |
|------|-------------|-------|-------|
| Gothic Quarter | 41.3833, 2.1777 | Red | romantic, historic, nightlife |
| El Born | 41.3850, 2.1825 | Blue | hipster, trendy, boutiques |
| Gràcia | 41.4025, 2.1530 | Green | local, bohemian, authentic |
| Barceloneta | 41.3807, 2.1897 | Orange | beach, seafood, sunny |
| Eixample | 41.3917, 2.1649 | Purple | upscale, modernist, shopping |

## API Configuration (Premium)

Uses same Gemini endpoint as zero-shot clustering:

```javascript
const API_ENDPOINT = 'aiplatform.googleapis.com';
const MODEL_ID = 'gemini-3-pro-preview';
const GENERATE_CONTENT_API = 'streamGenerateContent';

// Full URL
`https://${API_ENDPOINT}/v1/publishers/google/models/${MODEL_ID}:${GENERATE_CONTENT_API}?key=${API_KEY}`
```

## Message Types

### popup.js → content-script.js
- `{ action: 'activate' }` - Show default vibe areas
- `{ action: 'activateWithAreas', areas: [...] }` - Show AI-generated areas
- `{ action: 'getStatus' }` - Check if injected
- `{ action: 'toggle' }` - Toggle visibility

### popup.js → background.js
- `{ action: 'generateVibeAreas', tripDescription: '...' }` - Generate AI areas

## Version History

- **v1.0.0** - Initial release with hardcoded Barcelona areas
- **v1.1.0** - Added Booking.com support, info cards on hover/click
- **v1.2.0** - Added premium AI-generated areas feature
