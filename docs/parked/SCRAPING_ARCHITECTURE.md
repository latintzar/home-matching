# Ingestion Architecture (Intent-Based)

This architecture separates concerns based on **how data enters the system** (User Intent vs System Intent) rather than the specific tool used.

## 🧠 The Brain (`src/lib/extraction/rules.ts`)
This is the **Single Source of Truth** for parsing logic.
*   **Idealista Rules**: Hard-coded Regex/Selectors/Keywords for accurate extraction.
*   **Universal AI Prompt**: The master template for Gemini instructions.

## 📂 Folder Structure (Notion Style)

```
src/
  lib/
    extraction/
      rules.ts              # THE BRAIN (Shared Logic)
      adapters/
        browser.ts          # DOM Adapter (for Extension)
        server.ts           # Cheerio Adapter (for Server)
  app/
    api/
      ingest/
        browser/            # Receives data pushed by User (Extension)
        server/             # Fetches data via System (AI Fallback / Cron)
```

## 🚀 Ingestion Flows

### 1. The Browser Path (User-Initiated)
**Primary method for Idealista, Fotocasa, and active browsing.**
*   **Context**: User is on the page. Extension has full DOM access.
*   **Action**: User clicks "Analyze".
*   **Logic**:
    *   **Idealista**: `browser.ts` parses the page instantly using `rules.ts`.
    *   **Other Sites**: Extension detects non-Idealista URL → Pings `/api/ingest/server` for AI help.
*   **Endpoint**: `/api/ingest/browser` (Receives the final JSON payload).

### 2. The Server Path (System-Initiated / Fallback)
**Method for "Import from URL", Cron Jobs, and AI Fallbacks.**
*   **Context**: We only have a URL.
*   **Action**: User pastes URL in Dashboard OR Extension requests AI help.
*   **Logic**:
    *   **Idealista**: ❌ Blocked (Safety precaution). Returns error asking user to use Extension.
    *   **Other Sites**: Fetches HTML → Uses Gemini AI with `rules.ts` prompt.
*   **Endpoint**: `/api/ingest/server` (Performs the fetch & parse).

## 🛠️ Cheat Sheet for Developers

| Problem | Where to Fix |
| :--- | :--- |
| **Idealista** parsing is wrong (Extension OR Server) | `src/lib/extraction/rules.ts` |
| **Extension** button not showing | `src/extension/content.ts` (Entry point) |
| **AI** is missing fields | `src/lib/extraction/rules.ts` (Prompt section) |
| **Import from URL** fails | `src/app/api/ingest/server/route.ts` |
| **Extension** data save fails | `src/app/api/ingest/browser/route.ts` |
