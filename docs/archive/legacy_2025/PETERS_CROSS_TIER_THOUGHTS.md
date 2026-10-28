# Peter's Cross-Tier Thoughts

**Date:** 2025-01-27  
**Context:** Tier progression logic refinement for renovation pipeline

---

## Priority 1: Personal Shopper Inmobiliario Workflow

**Date:** 2025-01-27  
**Context:** Complete workflow for Personal Shopper Inmobiliario users to manage listings from URL input through analysis completion

### Overview

A complete end-to-end workflow that allows Personal Shopper Inmobiliario users to:
1. Input a listing URL
2. Watch the scraper process it
3. Review and edit scraped data
4. Organize photos through clustering
5. Set photo visibility
6. Submit for analysis queue
7. Access completed deep dives from dashboard
8. Edit listing info and clustering after completion
9. Save chat state when logged in

### Workflow Steps

#### Step 1: URL Input & Scraping
- **Input:** User enters listing URL (e.g., Idealista URL)
- **Process:** Scraper runs and extracts property data
- **UI:** Show real-time scraping progress/status
- **Output:** Raw scraped data displayed for review

#### Step 2: Review & Edit Main Info
- **Display:** All main property information from scraper
  - Title, price, location, area, rooms, etc.
  - Property description
  - Basic property features
- **Edit Capability:** User can edit any field
- **Save:** Changes saved to `listings` table
- **UI:** Form-based editing interface with validation

#### Step 3: Photo Clustering & Visibility
- **Display:** All scraped photos
- **Clustering:** User organizes photos into room clusters
  - Drag-and-drop interface
  - Manual room assignment
  - Create/edit/delete clusters
- **Visibility:** User sets which photos are visible in final deep dive
  - Toggle visibility per photo
  - Bulk visibility controls
- **Save:** Clustering and visibility saved to `manual_photo_clusters` and photo metadata

#### Step 4: Submit for Analysis Queue
- **Action:** User clicks "Submit for Analysis"
- **Process:** Listing added to analysis queue
- **Status:** Listing status set to "queued" or "processing"
- **UI:** Show queue position and estimated wait time
- **Notification:** User notified when analysis starts/completes

#### Step 5: Dashboard Access
- **Location:** Personal Shopper dashboard
- **Display:** List of all listings with status
  - Queued
  - Processing
  - Completed
  - Failed
- **Actions:** 
  - View deep dive link (when completed)
  - Edit main info
  - Edit clustering/visibility
  - Re-submit for analysis (if needed)

#### Step 6: View & Edit Completed Deep Dive
- **View:** Click deep dive link → opens Deep Dive V2 UI
- **Edit Main Info:** 
  - Access from dashboard
  - Edit property information
  - Changes reflected in deep dive
- **Edit Clustering/Visibility:**
  - Access from dashboard
  - Re-organize photos
  - Change visibility settings
  - Re-run analysis if needed (optional)

### Technical Requirements

#### Authentication & State Management
- **User Authentication:** Required for Personal Shopper Inmobiliario role
  - See [Secure Auth & RLS Architecture](./SECURE_AUTH_RLS_ARCHITECTURE.md) for complete authentication strategy, roles, and RLS policies
- **Chat State Saving:** 
  - Save conversation state when user is logged in
  - Persist across sessions
  - Restore on login
- **Session Management:** Track user's listings and progress

#### Database Schema
- **Listings Table:** Store scraped + edited property data
- **Analysis Queue:** Track listing analysis status
- **User Listings:** Link listings to users (Personal Shopper role)
- **Chat State:** Store conversation state per user/listing

#### API Endpoints Needed
- `POST /api/scrape/idealista/` - Scrape listing URL (existing)
- `PUT /api/listings/[id]/info` - Update main property info
- `POST /api/listings/[id]/clustering` - Save photo clustering
- `PUT /api/listings/[id]/photos/[photoId]/visibility` - Set photo visibility
- `POST /api/listings/[id]/submit-analysis` - Add to analysis queue
- `GET /api/dashboard/listings` - Get user's listings with status
- `GET /api/listings/[id]/status` - Get analysis status
- `POST /api/chat/save-state` - Save chat state
- `GET /api/chat/restore-state` - Restore chat state

#### UI Components Needed
- **URL Input Form:** Enter listing URL
- **Scraping Progress:** Show scraper status
- **Property Info Editor:** Edit main property fields
- **Photo Clustering Interface:** Organize photos (existing component)
- **Visibility Controls:** Toggle photo visibility
- **Submit Button:** Queue for analysis
- **Dashboard:** List of user's listings
- **Status Indicators:** Show analysis progress

