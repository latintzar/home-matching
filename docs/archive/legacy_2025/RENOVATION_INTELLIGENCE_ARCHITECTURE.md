# Renovation Intelligence Architecture

## Overview

The Renovation Intelligence Pipeline is a comprehensive system that generates realistic renovation recommendations, pricing, and visualizations for Spanish properties. It combines AI analysis with real market research to provide accurate, data-driven renovation insights.

## Architecture Flow

```
Property Analysis → Tier Generation → Market Research → Price Finalization → Visual Generation
```

## Pipeline Stages

### 1. **Tier Generation** (`/api/listings/[id]/renovation/generate-tiers`)
- **Input**: Integrated analysis report from property analysis pipeline
- **Process**: Gemini 2.5 Pro with maximum thinking capabilities
- **Output**: 3 renovation tiers (Estándar, Óptimo, Plus)
- **Data Generated**:
  - Detailed work items with categories, effort levels, and rationale
  - Required permits with explanations (why_needed, what_needed, how_obtained)
  - Timeline with milestones, durations, and dependencies
  - Work item descriptions and scope

### 2. **Work-Item-Specific Search Terms Generation** (`/api/listings/[id]/renovation-research-queries/[tier]/[category]`)
- **Input**: Work items from RenovationScopeReport for specific tier
- **Process**: Generate search queries per work item × research category
- **Output**: Targeted search terms for each work item across 7 categories
- **Categories**: Costs, Timings, Permits, Laws & Regulations, Norms & Standards, Market Practices, Incentives
- **Geographic Scope**: City, Autonomous Community, Spain-wide queries

### 3. **Search Execution** (`/api/listings/[id]/renovation-research-search`)
- **Input**: All generated search terms from stage 2
- **Process**: Google Custom Search API execution
- **Output**: Raw search results with URLs, titles, and snippets
- **Sources**: Spanish contractor websites, material suppliers, permit databases, government portals

### 4. **Work-Item-Specific Curation** (`/api/listings/[id]/renovation-research-curate-[category]/[tier]`)
- **Input**: Search results grouped by work item and category
- **Process**: Gemini 2.5 Flash analysis for factual summarization
- **Output**: Per-work-item summaries with metrics, confidence, and sources
- **Categories**: 7 categories × 3 tiers = 21 curation endpoints

### 5. **Price Finalization** (`/api/listings/[id]/renovation-pricing`)
- **Input**: Work items + curated cost research data
- **Process**: Gemini 2.5 Flash for realistic pricing assignment
- **Output**: Cost ranges for each work item + total estimates
- **Methodology**: Market data + AI reasoning for accurate pricing

### 6. **Timeline Refinement** (`/api/listings/[id]/renovation-timeline`)
- **Input**: Work items + curated timing research data
- **Process**: Gemini 2.5 Pro for detailed scheduling
- **Output**: Refined timelines with dependencies and milestones
- **Features**: Realistic durations based on market research

### 7. **Permits Expansion** (`/api/listings/[id]/renovation-permits`)
- **Input**: Work items + curated permit research data
- **Process**: Gemini 2.5 Pro for comprehensive permit information
- **Output**: Detailed permit procedures, documentation, and timelines
- **Features**: Authority contacts, processing times, common pitfalls

### 8. ~~**Style Prompt Generation** (`/api/listings/[id]/renovation-style-prompts`)~~ - **REMOVED** (replaced by R2b `/after/generate-room-prompts`)
- **Input**: Finalized tier data
- **Process**: Generate stylistic prompts for each tier
- **Output**: Style prompts for image generation
- **Purpose**: Create tier-specific visual style descriptions

### 9. **Image Generation** (`/api/listings/[id]/photos/after/generate-simple`)
- **Input**: Style prompts + before photos
- **Process**: Gemini 2.5 Flash Image
- **Output**: After photos for each tier
- **Features**: Maintains original camera angle and perspective

