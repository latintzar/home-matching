# Tech Stack & Services

**Last Updated**: December 1, 2024

---

## 🎯 Core Application Stack

### Frontend
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **State Management**: React hooks and context
- **Deployment**: Vercel

### Backend
- **Runtime**: Next.js API Routes (serverless functions on Vercel)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **File Storage**: Supabase Storage (for user uploads, photos)

### Authentication & User Management
- **Provider**: Supabase Auth
- **Methods**: Email/password, Google OAuth, Apple OAuth
- **User Profiles**: Stored in Supabase `auth.users` + custom `user_profiles` table

---

## 🤖 AI & ML Services

### Google Cloud Vertex AI
- **Primary AI Provider**: Google Cloud Vertex AI
- **Models Used**:
  - `gemini-3-pro-preview` (for complex reasoning, Teacher Mode)
  - `gemini-2.5-flash` (for fast operations)
  - `gemini-2.5-flash-lite` (for lightweight tasks)
- **Use Cases**:
  - Property text analysis
  - Photo analysis (Gemini Vision)
  - Sweet spot generation
  - Fit scoring
  - Report synthesis
  - Harvest selector learning (Teacher Mode)
- **Authentication**: Service account JSON key file
- **Endpoint**: Publisher endpoint (`https://aiplatform.googleapis.com/v1/publishers/google/models/...`)

### ElevenLabs
- **Service**: Conversational AI agents
- **Use Cases**:
  - User intake conversations (Leo Intake v2)
  - Pro intake conversations (Leo Pro Intake)
  - Voice/chat interface for lifestyle profiling
- **Features**:
  - Function calling (server-side tool calls)
  - Multilingual support
  - Voice synthesis
- **Agents**:
  - `Leo Intake v2` - For direct buyers/renters
  - `Leo Pro Intake` - For personal shoppers/relocation agents

### AWS Bedrock (Harvest Engine)
- **Service**: AWS Bedrock (for harvest classification)
- **Model**: Mistral (via Bedrock)
- **Use Case**: Classifying harvested HTML pages (property vs non-property)

---

## 💰 Payment & Subscription

### Stripe
- **Service**: Stripe Checkout + Customer Portal
- **Use Cases**:
  - Subscription management (B2C and Pro)
  - Payment processing
  - Invoice generation
  - Customer portal (subscription management)
- **Integration**:
  - Stripe Checkout for all payments (hosted by Stripe)
  - Stripe Customer Portal for subscription management
  - Webhook handling for subscription events
- **Principle**: Don't manage subscriptions ourselves — use Stripe's hosted solutions

---

## ☁️ AWS Infrastructure (Harvest Engine)

### EC2
- **Use Case**: Initial harvest crawl (40-60 hour job)
- **Instance Type**: Spot instances (cost-effective)
- **Cost**: ~$0.50 for full crawl
- **Purpose**: Download ~1-2M HTML pages from agency websites

### Lambda
- **Use Cases**:
  - Daily harvest delta (3x per day)
  - Daily parse (classify harvested pages)
  - Selector repair (fix broken CSS selectors)
- **Configuration**: 512MB memory, 10 min timeout
- **Scheduling**: AWS EventBridge (cron jobs)
- **Cost**: ~$0.50-2/month

### DynamoDB
- **Tables**:
  - `leo-listings` - Parsed property data (bulk storage)
  - `leo-scraping-rules` - Domain-specific CSS selectors
  - `leo-wpa-cache` - Whole Property Analysis cache
  - `leo-urls` - Harvested URL tracking
- **Purpose**: Bulk data storage (moved from Supabase for cost)
- **Cost**: ~$0.75-1/month

### S3
- **Bucket**: `puedo-casa-html-archive`
- **Purpose**: Store raw HTML files from harvest
- **Structure**: `{domain}/{url-hash}.html`
- **Size**: ~275 GB
- **Cost**: ~$6.50-10/month

### EventBridge
- **Purpose**: Schedule Lambda functions (cron jobs)
- **Schedules**:
  - Daily harvest (morning, midday, evening)
  - Daily parse
  - Selector repair

---

## 🗄️ Database Strategy

### Supabase (PostgreSQL)
**What Lives Here:**
- User authentication (`auth.users`)
- User profiles (`user_profiles`)
- User lifestyle profiles (`user_lifestyle_profiles`)
- Subscriptions (`subscriptions`)
- Viewings & notes (`viewings`, `viewing_notes`)
- Shortlists (`shortlists`)
- Analytics events (`analytics_events`)
- Deep dives (`deepdives`)
- Intelligent consideraciones (`intelligent_consideraciones`)
- **Total**: ~15MB (fits in free tier)

### DynamoDB
**What Lives Here:**
- Bulk listing data (`leo-listings`)
- Harvested URLs (`leo-urls`)
- Scraping rules (`leo-scraping-rules`)
- WPA cache (`leo-wpa-cache`)
- **Total**: ~3M items