### User Experience Flow

```
1. Login as Personal Shopper Inmobiliario
   ↓
2. Enter listing URL → Scraper runs → See progress
   ↓
3. Review scraped data → Edit main info → Save
   ↓
4. Organize photos → Set visibility → Save
   ↓
5. Click "Submit for Analysis" → Added to queue
   ↓
6. Navigate to Dashboard → See listing status
   ↓
7. When completed → Click deep dive link
   ↓
8. View deep dive OR edit info/clustering from dashboard
```

### Implementation Priority

**Phase 1: Core Workflow**
1. URL input and scraping with progress display
2. Property info editing interface
3. Photo clustering and visibility controls
4. Analysis queue submission
5. Basic dashboard with listing status

**Phase 2: State Management**
1. Chat state saving for logged-in users
2. Session persistence
3. State restoration on login

**Phase 3: Advanced Editing**
1. Edit main info after analysis completion
2. Edit clustering/visibility after completion
3. Re-run analysis with updated data (optional)

### Success Criteria

- ✅ User can enter URL and see scraper work in real-time
- ✅ User can edit all main property information
- ✅ User can organize photos and set visibility
- ✅ User can submit listing to analysis queue
- ✅ User can see listing status in dashboard
- ✅ User can access deep dive link when ready
- ✅ User can edit info and clustering after completion
- ✅ Chat state is saved and restored for logged-in users

---

## Core Principle: Additive Enhancement, Not Replacement

### Rule 1: Each Tier Must Include Everything from Previous Tiers
- **Estándar** → **Óptimo**: Óptimo includes ALL Estándar items + new items
- **Óptimo** → **Plus**: Plus includes ALL Óptimo items (which includes Estándar) + new items
- This ensures progression is cumulative, not replacement-based

### Rule 2: Existing Items Should Be Enhanced, Not Replaced
- If Estándar has "Paint walls", Óptimo should have "Smooth and paint walls" (enhancement)
- If Óptimo has "Replace floors with porcelain", Plus should have "Upgrade porcelain floors to wood/stone" (enhancement)
- **Never** have Plus replace something that Óptimo already did

### Rule 3: Budget Calibration (Glue Step) Constraints
The glue step (budget calibration) can:
- ✅ **Tone down upgrades** (e.g., "premium materials" → "high-quality materials")
- ✅ **Cut NEW items** that were added in the current tier
- ❌ **NEVER remove items** that exist in previous tiers
- ❌ **NEVER downgrade** items from previous tiers below their base level

### Rule 4: Deep and Wide Thinking Required
This requires understanding:
- **What makes sense to enhance** (paint → smooth and paint → premium finishes)
- **What should be additive** (new rooms, new systems, new features)
- **What's redundant** (installing a pool fence twice vs. upgrading an existing one)
- **Common sense progression** (basic → functional → premium)

## Current Issues Identified

### Issue 1: Flooring Redundancy
- **Estándar**: Polish existing marble floors
- **Óptimo**: Replace ALL floors with porcelain
- **Plus**: Replace floors AGAIN with wood/stone
- **Problem**: Plus replaces what Óptimo already replaced
- **Fix**: Plus should say "Upgrade porcelain floors to wood (bedrooms) and stone (living areas)"

### Issue 2: Pool Fence Duplication
- **Estándar**: Install basic pool safety fence
- **Óptimo**: Install modern pool fence (removed in calibration)
- **Problem**: Óptimo duplicates Estándar's work
- **Fix**: Óptimo should say "Upgrade pool fence to modern design (glass panels)"

### Issue 3: Kitchen Missing in Estándar
- **Estándar**: No kitchen work
- **Óptimo**: Complete kitchen renovation
- **Problem**: Jumps from nothing to full renovation
- **Fix**: Estándar should include basic kitchen cleaning/minor fixes

### Issue 4: Plus Tier Scope Issues
- **plus-01**: Remove all furniture (overlaps with est-09)
- **plus-12**: Renovate walls/ceilings (should upgrade opt-04, not replace)
- **Problem**: Plus redoes work instead of enhancing it
- **Fix**: Plus should enhance existing work, not replace it

## Implementation Notes