## Work-Item-Specific Research Architecture

### 🧭 LEVEL 1 — Search-Term Generation Prompts

*(Endpoint: `/renovation-research-queries/[tier]/[category]`)*
These run **once per tier**, but generate **queries per work item × research category** across three scales (city / region / Spain).

#### 🔹 System Prompt

> You are an experienced renovation researcher generating Google search queries for Spain (2024–2025).
> Your goal is to collect real-world, verifiable data for each renovation work item from the RenovationScopeReport.
> For every work item, create search queries under **each research category**:
>
> 1. Costs 2. Timings 3. Permits 4. Laws & Regulations 5. Norms & Standards 6. Market Practices 7. Incentives.
>    Each query must be in natural Spanish and include three geographic scopes: **city**, **autonomous community**, and **España**.
>    Tailor terms to the scale of the work item (e.g., "instalación aire acondicionado split", "reforma baño", "sustitución ventanas PVC").
>    Keep them short (≤ 12 words) and realistic — exactly what a homeowner or contractor would type.

**Output format**

```json
{
  "queries": [
    {
      "work_item_id": "uuid",
      "work_item_name": "Replace flooring",
      "category": "costs",
      "queries": [
        "precio sustitución suelo vinílico Cádiz 2025",
        "precio reforma suelo Andalucía 2025",
        "coste cambio suelo vivienda España 2025"
      ]
    }
  ]
}
```

### 📊 LEVEL 2 — Search-Results Curation Prompts

*(Endpoints: `/renovation-research-curate-[category]/[tier]`)*
Each runs **per tier**, but processes **all snippets grouped by work item and category**.
Output summaries are factual, quantitative where possible, and reference credible sources.

#### 1️⃣ COSTS

> Summarize cost data for each work item (materials + labor + fees) from local, regional, and Spain-wide snippets.
> Express ranges in €/m², €/unit, or € lump sum as appropriate.
> Mention cost drivers (material quality, access, property age, contractor demand).
> Output per-work-item summaries with confidence level and sources.

#### 2️⃣ TIMINGS

> Summarize realistic durations and sequencing for each work item.
> Include prep (design, delivery, scheduling), on-site work, and inspections or testing phases.
> Note total calendar time and main delay factors (municipal backlog, weather, material lead times).
> Output per-work-item summaries with indicative weeks and confidence.

#### 3️⃣ PERMITS

> Summarize permit requirements for each work item.
> State whether it falls under obra menor or mayor, documents needed, responsible authority, and typical processing weeks.
> Include inspection checkpoints and frequent pitfalls (e.g., heritage zones, façade visibility).
> Output per-work-item summaries.

#### 4️⃣ LAWS & REGULATIONS

> Summarize relevant legal or zoning restrictions that apply to each work item.
> Cite applicable codes (PGOU, Ley de Costas, BIC rules, CTE DB-HE/HS).
> Explain practical consequences (e.g., "façade changes require heritage review").
> Output per-work-item summaries with law references and sources.

#### 5️⃣ NORMS & STANDARDS

> Summarize technical standards governing execution of each work item.
> Mention CTE modules (DB-SI, DB-HS, DB-HE), REBT (electrical), RITE (thermal), acoustic norms, etc.
> Describe implications for materials, insulation, or safety inspections.
> Output per-work-item summaries.

#### 6️⃣ MARKET PRACTICES

> Summarize current market conditions affecting each work item — contractor availability, wage trends, subcontractor bottlenecks, seasonal demand, and material supply.
> Highlight regional differences and practical implications for cost or scheduling.
> Output per-work-item summaries with confidence levels.

#### 7️⃣ INCENTIVES

> Summarize financial aids or tax incentives relevant to each work item (e.g., energy upgrades, accessibility improvements, heritage restoration).
> Include program names, typical subsidy %, eligibility basics, and source portals (MITMA, IDAE, Junta regional, Ayuntamiento).
> Output per-work-item summaries.

