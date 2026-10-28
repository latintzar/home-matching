# Architecture Flows

**Last Updated**: December 1, 2024

---

## 🔄 Recommender System Flow

### End-to-End Pipeline

```
User Intake (ElevenLabs)
        ↓
Life Profile Created
        ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ R1: LIFE PROFILE                                                        │
│ • Budget, location preferences, household info                          │
│ • Stored in: user_lifestyle_profiles                                    │
└─────────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ R2: SWEET SPOT GENERATION                                               │
│ • Input: Life profile                                                   │
│ • Process: Score locations based on commute, budget, preferences        │
│ • Output: Primary (5), Secondary (5), Avoid (3) locations              │
│ • Uses: Self-hosted Nominatim (geocoding)                              │
│ • File: src/lib/recommender/sweetSpot.ts                                │
└─────────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ R3: HARVEST FILTER                                                      │
│ • Input: Sweet spot locations + life profile constraints                │
│ • Process: Query DynamoDB leo-listings table                           │
│ • Filters: Location, price, bedrooms, property type, etc.               │
│ • Output: Filtered listings (typically 50-200 matches)                 │
│ • File: src/lib/recommender/harvestFilter.ts                            │
└─────────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ R4: WPA ON SHORTLIST (COST CONTROL)                                     │
│ • Input: Top 10 listings (sorted by €/m²)                               │
│ • Process: Run Whole Property Analysis (Gemini 2.5 Flash)              │
│ • Cost: ~€0.15 per WPA                                                  │
│ • Max: 10 WPAs per run (~€1.50)                                        │
│ • Cache: Check if WPA already exists                                    │
│ • Output: WPA results for each listing                                   │
│ • File: src/lib/recommender/wpaShortlist.ts                             │
└─────────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ R5: FIT SCORING                                                         │
│ • Input: Filtered listings + WPA results + Life profile                 │
│ • Process: Calculate fit score (0-100)                                  │
│ • Factors: Price, location, commute, property features, WPA insights    │
│ • Weights: Adjusted based on profile priorities                         │
│ • Output: Ranked list with scores, reasons, concerns                   │
│ • File: src/lib/recommender/fitScoring.ts                               │
└─────────────────────────────────────────────────────────────────────────┘
        ↓
Recommendations (Top 10-20)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/recommender/orchestrator.ts` | Main pipeline coordinator |
| `src/lib/recommender/sweetSpot.ts` | Geographic sweet spot generation |
| `src/lib/recommender/harvestFilter.ts` | DynamoDB query filtering |
| `src/lib/recommender/wpaShortlist.ts` | WPA execution on shortlist |
| `src/lib/recommender/fitScoring.ts` | Fit score calculation |

### API Endpoint

```
POST /api/recommender/search
```

**Request:**
```json
{
  "profile_id": "uuid" // or full LifeProfile object
}
```

**Response:**
```json
{
  "success": true,
  "recommendations": [
    {
      "listing": { /* FilteredListing */ },
      "wpa": { /* RecommenderWPA */ },
      "fitScore": 78,
      "breakdown": { /* ScoreBreakdown */ },
      "topReasons": ["...", "..."],
      "concerns": ["...", "..."],
      "explanation": "..."
    }
  ],
  "totalFound": 156,
  "totalAnalyzed": 10,
  "timing": {
    "total": 4500,
    "sweetSpot": 200,
    "filter": 800,
    "wpa": 3000,
    "scoring": 500
  }
}
```

### Cost Control

- **WPA Limit**: Max 10 per run (~€1.50)
- **Caching**: Check existing WPA before running
- **Quick Search**: Option to skip WPA for faster results

---

## 🔍 Harvest → Ingest → Analysis Pipeline

### Overview

**Key Point**: Analysis is **ON-DEMAND**. Harvest does 3x daily harvesting + downloading + parsing (parsing = ingesting).

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HARVEST (3x Daily - Automated)                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Morning (6am)  Midday (12pm)  Evening (5pm)                          │
│       ↓              ↓              ↓                                    │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 1. Crawl Agency Websites                                           │ │
│  │    • HarvestEngine.processDomain()                                 │ │
│  │    • Teacher Mode: Gemini 3 Pro learns CSS selectors               │ │
│  │    • Student Mode: Cheerio uses learned rules                      │ │
│  │    • Output: Listings URLs                                         │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│       ↓                                                                 │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 2. Download HTML                                                   │ │
│  │    • Fetch each listing page                                       │ │
│  │    • Save to S3: s3://puedo-casa-html-archive/{domain}/{hash}.html│ │
│  │    • Update DynamoDB: leo-urls table                              │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│       ↓                                                                 │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 3. PARSE (Ingest)                                                  │ │
│  │    • Extract property data from HTML                              │ │
│  │    • Uses: Shared parsing logic (src/lib/extraction/rules.ts)     │ │
│  │    • Idealista: Direct extraction                                 │ │
│  │    • Other sites: AI extraction (Gemini Flash Lite)                │ │
│  │    • Output: Parsed listing data                                  │ │
│  │    • Save to: DynamoDB leo-listings table                         │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

                              ↓ Harvest Complete