- This is a **refinement** - will be addressed once the pipeline works end-to-end
- Requires changes to:
  1. Seed scope generation logic (ensure additive progression)
  2. Budget calibration logic (prevent removal of previous-tier items)
  3. Prompt engineering (emphasize enhancement vs. replacement)
- The goal is **money stretching** - making each tier feel like a natural progression where you get more value, not just different value

## Example: Correct Progression

### Estándar
- Paint walls (basic)
- Polish floors (maintenance)
- Clean bathrooms (basic)
- Install pool fence (safety requirement)

### Óptimo (includes Estándar + enhancements)
- ✅ Smooth and paint walls (enhanced from Estándar paint)
- ✅ Replace floors with porcelain (enhanced from Estándar polish)
- ✅ Complete bathroom renovation (enhanced from Estándar clean)
- ✅ Upgrade pool fence to modern design (enhanced from Estándar basic)
- ➕ NEW: Kitchen renovation
- ➕ NEW: Electrical upgrade

### Plus (includes Óptimo + enhancements)
- ✅ Premium wall finishes (enhanced from Óptimo smooth/paint)
- ✅ Upgrade porcelain floors to wood/stone (enhanced from Óptimo porcelain)
- ✅ Luxury bathroom renovation (enhanced from Óptimo complete renovation)
- ✅ Premium pool fence design (enhanced from Óptimo modern)
- ✅ Luxury kitchen renovation (enhanced from Óptimo kitchen)
- ✅ Premium electrical with domotics (enhanced from Óptimo electrical)
- ➕ NEW: Climate control system
- ➕ NEW: Outdoor kitchen

---

## Future Enhancements

### Enhancement 1: Property Value-Based Budget Thinking
**Idea:** Add a step before tier ideation that explicitly considers property value and buyer psychology.

**Rationale:**
- Cheap properties (e.g., €100k) attract two buyer types:
  - **Money-conscious buyers**: Limited renovation budget, want basic/functional
  - **Value-seekers**: Have money but prefer cheaper house + bigger renovation budget
- Expensive properties (e.g., €1M+) attract buyers who:
  - Expect premium finishes to match property value
  - Have budget for luxury renovations
  - Want renovations that justify the property's premium positioning

**Implementation:**
- Add step: `/api/listings/[id]/tiers/budget-context` (before ideation)
- Calculate budget ranges as percentages of property value:
  - Estándar: 5-10% of property value
  - Óptimo: 15-25% of property value  
  - Plus: 30-50% of property value
- Consider buyer psychology based on property price point
- Pass budget context to tier ideation step

**User Control:**
- Allow users to set their **maximum renovation budget**
- System adjusts tier recommendations based on:
  - Property value
  - User's max budget
  - Buyer psychology for that price point

### Enhancement 2: User-Directed Renovation Preferences
**Idea:** Allow users to indicate specific renovations they're interested in, and generate 3 tier options for those specific areas.

**Use Case:**
- User says: "I'm interested in renovating the kitchen and bathrooms"
- System generates:
  - **Estándar Kitchen**: Basic refresh (€X-Y)
  - **Óptimo Kitchen**: Modern renovation (€X-Y)
  - **Plus Kitchen**: Luxury renovation (€X-Y)
- Same for bathrooms, etc.

**Implementation:**
- Add user input step: `/api/listings/[id]/tiers/user-preferences`
- Store user-selected renovation areas (kitchen, bathrooms, floors, etc.)
- Modify tier ideation to focus on user-selected areas
- Generate tier-specific options for each selected area
- Show comparative view: "Here are 3 ways to renovate your kitchen"

**Benefits:**
- More personalized recommendations
- Users can explore specific areas they care about
- Clearer decision-making (compare 3 kitchen options vs. whole-house tiers)

---

## Style Direction and Cost Impact

**Date:** 2025-01-27  
**Context:** Style choices massively affect renovation costs - need to move style direction earlier in pipeline

### The Problem: Style Can Swing Costs by 30-150%

Style choices can dramatically affect renovation costs for the same floor plan and scope:

| Style Category | Typical €/m² Range (Spain) | Description |
|---------------|---------------------------|-------------|
| **Basic / Livable** | 350–700 €/m² | IKEA kitchens, laminate floors, simple white tiling, minimal lighting |
| **Contemporary / Mid-range** | 700–1,200 €/m² | Custom joinery, microcement, recessed lighting, larger tiles, better insulation |
| **High-design / Architectural** | 1,200–2,500+ €/m² | Bespoke carpentry, stone, polished concrete, integrated lighting, curved walls, seamless detailing |