### 📦 Expected Output Format

```json
{
  "listing_id": "1000000001",
  "tier": "estandar",
  "category": "costs",
  "summaries": [
    {
      "work_item_id": "uuid",
      "work_item_name": "Bathroom modernization",
      "summary": "Replacing fixtures and waterproofing costs 5 000–7 000 € por baño...",
      "confidence": "high",
      "sources": ["habitissimo.com", "arquality.es"],
      "metrics": {
        "low": 5000,
        "high": 7000,
        "unit": "€/bathroom"
      }
    }
  ]
}
```

### ✅ Key Benefits

* **Granular realism:** every figure tied to a tangible work item.
* **Cross-checkable:** per-item sources + confidence.
* **Composable:** feeds directly into pricing, timeline, and permits endpoints.
* **Scalable:** Gemini handles reasoning; your endpoint orchestrates breadth.

## Database Schema

### Core Tables

#### `renovation_tiers`
```sql
CREATE TABLE renovation_tiers (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL,
  tier_name TEXT NOT NULL, -- 'livable', 'comfortable', 'competitive'
  work_items JSONB NOT NULL, -- Array of work items with categories
  permits JSONB NOT NULL, -- Array of permits with explanations
  timeline JSONB NOT NULL, -- Milestones with durations
  total_time_months INTEGER,
  total_cost_min INTEGER,
  total_cost_max INTEGER,
  style_prompts JSONB, -- Generated style prompts for each tier
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `renovation_search_terms`
```sql
CREATE TABLE renovation_search_terms (
  id BIGSERIAL PRIMARY KEY,
  tier_id BIGINT REFERENCES renovation_tiers(id),
  work_item TEXT NOT NULL,
  search_terms JSONB NOT NULL, -- Array of search terms
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `renovation_search_results`
```sql
CREATE TABLE renovation_search_results (
  id BIGSERIAL PRIMARY KEY,
  search_term_id BIGINT REFERENCES renovation_search_terms(id),
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  credibility_score DECIMAL(3,2),
  price_data JSONB, -- Extracted price information
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Data Contracts

### UI Component Data Sources

All UI components pull from the same data sources to ensure consistency:

#### **Project Plan Table**
- **Source**: `renovation_tiers[tier].work_items`
- **Fields**: Work item name, category, description, cost range
- **Real-time**: Supabase subscription for live updates

#### **Timeline Component**
- **Source**: `renovation_tiers[tier].timeline`
- **Fields**: Milestone name, duration, description, order
- **Real-time**: Supabase subscription for live updates

#### **Permits Section**
- **Source**: `renovation_tiers[tier].permits`
- **Fields**: Permit name, explanation, requirements, process
- **Real-time**: Supabase subscription for live updates

#### **Cost Display**
- **Source**: `renovation_tiers[tier].total_cost_min/max`
- **Usage**: Cards on main page + bottom of modal
- **Consistency**: Same data source ensures alignment

#### **Time Display**
- **Source**: `renovation_tiers[tier].total_time_months`
- **Usage**: Cards on main page + timeline component
- **Consistency**: Same data source ensures alignment

## Real-time Data Flow

### Supabase Subscriptions

```typescript
// In RenovationTierModal and test-recommendations page
const { data: renovationTiers } = useSupabaseSubscription(
  'renovation_tiers',
  { listing_id: selectedListingId }
);

const { data: permits } = useSupabaseSubscription(
  'renovation_tiers',
  { listing_id: selectedListingId },
  (data) => data?.permits || []
);
```

### Component Updates

- **Automatic**: UI components update automatically when data changes
- **Consistent**: All components show the same data simultaneously
- **Efficient**: Only changed data triggers re-renders

## API Endpoints

### Core Endpoints

1. **`POST /api/listings/[id]/renovation/generate-tiers`**
   - Generates initial tier data
   - Uses integrated analysis report
   - Stores in `renovation_tiers` table

2. **`POST /api/listings/[id]/renovation/search-terms`**
   - Generates search terms for work items
   - Stores in `renovation_search_terms` table

3. **`POST /api/listings/[id]/renovation/search`**
   - Performs custom search
   - Stores results in `renovation_search_results` table

4. **`POST /api/listings/[id]/renovation/process-credibility`**
   - Processes search results for credibility
   - Updates `renovation_search_results` table

5. **`POST /api/listings/[id]/renovation/finalize-prices`**
   - Finalizes pricing based on market data
   - Updates `renovation_tiers` table

6. **`POST /api/listings/[id]/renovation/generate-style-prompts`**
   - Generates style prompts for image generation
   - Updates `renovation_tiers` table

7. **`POST /api/listings/[id]/photos/after/generate-simple`**
   - Generates after photos (existing)
   - Stores in `after_photos` table

### Orchestration Endpoint

**`POST /api/listings/[id]/renovation/orchestrate-full-pipeline`**
- Runs all 7 steps in sequence
- Provides progress updates via SSE
- Handles errors and retries
- Updates UI in real-time

## Tier Definitions

### Livable Tier
- **Target**: Basic functionality and safety
- **Budget**: Lower-end renovation
- **Scope**: Essential repairs and improvements
- **Timeline**: 2-4 months
- **Permits**: Minimal, basic safety permits

### Comfortable Tier
- **Target**: Modern comfort and efficiency
- **Budget**: Mid-range renovation
- **Scope**: Quality improvements and modern amenities
- **Timeline**: 4-6 months
- **Permits**: Standard renovation permits

### Competitive Tier
- **Target**: Premium quality and market appeal
- **Budget**: High-end renovation
- **Scope**: Luxury finishes and premium features
- **Timeline**: 6-12 months
- **Permits**: Comprehensive permits and inspections

## Data Flow Example

```
1. Property Analysis → Integrated Analysis Report
2. Tier Generation → 3 tiers with work items, permits, timeline
3. Search Terms → "kitchen renovation Barcelona", "bathroom permits Madrid"
4. Custom Search → Contractor websites, material suppliers
5. Credibility Processing → Quality scores, price extraction
6. Price Finalization → Realistic pricing based on market data
7. Style Prompts → "Modern industrial kitchen with concrete countertops"
8. Image Generation → After photos maintaining original perspective
```

## Benefits

### **Data-Driven Accuracy**
- Market research ensures realistic pricing
- Real contractor data informs timelines
- Actual permit requirements guide planning

### **Consistent UI Experience**
- All components pull from same data sources
- Real-time updates keep everything synchronized
- Cards and modals show identical information

### **Scalable Architecture**
- Each pipeline stage can be optimized independently
- New data sources can be added easily
- Pipeline can be extended with additional stages

### **Auditable Process**
- Full traceability from analysis to final output
- Each step is logged and can be reviewed
- Quality metrics track pipeline performance

## Implementation Priority

1. **Database Schema** - Core tables and relationships
2. **Tier Generation** - Core functionality and AI integration
3. **UI Data Integration** - Supabase subscriptions and component updates
4. **Search Pipeline** - Market research stages (2-4)
5. **Price Finalization** - AI reasoning with market data
6. **Style Prompts** - Visual generation preparation
7. **Pipeline Orchestration** - Full automation and monitoring

## Future Enhancements

- **Contractor Matching**: Connect with local contractors
- **Permit Automation**: Streamline permit application process
- **Cost Tracking**: Real-time cost monitoring during renovation
- **Progress Updates**: Photo-based progress tracking
- **Market Analysis**: Regional pricing trends and insights

---

*This architecture provides a comprehensive, data-driven approach to renovation intelligence that combines AI analysis with real market research to deliver accurate, actionable insights for property renovation projects.*
