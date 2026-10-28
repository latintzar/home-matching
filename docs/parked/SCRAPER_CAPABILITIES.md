# Scraper Capabilities & System Nuances

This document outlines the advanced capabilities, logic, and "nuances" of the multi-tiered scraping system (Extension, Robust Server, Universal). It reflects the latest refinements to ensure comprehensive data extraction.

## 1. Shared Parsing Architecture (The "Brain")

The core parsing logic for Idealista is now unified in `src/lib/parsers/rules.ts`. This ensures **100% parity** between the Client-Side Extension and the Server-Side API.

### Core Logic (`src/lib/parsers/rules.ts`)

*   **Multilingual Address Cleaning**:
    *   **Logic**: Aggressively strips transaction prefixes (e.g., "Piso en venta en...", "Apartment for sale in...") to extract the clean street or neighborhood name.
    *   **Languages Supported**: Spanish, English, Catalan, French, German.
    *   **Benefit**: Prevents titles like "Sale Flat in Madrid" from cluttering the address field.

*   **Smart Stats Parsing (Bed/Bath/Area)**:
    *   **Logic**: Scans the **entire features list and header text** using shared regex patterns.
    *   **Nuance**: Handles multiple formats (`3 hab`, `3 bedrooms`, `3 habitaciones`, `120 m²`, `120 m2 construidos`).
    *   **Area Differentiation**: Distinguishes between `m² construidos` (Built) and `m² útiles` (Useful/Net).

*   **Booleans & Enums**:
    *   **Logic**: Maps keywords (e.g., 'ascensor', 'lift') to boolean flags (`has_elevator`) and enums (`floor_level`, `condition`).
    *   **Benefit**: Provides structured data immediately without needing AI post-processing for basic specs.

## 2. Robust Server-Side Extraction (`/api/scrape/robust`)

This is the primary engine for high-fidelity extraction, specifically tuned for **Idealista**. It uses a "Fast Path" (Direct Fetch) with a fallback to **Scrapfly** (Residential Proxy Network).

*   **Adapter**: `src/lib/parsers/idealista.ts` (Uses `cheerio` + Shared Rules).
*   **Geo-Location Recovery**: Deep-scans hidden JS variables (`latitude:`, `longitude:`) when map attributes are missing.
*   **Photo Extraction (High-Res)**: Parses `fullScreenGalleryPics` JSON to get max-resolution URLs, bypassing low-res thumbnails.
*   **Agency Intelligence**:
    *   Extracts Agency Name, Logo (auto-upscaled via AI), and specific Agent profiles.
    *   Detects WhatsApp links (`wa.me`) and direct emails.

## 3. Browser Extension (Client-Side)

The extension injects a "🦁 Analyse with Leo" button directly into property portals.

*   **Adapter**: `src/extension/content.ts` (Uses DOM + Shared Rules).
*   **Workflow**:
    *   **Idealista**: Runs the **Shared Logic** locally in the browser (0ms latency).
    *   **Other Sites**: Detects non-Idealista URL → Sends HTML to Server → Triggers **Universal AI**.
*   **Capabilities**:
    *   ✅ **Instant Parity**: Exact same extraction power as the Robust Server.
    *   ✅ **Universal Support**: Works on any agency site via the AI Relay.
    *   ✅ **Smart Detection**: Only appears on pages that look like property listings (Price + Stats).

## 4. Universal Scraper (Gemini-Powered)

For **non-Idealista** sites (Fotocasa, Rightmove, Agencies), we use a generative AI approach.

*   **Engine**: `src/lib/scrapers/universal.ts`
*   **Model**: Gemini 2.5 Flash Lite (Fast & Cost-Effective).
*   **Process**:
    1.  Extension captures HTML.
    2.  Server strips scripts/styles to reduce token count.
    3.  Gemini extracts structured JSON (Specs, Description, Agent, Photos).

## Summary of Capabilities

| Feature | 🧩 Extension (Idealista) | 🧩 Extension (Others) | 🦁 Robust Server | 🌍 Universal (AI) |
| :--- | :--- | :--- | :--- | :--- |
| **Logic Source** | `rules.ts` (Shared) | Server Relay | `rules.ts` (Shared) | Gemini AI |
| **Latency** | ⚡️ **Instant** (<50ms) | ⏳ **~3s** | ⏳ **~5s** | ⏳ **~3s** |
| **Stats (m²/Bed)** | ✅ Regex Parity | ✅ AI Extraction | ✅ Regex Parity | ✅ AI Extraction |
| **Specs (Lift/Pool)** | ✅ Keyword Map | ✅ AI Extraction | ✅ Keyword Map | ✅ AI Extraction |
| **Hidden Coords** | ✅ DOM Scan | ✅ AI Inference | ✅ Cheerio Scan | ✅ AI Inference |
| **Photos** | ✅ Script Parse | ✅ AI Selection | ✅ Script Parse | ✅ AI Selection |
| **Agent Profile** | ✅ Basic | ✅ **Deep** | ✅ **Deep** | ✅ **Deep** |

