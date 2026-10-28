# Scraping Phase

**Last Updated:** 2025-10-27  
**Status:** ✅ Complete  
**Purpose:** Extract property data from Idealista listings

## 📋 Overview

The Scraping phase is the **first stage** of our pipeline, responsible for extracting all available data from Idealista property listings.

**Flow:**
```
Idealista URL → Scraper → Raw Property Data
```

---

## 🎯 Process

### Step 1: Create Listing Record
- **Input:** Idealista URL
- **Action:** Create listing record immediately in Supabase with placeholder data
- **Output:** `listingId` available for text analysis pipeline
- **Why:** Provides instant listingId for downstream pipeline operations

### Step 2: Call Scrapfly API
- **Technology:** Scrapfly (anti-bot bypass)
- **Input:** Idealista URL
- **Process:**
  1. Bypass anti-bot protections
  2. Extract HTML from Idealista
  3. Parse property data from HTML
- **Extracted Data:**
  - Title, price, description
  - Bedrooms, bathrooms, size (constructed, useful)
  - Location (address, city, neighborhood)
  - Physical features (chalet pareado, terraza, orientación, jardín, etc.)
  - Photos (all image URLs)

### Step 3: Update Listing
- **Action:** Update existing listing record with scraped data
- **Storage:** All data saved to `listings.scraped_data` JSONB field
- **Output:** Complete property data ready for analysis

---

## 📊 Extracted Data Structure

### Basic Property Data
```typescript
{
  title: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  areas: {
    constructed: number;
    useful: number;
  };
  location: {
    address: string;
    city: string;
    neighborhood: string;
  };
  // ... more fields
}
```

### Physical Features
Filtered from `.details-property_features` divs:
- Includes: "Chalet pareado", "Terraza", "Orientación sur", "Jardín"
- Excludes: Basic data (area, bedrooms, bathrooms) and non-essentials (energy ratings, construction dates)

### Photos
All image URLs extracted and stored in `listing_photos` table

---

## 🔧 Key Implementation Details

### Physical Features Extraction (Fixed 2025-01-27)
- **Before:** Mixed basic and meaningful features
- **After:** Only meaningful physical features (architectural, outdoor, orientation)
- **Result:** Clean, focused feature list for analysis

### Scraper Flow Optimization (2025-01-27)
- **Before:** Complex conditional logic
- **After:** Create listing immediately, then update
- **Result:** Instant listingId for text analysis pipeline

---

## 📊 Database Schema

### `listings` Table
```sql
CREATE TABLE listings (
  id TEXT PRIMARY KEY,
  title TEXT,
  address TEXT,
  price_eur NUMERIC,
  bedrooms INTEGER,
  bathrooms INTEGER,
  sqm NUMERIC,
  scraped_data JSONB,  -- Full scraped data storage
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### `listing_photos` Table
```sql
CREATE TABLE listing_photos (
  id SERIAL PRIMARY KEY,
  listing_id TEXT,
  url TEXT,
  caption TEXT,
  display_order INTEGER,
  created_at TIMESTAMPTZ
);
```

---

## 🎯 API Endpoint

**Endpoint:** `/api/scrape/robust/`

**Method:** POST

**Input:**
```json
{
  "url": "https://www.idealista.com/inmueble/..."
}
```

**Output:**
```json
{
  "success": true,
  "listing_id": "1000000121",
  "data": {
    "title": "...",
    "price": 3500000,
    // ... full scraped data
  }
}
```

---

## 📚 Related Documentation

- **[Analysis Pipeline](ANALYSIS_PIPELINE.md)** - Next phase after scraping
- **[Pipeline Flow](../../parked/PIPELINE_FLOW.md)** - Complete 3-phase overview
- **[Pipeline Status](../../parked/PIPELINE_STATUS.md)** - Real-time status monitoring

