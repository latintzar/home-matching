# 🏗️ Setup Guide

## Prerequisites

1.  **Node.js**: v18.18.0+ or v20.0.0+ (Required for Next.js 14)
2.  **Supabase Account**: For database and auth.
3.  **Google Cloud Project**: For Vertex AI (Gemini Models).

## 1. Environment Variables

Create `.env.local` based on `.env.example`:

```bash
cp .env.example .env.local
```

### Critical Variables:

```bash
# Supabase (Database & Auth)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key # REQUIRED for Harvest Engine & Cron Jobs

# Google Cloud (Vertex AI)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=./path/to/credentials.json # Absolute path recommended

# Cron Security
CRON_SECRET=your-random-secret # Protects /api/cron/* endpoints
```

## 2. Database Setup

Run migrations in order using the Supabase SQL Editor:

1.  `001_core_tables.sql` (Listings, Photos)
2.  `002_pipeline_tables.sql` (Analysis results)
3.  `003_text_analysis_tables.sql` (Text results)
4.  `004_deepdive_output_tables.sql` (Deep Dive UI)
5.  `050_add_reference_number_to_listings.sql` (Deduplication)
6.  `060_add_reference_number_index.sql` (Performance)
7.  `061_harvest_engine_tables.sql` (Harvest Queue, Scraping Rules)
8.  `062_listing_map_table.sql` (Observation Mode)

## 3. Seed Data (Harvest Engine)

If you have the `MASTER_AGENCY_LIST.csv` in `data/`, run the seeder:

```bash
npx ts-node scripts/seed_harvest_queue.ts
```

This populates the `harvest_queue` with your agency domains.

## 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`.

## 5. Deployment (Vercel)

1.  Connect your GitHub repo to Vercel.
2.  Add all Environment Variables from `.env.local`.
3.  **Deploy**.
4.  Vercel will automatically pick up `vercel.json` and schedule the Cron Jobs.
