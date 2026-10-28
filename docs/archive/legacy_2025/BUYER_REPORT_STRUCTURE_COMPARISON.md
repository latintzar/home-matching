# Buyer Report Structure: Before vs After Double-Barrel Refactor

## 📋 CURRENT STRUCTURE (Before Refactor)

### Top-Level Sections (6 sections)

1. **Property Info** (Cover & Snapshot)
   - Title, location, price, last updated
   - Main photo

2. **House as a Whole** (Narrative Synthesis)
   - Narrative synthesis (whole-property + rolled-up room-by-room)
   - Cross-room themes/risks (3-5 bullets)
   - One-line per room with deep links to room sections

3. **House Diagnostics** (7 technical categories)
   - `estado_materiales` - Materials & condition
   - `espacios_distribucion` - Layout & distribution
   - `entorno_vistas` - Light, views, orientation
   - `servicios_instalaciones` - MEP hints (plumbing, electrical, HVAC)
   - `legal_economico` - Basic compliance or cost cues
   - `seguridad_accesibilidad` - Safety & accessibility
   - `caracter_arquitectonico` - Architectural character
   - **Visible Strengths** (array of positives)
   - **Key Takeaways** (5 concise bullets)

4. **Contextual Analysis** (12 categories)
   - Summary paragraph
   - **12 Categories** (each with stance, evidence, confidence):
     - `permits` - Permits environment & pathways
     - `contractors` - Contractor availability & lead times
     - `seasonality` - Seasonality & work windows
     - `community_rules` - Community/HOA bylaws & building rules
     - `norms_standards` - Local norms/standards
     - `market_practices` - Market practices
     - `cost_context` - Cost context (order of magnitude)
     - `utilities_infrastructure` - Utilities & infrastructure
     - `logistics_access` - Logistics & access
     - `waste_management` - Waste management
     - `noise_environment` - Noise environment
     - `scheduling_windows` - Scheduling windows

5. **Room Findings** (Per-room analysis)
   - Per-room write-ups (photos, findings, uncertainties)
   - Anchors (e.g., `room-<id>`)
   - Uncertainties embedded per-room

6. **Citations & References**
   - Diagnostic citations
   - Contextual citations
   - All sources

---

## 🆕 NEW STRUCTURE (After Double-Barrel Refactor)

### Top-Level Sections (6 sections - same count, different content)

1. **Property Info** (Cover & Snapshot) - ✅ **UNCHANGED**
   - Title, location, price, last updated
   - Main photo

2. **House as a Whole** (Narrative Synthesis) - ✅ **UNCHANGED**
   - Narrative synthesis (whole-property + rolled-up room-by-room)
   - Cross-room themes/risks (3-5 bullets)
   - One-line per room with deep links to room sections

3. **🛡️ CHAPTER 1: FORENSIC RISK AUDIT** - 🆕 **NEW STRUCTURE**
   - **Replaces**: "House Diagnostics" (7 categories) + parts of "Contextual Analysis" (risk-related categories)
   - **Aggregates**: Search results from Mega-Categories 1, 2, 3, 4
   - **Sub-sections**:
     1. **Structural Pathology & Building Health** (Mega 1)
        - Aluminosis, foundation issues, damp, structural defects
        - Replaces: `estado_materiales`, `seguridad_accesibilidad` (safety aspects)
     2. **Environmental Hostility & Sensory Risk** (Mega 2)
        - Flood risk, noise maps, smells, pests, air quality
        - Replaces: `entorno_vistas` (environmental aspects), `noise_environment`
     3. **Social, Security & Neighborhood Context** (Mega 3)
        - Squatters, crime rates, tourism impact, neighborhood conflict
        - New content (not in old structure)
     4. **Urban Legality, Planning & "Ghosts"** (Mega 4)
        - Urban planning, illegal works, licenses, expropriations, tourist bans
        - Replaces: `legal_economico` (legal aspects), `permits` (planning aspects)

