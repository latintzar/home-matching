# Shared Parsing Architecture

The platform uses a **Unified Extraction Engine** to ensure 100% parity between the Client-Side Extension and the Server-Side API.

## The "Brain" (`src/lib/parsers/rules.ts`)

This file is the **Single Source of Truth** for all scraping logic. It defines:
*   **Selectors**: CSS selectors for Titles, Prices, Phones, etc.
*   **Regex Patterns**: For extracting Bedrooms, Bathrooms, m², and References.
*   **Keywords**: Multilingual lists for detecting booleans (Elevator, Pool, Terrace) and Enums (Condition, Floor Level).

**Any change to extraction logic MUST happen here.**

## The Adapters

The "Brain" is platform-agnostic. It is consumed by two adapters that apply the logic to their respective environments:

### 1. Server Adapter (`src/lib/parsers/idealista.ts`)
*   **Environment**: Node.js (Server-Side)
*   **Engine**: `cheerio` (Parses static HTML strings)
*   **Usage**: Used by `/api/scrape/robust` (The Robust Scraper endpoint).
*   **Flow**: `rules.ts` → `idealista.ts` → `robust/route.ts`

### 2. Client Adapter (`src/extension/content.ts`)
*   **Environment**: Browser (Client-Side Extension)
*   **Engine**: Native DOM (`document.querySelector`)
*   **Usage**: Used by the Chrome Extension for instant parsing.
*   **Flow**: `rules.ts` → `content.ts` → (Build Step) → `public/extension/content.js`

## Universal AI Fallback

For non-Idealista sites (e.g., Agencies, Portals), the system falls back to the **Universal AI Scraper**:
1.  **Extension**: Detects non-Idealista URL.
2.  **Action**: Sends HTML payload to `/api/storeListing` with `useUniversalAI: true`.
3.  **Server**: Relays to `src/lib/scrapers/universal.ts`, which uses **Gemini Flash Lite** to extract structured data.

## How to Update Extraction Logic

1.  **Edit `src/lib/parsers/rules.ts`**:
    *   Add a new regex, keyword, or selector.
    *   *Example*: Adding "Penthouse" to `floor_level`.

2.  **Updates are Automatic**:
    *   **Server**: Instantly live (Next.js hot reload).
    *   **Extension**: Run `./scripts/build-extension.sh` to rebuild `content.js`, then reload the extension in Chrome.

## File Structure

```
src/
  lib/
    parsers/
      rules.ts       # THE BRAIN (Shared Logic)
      idealista.ts   # Server Adapter (Cheerio)
    scrapers/
      universal.ts   # AI Scraper (Gemini)
  extension/
    content.ts       # Client Adapter (DOM) - Source
public/
  extension/
    content.js       # Compiled Extension Script
```