**Why Split:**
- Supabase free tier: 500MB limit
- Bulk data (listings, analyses) → DynamoDB (cheaper at scale)
- User-facing data → Supabase (better for auth, RLS, real-time)

---

## 🔍 Scraping & Data Collection

### Scrapfly
- **Service**: Web scraping API
- **Use Case**: Robust scraping for Idealista and other portals
- **When Used**: Server-side scraping (fallback for extension)

### Self-Hosted Nominatim
- **Service**: Geocoding (self-hosted on EC2)
- **Instance**: `puedo-casa-nominatim` (c5.xlarge, 8GB RAM)
- **Instance ID**: `i-0890cad762bc0c8c7`
- **IP**: `3.230.148.50:8080`
- **Data**: Spain OSM (~70GB PostgreSQL)
- **Use Case**: Geocoding addresses for Lucas Fox, Century21, RE/MAX, aProperties

### Browser Extension
- **Technology**: Chrome Extension (TypeScript)
- **Use Case**: Client-side scraping (Teacher Mode)
- **Purpose**: Learn CSS selectors for new domains
- **Storage**: Local storage + syncs to Supabase

---

## 📧 Communication Services

### WhatsApp Business API
- **Use Case**: Send property alerts to users
- **Integration**: Via WhatsApp Business API or Twilio
- **Content**: Property photos + fit scores + summaries

### Email (SMTP)
- **Provider**: TBD (could be SendGrid, Resend, etc.)
- **Use Case**: Property alerts, transactional emails
- **Content**: Same as WhatsApp (property photos + fit scores)

---

## 🛠️ Development Tools

### Version Control
- **Git**: GitHub
- **Branching**: `master` branch (Vercel auto-deploys)

### Package Management
- **npm**: Node package manager
- **Lock File**: `package-lock.json`

### Environment Management
- **File**: `.env.local` (local development)
- **Vercel**: Environment variables (production)

---

## 📊 Analytics & Monitoring

### Supabase Analytics
- **Table**: `analytics_events`
- **Purpose**: Track user funnel events
- **Queries**: SQL views for funnel analysis

### Vercel Analytics
- **Service**: Vercel Analytics (built-in)
- **Purpose**: Page views, performance metrics

---

## 🔐 Security & Secrets

### Environment Variables
- **Local**: `.env.local` (gitignored)
- **Vercel**: Environment variables dashboard
- **Secrets**:
  - Supabase keys (anon + service role)
  - Google Cloud credentials (service account JSON)
  - Stripe keys (publishable + secret)
  - AWS credentials (for harvest)
  - ElevenLabs API key

### Authentication
- **Supabase Auth**: Handles all user authentication
- **RLS**: Row Level Security policies on all tables
- **API Security**: CRON_SECRET for protected endpoints

---

## 🚀 Deployment

### Vercel
- **Platform**: Vercel (Next.js hosting)
- **Deployment**: Automatic via Git push
- **Environment**: Production + Preview deployments
- **Functions**: Serverless API routes

### AWS
- **Services**: EC2, Lambda, DynamoDB, S3, EventBridge
- **Region**: `us-east-1` (primary)
- **Management**: AWS CLI + Console

---

## 💵 Cost Breakdown (Monthly)

| Service | Purpose | Cost |
|---------|---------|------|
| **Supabase** | Database + Auth (free tier) | $0 |
| **Vercel** | Hosting (hobby plan) | $0-20 |
| **Google Cloud** | Vertex AI (Gemini) | ~€50-100 |
| **ElevenLabs** | Conversational AI | ~$50-200 |
| **Stripe** | Payment processing | 2.9% + $0.30 per transaction |
| **AWS** | Harvest infrastructure | ~$8-10 |
| **S3** | HTML storage (275 GB) | ~$6.50 |
| **DynamoDB** | Listing data (3M items) | ~$0.75 |
| **Lambda** | Daily harvest/parse | ~$0.50-2 |
| **EC2** | Nominatim (geocoding) | ~$15 |
| **Scrapfly** | Web scraping API | Pay-per-use |
| **Total** | | ~$100-300/month |

**Note**: AWS credits ($1,100) cover ~4+ years of infrastructure costs.

---

## 📝 Key Files & Configurations

### Environment Variables Template
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# ElevenLabs
ELEVENLABS_API_KEY=

# AWS (for harvest)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

# Security
CRON_SECRET=
```

### Service Account Files
- `fifth-incentive-471523-b1-09ed26b7c011.json` - Google Cloud service account

---

## 🔄 Data Flow

```
User → Next.js (Vercel) → Supabase (Auth/User Data)
                      ↓
                  Vertex AI (Analysis)
                      ↓
                  DynamoDB (Bulk Data)
                      ↓
                  S3 (HTML Archive)
```

---

## Changelog

| Date | Change |
|------|--------|
| Dec 1, 2024 | Initial comprehensive tech stack documentation |
| Dec 1, 2024 | Added all services: Stripe, ElevenLabs, AWS, etc. |
| Dec 1, 2024 | Cost breakdown and data flow diagram |