4. **🛠️ CHAPTER 2: EXECUTION & REALITY CHECK** - 🆕 **NEW STRUCTURE**
   - **Replaces**: Parts of "Contextual Analysis" (execution-related categories) + integrates Room Analysis costs
   - **Aggregates**: Search results from Mega-Categories 5, 7 + Room-by-Room Analysis
   - **Sub-sections**:
     1. **The "Charm Tax" & Renovation Reality** (Mega 5)
        - Execution costs, permits, contractors, material costs, timelines
        - Replaces: `contractors`, `seasonality`, `cost_context`, `scheduling_windows`
     2. **Infrastructure & Connectivity** (Mega 7)
        - Internet speeds, transport, EV charging, medical access
        - Replaces: `utilities_infrastructure`, `logistics_access`
     3. **Room-by-Room Analysis** (from Photo Analysis)
        - Specific costs for Kitchen/Bath updates found in search
        - Per-room renovation considerations
        - **Moved from**: Separate "Room Findings" section (now integrated here)

5. **💰 CHAPTER 3: FINANCIAL INTELLIGENCE** - 🆕 **NEW STRUCTURE**
   - **Replaces**: Parts of "Contextual Analysis" (financial categories)
   - **Aggregates**: Search results from Mega-Categories 6, 8
   - **Sub-sections**:
     1. **Financials, Hidden OpEx & Incentives** (Mega 6)
        - Hidden OpEx (Community fees, IBI, utilities)
        - Incentives (NextGen Grants, Tax deductions)
        - Replaces: `legal_economico` (economic aspects)
     2. **Market Context & Comps** (Mega 8)
        - Price trends, liquidity, negotiation leverage, comparable sales
        - Replaces: `market_practices`

6. **Citations & References** - ✅ **UNCHANGED**
   - Diagnostic citations
   - Contextual citations
   - All sources

---

## 🔄 Key Changes Summary

### What's Removed:
- ❌ **"House Diagnostics"** as separate section (7 categories → absorbed into Chapter 1)
- ❌ **"Contextual Analysis"** as separate section (12 categories → split across Chapters 1, 2, 3)
- ❌ **"Room Findings"** as separate section (→ integrated into Chapter 2)

### What's Added:
- ✅ **Chapter 1: Forensic Risk Audit** (4 sub-sections from Mega 1-4)
- ✅ **Chapter 2: Execution & Reality Check** (3 sub-sections: Mega 5, 7 + Room Analysis)
- ✅ **Chapter 3: Financial Intelligence** (2 sub-sections from Mega 6, 8)

### What's Unchanged:
- ✅ **Property Info** (Cover & Snapshot)
- ✅ **House as a Whole** (Narrative Synthesis)
- ✅ **Citations & References**

### Mapping: Old → New

| Old Section | Old Categories | New Chapter | New Sub-Section |
|------------|----------------|-------------|-----------------|
| House Diagnostics | `estado_materiales` | Chapter 1 | Structural Pathology |
| House Diagnostics | `seguridad_accesibilidad` | Chapter 1 | Structural Pathology |
| House Diagnostics | `entorno_vistas` | Chapter 1 | Environmental Hostility |
| Contextual | `noise_environment` | Chapter 1 | Environmental Hostility |
| Contextual | `permits` | Chapter 1 | Urban Legality |
| House Diagnostics | `legal_economico` | Chapter 1 | Urban Legality |
| Contextual | `contractors` | Chapter 2 | Renovation Reality |
| Contextual | `seasonality` | Chapter 2 | Renovation Reality |
| Contextual | `cost_context` | Chapter 2 | Renovation Reality |
| Contextual | `scheduling_windows` | Chapter 2 | Renovation Reality |
| Contextual | `utilities_infrastructure` | Chapter 2 | Infrastructure |
| Contextual | `logistics_access` | Chapter 2 | Infrastructure |
| Room Findings | All rooms | Chapter 2 | Room-by-Room Analysis |
| Contextual | `legal_economico` (economic) | Chapter 3 | Hidden OpEx & Incentives |
| Contextual | `market_practices` | Chapter 3 | Market Context |
| House Diagnostics | `espacios_distribucion` | **TBD** | May merge into Chapter 1 or 2 |
| House Diagnostics | `servicios_instalaciones` | **TBD** | May merge into Chapter 2 |
| House Diagnostics | `caracter_arquitectonico` | **TBD** | May merge into Chapter 1 |
| Contextual | `community_rules` | **TBD** | May merge into Chapter 1 or 2 |
| Contextual | `norms_standards` | **TBD** | May merge into Chapter 2 |
| Contextual | `waste_management` | **TBD** | May merge into Chapter 2 |

