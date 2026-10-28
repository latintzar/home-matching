# 🕰️ Cron Jobs Definition

This file serves as the central registry for all scheduled tasks in the application.
Technical implementation is in `vercel.json` (Vercel Cron).

---

## 🚜 1. The Daily Harvest (Ingestion Engine)
*   **Schedule**: `0 4 * * *` (Every Day at 04:00 AM UTC)
*   **Endpoint**: `/api/cron/harvest`
*   **Purpose**: Runs the **Harvest Engine** in Observation Mode (or Ingest Mode).
    *   Checks `harvest_queue` for due domains.
    *   Updates `listing_map` with new URLs.
    *   Updates `last_seen` for existing URLs (Ghost Protocol).
    *   Learns new scraping rules if needed (Teacher Mode).
*   **Tables**: `harvest_queue`, `scraping_rules`, `listing_map`.
*   **Timeout**: 60 seconds (Vercel Hobby/Pro limit).
*   **Authentication**: Bearer Token via `CRON_SECRET`.

---

## 👻 2. The Ghost Protocol (Cleanup)
*   **Schedule**: *Piggybacks on Daily Harvest* (runs as part of the logic) OR separate job TBD.
*   **Purpose**: Marks listings as `gone` if `last_seen < 3 days ago`.
*   **SQL Function**: `mark_ghost_listings(days)`.

---

## 📊 3. Analysis Pipeline (Future)
*   *Planned*: Weekly re-scoring of "Hot" properties?
*   *Planned*: Monthly cleanup of temporary logs?

---

## 🛠️ How to Add a New Job
1.  Create API Route: `src/app/api/cron/your-job/route.ts`
2.  Add to `vercel.json`:
    ```json
    {
      "path": "/api/cron/your-job",
      "schedule": "0 0 * * *"
    }
    ```
3.  Document here.