┌─────────────────────────────────────────────────────────────────────────┐
│ ANALYSIS (On-Demand - Triggered by User Actions)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Trigger: User clicks property OR Pro adds property                     │
│       ↓                                                                 │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 1. Check if listing exists in DynamoDB                            │ │
│  │    • Query: leo-listings table                                    │ │
│  │    • If not found: Trigger ingest from URL                       │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│       ↓                                                                 │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 2. Run Analysis Pipeline                                           │ │
│  │    • Text Analysis (A-facts, B3-snippets, C-unknowns)            │ │
│  │    • Photo Analysis (Whole Property + Room-by-room)              │ │
│  │    • Google Search (Double-barrel research)                       │ │
│  │    • Final Report Synthesis                                       │ │
│  │    • Save to: Supabase (analysis results)                         │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Harvest Schedule

| Time | Purpose | Lambda Function |
|------|---------|----------------|
| **6:00 AM** | Morning harvest | `daily-harvest-morning` |
| **12:00 PM** | Midday harvest | `daily-harvest-midday` |
| **5:00 PM** | Evening harvest | `daily-harvest-evening` |

**Each harvest run:**
1. Crawls ~10 domains (from `harvest_queue`)
2. Downloads HTMLs → S3
3. Parses HTMLs → DynamoDB `leo-listings`

### Parsing = Ingesting

**Key Point**: "Parsing" during harvest IS the same as "ingesting" - it extracts property data from HTML and saves to DynamoDB.

**Difference:**
- **Harvest parsing**: Automated, bulk, saves to DynamoDB
- **Manual ingest**: On-demand, via `/api/ingest/server`, can save to Supabase OR DynamoDB

### Analysis Trigger Points

| Trigger | When | What Happens |
|---------|------|--------------|
| **User clicks property** | User views recommendation | Check DynamoDB → If exists, show → If not, ingest → Analyze |
| **Pro adds property** | Pro uses extension or "Add Property" | Ingest → Analyze (if auto-analyze checked) |
| **Manual analysis** | User/Pro clicks "Analizar" | Run full analysis pipeline |

---

## 🧠 Extension Architecture (Teacher/Student Mode)

### Current State

**Status**: Currently working on parsing rules for different websites. Once complete, extension will learn from them.

### How It Will Work

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TEACHER MODE (Learning Phase)                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. User visits new domain (e.g., remax.es)                            │
│  2. Extension detects: No parsing rules exist                           │
│  3. Triggers Teacher Mode:                                             │
│     • Takes screenshot of listing page                                 │
│     • Sends to Gemini 3 Pro with prompt:                              │
│       "Learn CSS selectors for this property listing page"             │
│     • Gemini returns: CSS selectors for all fields                      │
│  4. Saves rules to: Supabase scraping_rules table                     │
│  5. Syncs to: AWS DynamoDB leo-scraping-rules table                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

                              ↓ Rules Learned

┌─────────────────────────────────────────────────────────────────────────┐
│ STUDENT MODE (Production Phase)                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Extension loads rules from Supabase/DynamoDB                        │
│  2. Uses Cheerio (server-side) or DOM API (client-side)                │
│  3. Extracts data using learned CSS selectors                           │
│  4. No AI needed = $0 cost                                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Extension (Browser)
        ↓
Detects new domain
        ↓
Check Supabase scraping_rules
        ↓
┌───────────────────────┐
│ Rules exist?           │
└───────────────────────┘
    │              │
   YES            NO
    │              │
    ↓              ↓
Student Mode   Teacher Mode
(Cheerio)      (Gemini 3 Pro)
    │              │
    │              ↓
    │         Learn selectors
    │              │
    │              ↓
    │         Save to Supabase
    │              │
    └──────────────┘
           ↓
    Extract data
           ↓
    Send to /api/ingest/browser