---

## 📊 Data Structure Comparison

### Current TypeScript Interface (Before)

```typescript
interface BuyerReport {
  property_info: { ... };
  house_as_a_whole: { ... };
  house_diagnostics: {
    findings_by_category: {
      estado_materiales: string;
      espacios_distribucion: string;
      entorno_vistas: string;
      servicios_instalaciones: string;
      legal_economico: string;
      seguridad_accesibilidad: string;
      caracter_arquitectonico: string;
    };
    visible_strengths: string[];
    key_takeaways: string[];
  };
  contextual_analysis: {
    summary: string;
    categories: Array<{
      category: string;  // 12 categories
      stance: string;
      evidence: Array<{ url: string; snippet: string }>;
      confidence: string;
    }>;
  };
  room_findings: Array<{ ... }>;
  citations_references: { ... };
}
```

### New TypeScript Interface (After)

```typescript
interface BuyerReport {
  property_info: { ... };  // ✅ Unchanged
  house_as_a_whole: { ... };  // ✅ Unchanged
  forensic_risk_audit: {  // 🆕 NEW
    structural_pathology: {  // Mega 1
      summary: string;
      key_findings: string[];
      evidence: Array<{ url: string; snippet: string }>;
    };
    environmental_hostility: { ... };  // Mega 2
    social_security: { ... };  // Mega 3
    urban_legality: { ... };  // Mega 4
  };
  execution_reality_check: {  // 🆕 NEW
    renovation_reality: { ... };  // Mega 5
    infrastructure: { ... };  // Mega 7
    room_by_room: Array<{  // Integrated from old room_findings
      room_id: string;
      room_name: string;
      findings: string[];
      renovation_costs: string[];  // 🆕 NEW: Cost-specific findings
      uncertainties: string[];
    }>;
  };
  financial_intelligence: {  // 🆕 NEW
    hidden_opex_incentives: { ... };  // Mega 6
    market_context: { ... };  // Mega 8
  };
  citations_references: { ... };  // ✅ Unchanged
}
```

---

## 🎯 Business Logic Changes

### Old Flow:
1. **House Diagnostics** → Generated from text + photo analysis (7 categories)
2. **Contextual Analysis** → Generated from search results (12 categories)
3. **Room Findings** → Generated from photo analysis (per-room)
4. **Buyer Report** → Aggregates all three above

### New Flow:
1. **Double-Barrel Search** → Generates queries for 8 Mega-Categories
2. **Search Results** → Curated into 8 Mega-Categories
3. **Buyer Report** → Directly synthesizes:
   - All search results (8 Mega-Categories)
   - Text + photo analysis (integrated)
   - Room analysis (integrated into Chapter 2)
   - **No intermediate "House Diagnostics" or "Contextual Analysis" steps**

---

## 📝 Notes

- **Visible Strengths** and **Key Takeaways** from old "House Diagnostics" → **TBD** (may move to Chapter 1 or become cross-chapter)
- **Uncertainties** remain embedded in prose (not separate section)
- **Citations** structure unchanged (inline + references)
- **Deep linking** will need new anchors:
  - Old: `#toc-diagnostics`, `#toc-contextual`
  - New: `#forensic-risk-audit`, `#execution-reality-check`, `#financial-intelligence`