### Why Style Matters for Cost

1. **Finish Level = Primary Cost Driver**
   - Most cost variation comes from **materials and detailing**, not structure
   - Same scope can cost 30-150% more depending on style choices

2. **Style Impacts Labour Intensity**
   - **Minimalist / seamless:** Hidden door frames, flush skirting, integrated handles → higher precision, slower installation
   - **Rustic / reclaimed:** Requires sourcing irregular materials, custom fitting
   - **Classic / ornate:** Plaster mouldings, trims, bespoke joinery → high craftsmanship hours

3. **Supply Chain and Availability**
   - Imported materials (e.g., terrazzo slabs, Italian fixtures, specialty woods) increase both lead time and margin stacking

4. **Compatibility With Existing Structure**
   - Loft/industrial look often means *exposing* structure (demolition + refinishing)
   - Traditional or luxe styles often mean *concealing* structure (false ceilings, panelling)

5. **Design-to-Execution Complexity**
   - Architectural or design-led styles need more **professional hours** (architect, interior designer, 3D visualizations, on-site supervision)
   - Those soft costs alone can add 10–25%

### Current Issue: Style Decided Too Late

Currently, style direction is generated in Q1 (after-image generation pipeline), which happens **AFTER** all cost decisions are made:
- Tier scopes are finalized without considering style costs
- Budget calibration happens without style context
- Element decisions are made without knowing if we're going for "Mediterranean luxury" (expensive ornate fixtures) vs "Contemporary minimalism" (expensive precision work) vs "Industrial loft" (cheaper exposed pipes)

### Solution: Move Style Direction Between T2 and T3

Insert style direction generation between:
- **T2:** Tier Ideation (defines abstract ambition level)
- **T3:** Apply to Groups (translates philosophy into family directives)

This ensures:
- T3 can make style-aware family directives ("Plus bathrooms = premium fixtures in Mediterranean style")
- T4 can make style-appropriate element decisions
- Budget calibration can account for style-driven material costs

### New Endpoint: T2.5 Style Direction

**Endpoint:** `/api/listings/[id]/tiers/style-direction`

**Inputs:**
- Photos organized by room (from manual_photo_clusters) → detect current aesthetic cues (materials, light, geometry)
- Tier scope from T2 → tells the model how deep the intervention goes
- Basic property info (location, year, type, size)
- **Optional:** Agent style preference (form field - blank unless agent fills out form)
- **Optional:** Buyer style preference (form field - blank unless buyer fills out form)

**Note on Optional Inputs:**
- Agent/buyer style preferences require version control and temporary states
- Add to Peter's notes for now - will implement later
- For now, style direction will be AI-generated based on property context and tier scope

**Output:**
- Tier-specific style directions (one per tier: estandar, optimo, plus)
- Each includes: style summary, color palette, material guidance, design philosophy, key style elements

### Required Changes

1. **Create T2.5 endpoint** - Generate tier-specific style directions
2. **Update T3 (Apply to Groups)** - Use style direction to make style-aware family directives
3. **Update T4 (Decide Elements)** - Use style direction to make style-appropriate element decisions
4. **Update T6 (Budget Calibration)** - Account for style-driven material costs
5. **Remove Q1 style direction endpoint** - No longer needed, style decided earlier
6. **Update Q2/Q3 after-image generation** - Use tier-specific style direction from new location

See `.cursor/plans/tier-style-direction-early-pipeline-20250127.plan.md` for full implementation plan.

---

## Optional Budget Input Pipeline

**Date:** 2025-01-27  
**Context:** Allow agent/buyer to input their budget preference, which customizes tier budgets

### Overview

When agent/buyer provides budget via form, it flows through a reasoning and instruction pipeline that customizes the baseline tier budgets to their specific situation.

### Pipeline Flow

```
T1.5) Tier Budgeting (always runs - baseline brackets)
  ↓
[If agent/buyer provides budget via form]
  ↓
Step 1: Agent/Buyer Budget Reasoning
  ↓ (shows feedback in UI)
[User confirms]
  ↓
Step 2: Agent/Buyer Budget Instruction
  ↓
Step 3: Customised Tier Budgeting
```

### Step 1: Agent/Buyer Budget Reasoning

**Endpoint:** `POST /api/listings/[id]/tiers/budget-reasoning`

**Inputs:**
- User's indicated budget (from form)
- Tier Budgeting output (baseline brackets from T1.5)