```

### Future: Learning from AWS Parsing Rules

**Once AWS parsing rules are complete:**
- Extension will sync rules from AWS DynamoDB `leo-scraping-rules`
- Extension can learn from rules created during harvest
- Extension can also create new rules (Teacher Mode) → syncs back to AWS

---

## 👥 Pro/Client Relationship Model

### Current State

**Status**: ❓ **NOT CLEARLY MODELED IN DB**

**What exists:**
- `listings.agent_notes` - Notes from buyer agent about property
- No explicit `pro_clients` or `client_relationships` table

### Proposed Model

#### Option 1: Clients DON'T Log In (Simpler)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PRO CLIENTS TABLE                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CREATE TABLE pro_clients (                                            │
│    id UUID PRIMARY KEY,                                                │
│    pro_user_id UUID REFERENCES auth.users(id),                         │
│                                                                         │
│    -- Client info (no auth account)                                    │
│    name TEXT NOT NULL,                                                 │
│    email TEXT,                                                          │
│    phone TEXT,                                                          │
│                                                                         │
│    -- Lifestyle profile (from intake)                                  │
│    lifestyle_profile_id UUID REFERENCES user_lifestyle_profiles(id),   │
│                                                                         │
│    -- Status                                                           │
│    status TEXT DEFAULT 'active',                                       │
│    created_at TIMESTAMPTZ DEFAULT NOW()                                 │
│  );                                                                    │
│                                                                         │
│  -- Shortlists belong to clients                                       │
│  CREATE TABLE client_shortlists (                                      │
│    id UUID PRIMARY KEY,                                                │
│    client_id UUID REFERENCES pro_clients(id),                          │
│    listing_id BIGINT, -- DynamoDB listing ID                          │
│    added_at TIMESTAMPTZ DEFAULT NOW()                                   │
│  );                                                                    │
│                                                                         │
│  -- Viewings belong to clients (but pro can view)                      │
│  CREATE TABLE viewings (                                               │
│    id UUID PRIMARY KEY,                                                │
│    client_id UUID REFERENCES pro_clients(id),                          │
│    listing_id BIGINT,                                                  │
│    -- ... rest of viewing fields                                       │
│  );                                                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Flow:**
- Pro creates client → No login needed
- Pro sends intake link → Client talks to Leo → Profile created
- Client gets shortlist link → Views properties → Takes notes
- Pro sees everything via their dashboard

**Pros:**
- ✅ Simpler (no client auth)
- ✅ Faster onboarding
- ✅ Pro manages everything

**Cons:**
- ❌ Client can't access their own data directly
- ❌ Client can't update profile themselves

#### Option 2: Clients DO Log In (More Complex)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PRO CLIENTS TABLE (with auth)                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CREATE TABLE pro_clients (                                            │
│    id UUID PRIMARY KEY,                                                │
│    pro_user_id UUID REFERENCES auth.users(id),                         │
│    client_user_id UUID REFERENCES auth.users(id), -- Client has account│
│                                                                         │
│    -- Relationship                                                      │
│    relationship_type TEXT DEFAULT 'client',                             │
│    created_at TIMESTAMPTZ DEFAULT NOW()                                 │
│  );                                                                    │
│                                                                         │
│  -- Client uses their own account                                      │
│  -- But pro can see their data via pro_user_id                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Flow:**
- Pro creates client → Invites via email
- Client signs up → Gets account
- Client linked to pro via `pro_clients` table
- Client can access their own dashboard
- Pro can see client's data via relationship

**Pros:**
- ✅ Client has own account
- ✅ Client can update profile
- ✅ More professional

**Cons:**
- ❌ More complex (auth flow)
- ❌ Slower onboarding
- ❌ Need to handle client auth + pro access

### Recommendation for MVP

**Start with Option 1 (Clients DON'T log in):**
- Faster to build
- Pro manages everything (simpler UX)
- Can add client login later if needed

**Migration path:**
- If clients need accounts later → Add `client_user_id` column
- Migrate existing clients → Create accounts → Link them

---

## 🔗 Secure Link Flow (Client Access)

### How Clients Access Their Shortlist

**Key Point**: Clients access everything via **secure shareable links** (no login required).

### Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. PRO CREATES CLIENT                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Pro adds client → System generates secure token                        │
│  Token:  (UUID, not guessable)                            │
│                                                                         │
│  Client gets:                                                            │
│  • Intake link: leo.casa/intake/[token] (if pro sends link)            │
│  • Shortlist link: leo.casa/shortlist/[token] (permanent)              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

                              ↓ Pro sends link

┌─────────────────────────────────────────────────────────────────────────┐
│ 2. CLIENT RECEIVES LINK                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Via WhatsApp/Email:                                                    │
│                                                                         │
│  "Hola Juan, aquí tienes tu shortlist con los pisos que                 │
│   hemos encontrado: leo.casa/shortlist/"                    │
│                                                                         │
│  Client can:                                                            │
│  • Bookmark the link                                                    │
│  • Use it anytime (no expiration)                                       │
│  • Share with partner/family                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

                              ↓ On viewing day

┌─────────────────────────────────────────────────────────────────────────┐
│ 3. CLIENT OPENS SHORTLIST                                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  leo.casa/shortlist/                                        │
│                                                                         │
│  Shows:                                                                 │
│  • All properties in their shortlist                                   │
│  • Status (added, wants to view, visited)                              │
│  • Fit scores                                                           │
│                                                                         │
│  Client clicks property → Opens property page                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

                              ↓ During viewing

┌─────────────────────────────────────────────────────────────────────────┐
│ 4. CLIENT TAKES NOTES                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Property page shows:                                                    │
│  • Note-taking interface (same as direct users)                         │
│  • Chat-style notes                                                     │
│  • "Viewing Complete" button                                            │
│                                                                         │
│  Notes are saved to:                                                    │
│  • viewings table (linked to client_id + listing_id)                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

                              ↓ After viewing

┌─────────────────────────────────────────────────────────────────────────┐
│ 5. PRO SEES NOTES                                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Pro dashboard shows notification:                                      │
│  "📝 Juan ha añadido 3 notas en Balmes 156"                           │
│                                                                         │
│  Pro clicks → Sees same note-taking interface (read-only)               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
-- Clients table with secure token
CREATE TABLE pro_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_user_id UUID REFERENCES auth.users(id) NOT NULL,
  
  -- Client info (no auth account)
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  
  -- Secure access token (for shareable links)
  shortlist_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  intake_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  
  -- Lifestyle profile (from intake)
  lifestyle_profile_id UUID REFERENCES user_lifestyle_profiles(id),
  
  -- Status
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast token lookup
CREATE INDEX idx_pro_clients_shortlist_token ON pro_clients(shortlist_token);
CREATE INDEX idx_pro_clients_intake_token ON pro_clients(intake_token);

-- Shortlists belong to clients
CREATE TABLE client_shortlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES pro_clients(id) ON DELETE CASCADE,
  listing_id BIGINT NOT NULL, -- DynamoDB listing ID
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES auth.users(id), -- Pro user who added it
  
  -- Status
  status TEXT DEFAULT 'added', -- 'added', 'wants_to_view', 'viewed'
  
  UNIQUE(client_id, listing_id)
);

-- Viewings belong to clients (but pro can view)
CREATE TABLE viewings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES pro_clients(id) ON DELETE CASCADE,
  listing_id BIGINT NOT NULL,
  
  -- Viewing state
  status TEXT DEFAULT 'in_progress',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- ... rest of viewing fields
);
```

