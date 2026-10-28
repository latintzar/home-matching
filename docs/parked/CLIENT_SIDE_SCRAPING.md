# Client-Side Scraping Architecture (Chrome Extension)

## Overview
The Leo.casa Chrome Extension provides a robust, client-side alternative to server-side scrapers (like Scrapfly). It runs directly in the user's browser, making it immune to bot detection and IP blocking.

## Key Features
- **Universal Capability**: Works on Idealista (specialized) and any other site (heuristic/universal mode).
- **Instant Redirect**: Uses a "Lite Payload" strategy to redirect the user to the analysis dashboard in < 1 second.
- **Background Uploads**: High-resolution photos are uploaded silently in the background by the extension's service worker, ensuring no UI blocking.
- **Robust Data**: Extracts Price, Address, Description, Stats (Bed/Bath/Area), and precise Coordinates (Lat/Lng).

## Architecture Flow

### 1. Extraction (Content Script)
- **Trigger**: User clicks "Analyse with Leo" button injected into the property page.
- **Process**:
  - Extracts metadata (Title, Price, Stats, Description) from the DOM.
  - Extracts Image URLs (from high-res scripts or DOM).
  - Extracts Coordinates (from map configuration).
- **Payload**: Constructs a lightweight JSON payload (Metadata + Image URLs only).

### 2. Instant Handoff
- **Action**: Extension sends the lightweight payload to `/api/storeListing`.
- **Server**: Saves the listing immediately with status `scraped`.
- **Redirect**: Extension opens `/add-property?edit=[ID]` in a new tab immediately.
- **User Experience**: The user sees the form populated instantly (0s delay).

### 3. Background Processing (Service Worker)
- **Delegation**: The content script delegates the heavy photo upload task to the `background.js` service worker.
- **Fetching**: The service worker fetches each image URL (bypassing CORS).
- **Uploading**: It uploads images one-by-one (or in batches) to `/api/listings/[id]/photos/upload-base64`.
- **Completion**: The backend `listing_photos` table is populated asynchronously.

### 4. Frontend Hydration (ListingEditor)
- **Smart Fallback**: The `ListingEditor` component displays the photos immediately using the *original external URLs* (from the scraping payload).
- **Seamless Upgrade**: As the background uploads finish, the backend replaces these with permanent Storage URLs.
- **Smart Address**: The editor uses Google Maps Autocomplete to verify and clean the address automatically.

## File Structure
- `public/extension/` - The Chrome Extension source code.
  - `manifest.json` - Config and permissions.
  - `content.js` - DOM extraction logic and UI injection.
  - `background.js` - Service worker for independent photo uploads.
- `src/app/api/storeListing/` - Endpoint to save the initial metadata.
- `src/app/api/listings/[id]/photos/upload-base64/` - Endpoint for background photo ingestion.
- `src/components/manual-entry/ListingEditor.tsx` - The UI that receives the data.

## Setup & Installation
1.  Go to `chrome://extensions`.
2.  Enable **Developer Mode**.
3.  Click **Load Unpacked**.
4.  Select the `public/extension` folder in this repository.

## 5. The "Teacher" Role (Harvest Engine Integration)

The extension plays a crucial role in the **Harvest Engine** (Self-Healing Scraper):

1.  **Detection**: When a user visits a new agency site, the extension asks the Server: *"Do you have scraping rules for this domain?"*
2.  **Learning**: If the Server says "No", the Extension triggers **Teacher Mode**.
3.  **Instruction**: It sends the DOM structure to the Server, which uses **Gemini 3 Pro** to reverse-engineer the CSS selectors.
4.  **Legacy**: These rules are saved to the `scraping_rules` table, allowing the server to scrape this domain cheaply (without AI) forever after.

## 6. Maintenance
- **Selectors**: If Idealista changes their CSS, update `content.js` selectors.
- **Heuristics**: The universal parser in `content.js` uses regex and font-size heuristics which are generally stable but may need tuning for specific new sites.