**Purpose:**
- Analyze if their budget is high/low/sweet spot relative to property
- Output detailed assessment (not just "low" or "high" - wordy explanation)

**Output:**
- Assessment of budget relative to property
- Explanation of why it's high/low/reasonable
- Shown in UI under their budget input
- Uses Flash Lite for quick response

**Example Outputs:**
- "Your budget of €20,000 is below the minimum realistic renovation cost of €35,000 for this property. The house requires significant work (outdated electrical, plumbing issues, structural concerns) that cannot be addressed within this budget."
- "Your budget of €150,000 is well above typical renovation costs for a property of this size and value. This suggests you're prioritizing premium finishes and are comfortable investing significantly in the renovation."
- "Your budget of €75,000 aligns well with the property's value and condition. This gives you flexibility to choose between the Óptimo and Plus tiers."

### Step 2: Agent/Buyer Budget Instruction

**Endpoint:** `POST /api/listings/[id]/tiers/budget-instruction`

**Inputs:**
- Budget Reasoning output (assessment)
- Property context (state, condition, space, existing features from whole property + room-by-room analysis)
- Tier Budgeting output (baseline brackets)

**Purpose:**
- Decide HOW to act based on assessment + property context
- Generate strategy instruction for Customised Tier Budgeting

**Logic Examples:**

**Budget Low + House in Decent Condition:**
- Instruction: "Their budget is below typical minimums, but the house is in decent condition. Give them all three tiers around their budget - they can achieve good results with their budget given the property's current state."

**Budget Low + House in Bad State:**
- Instruction: "Their budget is below minimums AND the house needs significant work. Give them one tier in their budget (Estándar) and two tiers at realistic numbers (Óptimo/Plus) that will actually get the job done. This encourages them to consider increasing budget, getting a loan, or prioritizing critical work."

**Budget Insanely High:**
- Instruction: "Their budget is super high for this house size/value. They want premium finish and are saving on land cost in exchange for better renovation. Skew tiers toward upper end - don't perfectly spread them, focus on premium options."

**Budget Sweet Spot:**
- Instruction: "Their budget is reasonable and has room to play around with. Give them three tiers nicely spread out so they have good options across the range."

### Step 3: Customised Tier Budgeting

**Endpoint:** `POST /api/listings/[id]/tiers/customised-budgeting`

**Inputs:**
- Tier Budgeting output (baseline brackets)
- Budget Instruction (strategy from Step 2)

**Purpose:**
- Generate new tier budgets that consider user's budget + instruction strategy
- Output format identical to Tier Budgeting, but customized

**Output:**
Same format as Tier Budgeting:
```json
{
  "estandar": { "min_eur": ..., "max_eur": ..., "rationale": "..." },
  "optimo": { "min_eur": ..., "max_eur": ..., "rationale": "..." },
  "plus": { "min_eur": ..., "max_eur": ..., "rationale": "..." }
}
```

But budgets are adjusted based on instruction strategy.

### Implementation Notes

**Form Requirements:**
- Form field for agent/buyer to indicate budget
- Requires version control and temporary states
- Handle after core implementation is complete

**UI Flow:**
1. User enters budget in form
2. Form submits to Budget Reasoning → shows feedback in UI
3. User sees assessment and confirms
4. On confirm → Budget Instruction → Customised Tier Budgeting
5. Customised budgets replace baseline budgets for rest of pipeline

**If No Budget Provided:**
- Pipeline uses baseline Tier Budgeting output (T1.5)
- No reasoning/instruction/customisation steps run

### Required Changes

1. **Create Budget Reasoning endpoint** - Analyze user budget vs baseline
2. **Create Budget Instruction endpoint** - Generate strategy based on assessment + property context
3. **Create Customised Tier Budgeting endpoint** - Generate customized budgets
4. **Add form UI** - Budget input field for agent/buyer
5. **Update pipeline** - Use customised budgets if provided, otherwise baseline

### Future Considerations

- Version control for budget inputs (if user changes budget, need to track versions)
- Temporary states (draft budgets before confirmation)
- Integration with loan/financing options (if budget too low)
- Budget validation (minimum thresholds based on property condition)

---

## Admin Dashboard: Source Management

**Date:** 2025-01-27  
**Context:** Need for admin dashboard to manage source credibility and filtering rules