### Security Considerations

**Token Security:**
- UUID tokens (not sequential, not guessable)
- Pro can regenerate token if compromised
- Tokens don't expire (but pro can revoke access)
- No sensitive data in URL (just token)

**Access Control:**
- Token lookup → Get `client_id` → Verify `pro_user_id` matches
- Pro can see all their clients' data
- Client can only see their own shortlist (via token)

### Pro Actions

| Action | What Happens |
|--------|--------------|
| **Create client** | System generates `shortlist_token` + `intake_token` |
| **Send intake link** | Pro sends `leo.casa/intake/[intake_token]` |
| **Send shortlist link** | Pro sends `leo.casa/shortlist/[shortlist_token]` |
| **Regenerate token** | Pro can revoke old link, generate new one |
| **View client notes** | Pro sees via dashboard (read-only) |

### Client Experience

| Step | What Client Sees |
|------|------------------|
| **Receives link** | WhatsApp/Email with shortlist link |
| **Opens shortlist** | All their properties, fit scores, status |
| **Clicks property** | Property page with note-taking interface |
| **Takes notes** | Same interface as direct users |
| **Completes viewing** | Reassessment shown (same as direct users) |
| **Pro sees notes** | Pro gets notification, can view read-only |

---

## 📊 Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HARVEST (Automated, 3x daily)                                           │
│   Crawl → Download → Parse → DynamoDB                                  │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ RECOMMENDER (On-demand, triggered by user)                              │
│   Profile → Sweet Spot → Filter → WPA → Score → Recommendations        │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ ANALYSIS (On-demand, triggered by user/pro)                             │
│   Ingest → Text → Photos → Search → Report                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Changelog

| Date | Change |
|------|--------|
| Dec 1, 2024 | Initial architecture flows documentation |
| Dec 1, 2024 | Recommender system flow (R1-R5) |
| Dec 1, 2024 | Harvest → Ingest → Analysis pipeline |
| Dec 1, 2024 | Extension Teacher/Student mode (future state) |
| Dec 1, 2024 | Pro/Client relationship model (proposed) |