**Related Documentation:** See [Secure Auth & RLS Architecture](./SECURE_AUTH_RLS_ARCHITECTURE.md) for admin/support role setup, Supabase Studio access, and RLS policies that govern admin dashboard access.

### Overview

An admin dashboard interface that allows administrators to manage source credibility rules, whitelists, and filtering logic used in the citations-sweep pipeline.

### Requirements

#### Source Management Features

1. **Primary Source Whitelist Management**
   - View current primary source domains (government, official agencies, real estate authorities)
   - Add/remove domains from primary whitelist
   - Edit domain patterns (e.g., `.gob.es`, `colegioarquitectos`)
   - Test domain matching against URLs

2. **Category-Specific Source Rules**
   - View trusted sources per category:
     - **Costs/Market**: Price sources (Idealista, Fotocasa, etc.)
     - **Contractors**: Trade sources (professional colleges, associations)
     - **Permits/Laws**: Government-only sources
     - **Neighborhood/Environment**: Market data sources
   - Edit category-specific source lists
   - Add/remove sources per category
   - Configure which categories allow which source types

3. **Title Keyword Filtering**
   - Manage primary title keywords (official documents, regulations)
   - Manage secondary title keywords (blogs, opinion pieces)
   - Add/remove keywords that affect source classification
   - Test keyword matching against page titles

4. **Source Classification Testing**
   - Test URL + title + category → classification result
   - See why a source is classified as primary/secondary
   - Preview evidence pool prioritization
   - Validate changes before applying

5. **Source Quality Metrics**
   - View statistics on source usage:
     - How many primary vs secondary sources per category
     - Most cited domains
     - Source distribution across buyer reports
   - Identify gaps in source coverage
   - Track source quality over time

### Technical Implementation

#### Database Schema
- **Source Rules Table**: Store whitelists, patterns, keywords
- **Category Rules Table**: Link categories to allowed source types
- **Source Classification Log**: Track classification decisions for auditing
- **Source Metrics Table**: Aggregate statistics on source usage

#### API Endpoints Needed
- `GET /api/admin/sources/rules` - Get all source rules
- `PUT /api/admin/sources/rules` - Update source rules
- `POST /api/admin/sources/test-classification` - Test URL classification
- `GET /api/admin/sources/metrics` - Get source usage statistics
- `GET /api/admin/sources/categories` - Get category-specific rules
- `PUT /api/admin/sources/categories` - Update category rules

#### UI Components Needed
- **Source Whitelist Editor**: Manage primary/secondary source lists
- **Category Rules Editor**: Configure sources per category
- **Keyword Manager**: Add/remove title keywords
- **Classification Tester**: Test URL + title + category → result
- **Source Metrics Dashboard**: View usage statistics and trends
- **Audit Log**: View classification decisions and rule changes

### Use Cases

1. **Adding New Trusted Source**
   - Admin identifies new reliable source (e.g., new government portal)
   - Adds domain to appropriate whitelist via dashboard
   - Tests classification to verify it works
   - Changes apply to future citations-sweep runs

2. **Adjusting Category Rules**
   - Admin notices too many secondary sources in "costs" category
   - Adds Idealista to trusted price sources for costs category
   - Future citations prioritize Idealista for cost-related claims

3. **Blocking Low-Quality Sources**
   - Admin identifies blog that's being classified as primary
   - Adds blog domain pattern to secondary list
   - Adds blog-related keywords to secondary title keywords
   - Source is demoted in future classifications

4. **Auditing Source Quality**
   - Admin reviews source metrics dashboard
   - Sees that "permits" category has too many secondary sources
   - Adjusts rules to be stricter for permits category
   - Re-runs citations-sweep for affected listings

### Implementation Priority

**Phase 1: Basic Source Management**
1. View current source rules (read-only)
2. Edit primary/secondary whitelists
3. Test classification for single URL

**Phase 2: Category Rules**
1. View category-specific rules
2. Edit trusted sources per category
3. Configure category strictness levels

**Phase 3: Advanced Features**
1. Title keyword management
2. Source metrics dashboard
3. Classification audit log
4. Bulk rule updates

### Success Criteria

- ✅ Admin can view all current source rules
- ✅ Admin can add/remove sources from whitelists
- ✅ Admin can configure category-specific rules
- ✅ Admin can test classification before applying changes
- ✅ Admin can view source usage statistics
- ✅ Changes apply to future citations-sweep runs
- ✅ Audit trail of rule changes

---

**Status:** Documented for future refinement. Pipeline continues with current logic.

