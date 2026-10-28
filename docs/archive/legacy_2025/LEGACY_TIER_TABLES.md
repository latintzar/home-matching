# Legacy Tier Generation Tables - Deprecation Status

**Date:** 2025-01-27  
**Phase 2:** Pipeline Simplification - Tier Element Synthesis Consolidation

---

## 📋 Deprecated Tables (Marked, Not Dropped)

These tables are **deprecated** but **kept for backward compatibility**. They are replaced by `tier_element_synthesis`.

### 1. `group_tier_directives` ❌ DEPRECATED
- **Original Purpose:** T3 (Apply to Groups) output - per-family, per-tier directives
- **Replaced By:** `tier_element_synthesis.synthesis_data.works` (includes family_id)
- **Status:** 
  - ✅ Marked as deprecated in database comments
  - ✅ Endpoint `/api/listings/[id]/tiers/apply-to-groups` still exists but not in orchestrator
  - ⚠️ Can be safely removed after migration period

### 2. `e2_tier_target_states` ❌ DEPRECATED
- **Original Purpose:** T4/T5.5/T6.5 output - element-level decisions per room per tier
- **Replaced By:** `tier_element_synthesis.synthesis_data.works` (includes element_id, room_id, action)
- **Status:**
  - ✅ Marked as deprecated in database comments
  - ✅ Endpoints still exist but not in orchestrator:
    - `/api/listings/[id]/tiers/decide-elements` (T4)
    - `/api/listings/[id]/tiers/apply-cohesion-corrections` (T5.5)
    - `/api/listings/[id]/tiers/iterate-element-decisions` (T6.5)
  - ⚠️ Can be safely removed after migration period

### 3. `cohesion_notes` ❌ DEPRECATED
- **Original Purpose:** T5 (Cohesion) output - holistic consistency notes
- **Replaced By:** `tier_element_synthesis.synthesis_data.cohesion_summary`
- **Status:**
  - ✅ Marked as deprecated in database comments
  - ✅ T6 (Budget Calibration) updated to use TierElementSynthesis with fallback
  - ✅ Endpoint `/api/listings/[id]/tiers/cohesion` still exists but not in orchestrator
  - ⚠️ Can be safely removed after migration period

---

## ✅ Active Tables (Keep)

These tables are still actively used and should **NOT** be removed.

### 1. `tier_element_synthesis` ✅ ACTIVE
- **Purpose:** Phase 2 consolidated tier generation (replaces T3+T4+T5+T5.5+T6.5)
- **Status:** Primary table for tier generation
- **Used By:** Orchestrator, R2b, Seed Scope (I), R2a

### 2. `room_families` ✅ ACTIVE
- **Purpose:** Groups similar rooms (bathrooms, bedrooms, etc.)
- **Status:** Still used by TierElementSynthesis
- **Used By:** T1, TierElementSynthesis

### 3. `tier_philosophies` ✅ ACTIVE
- **Purpose:** Whole-house tier definitions (Estándar, Óptimo, Plus)
- **Status:** Still used by TierElementSynthesis
- **Used By:** T2, TierElementSynthesis

### 4. `e2_element_mapping` ✅ ACTIVE
- **Purpose:** Maps E2 layout elements to renovation scope
- **Status:** Still used by TierElementSynthesis
- **Used By:** TierElementSynthesis

### 5. `tier_budget_calibration` ✅ ACTIVE
- **Purpose:** T6 (Budget Calibration) output - budget adjustments
- **Status:** Still used by optional T6 step
- **Used By:** T6

---

## 🗑️ Removal Plan (Future)

### Phase 1: Mark as Deprecated ✅ COMPLETE
- [x] Add deprecation comments to tables
- [x] Update T6 to use TierElementSynthesis
- [x] Document deprecation status

### Phase 2: Migration Period (Recommended: 1-2 months)
- [ ] Monitor for any manual usage of deprecated endpoints
- [ ] Ensure all new listings use TierElementSynthesis
- [ ] Verify no external systems depend on deprecated tables

### Phase 3: Safe Removal (After migration period)
- [ ] Create migration to drop deprecated tables:
  ```sql
  DROP TABLE IF EXISTS group_tier_directives CASCADE;
  DROP TABLE IF EXISTS e2_tier_target_states CASCADE;
  DROP TABLE IF EXISTS cohesion_notes CASCADE;
  ```
- [ ] Remove deprecated endpoint files (optional - can keep for reference)
- [ ] Update documentation to remove references

---

## 📊 Table Usage Summary

| Table | Status | Used By Orchestrator? | Can Remove? |
|-------|--------|----------------------|-------------|
| `tier_element_synthesis` | ✅ Active | ✅ Yes | ❌ No |
| `room_families` | ✅ Active | ✅ Yes | ❌ No |
| `tier_philosophies` | ✅ Active | ✅ Yes | ❌ No |
| `e2_element_mapping` | ✅ Active | ✅ Yes | ❌ No |
| `tier_budget_calibration` | ✅ Active | ⚠️ Optional (T6) | ❌ No |
| `group_tier_directives` | ❌ Deprecated | ❌ No | ✅ Yes (after migration) |
| `e2_tier_target_states` | ❌ Deprecated | ❌ No | ✅ Yes (after migration) |
| `cohesion_notes` | ❌ Deprecated | ❌ No | ✅ Yes (after migration) |

---

## 🔄 Migration Path

**Old Pipeline:**
```
T3 → group_tier_directives
T4 → e2_tier_target_states
T5 → cohesion_notes
T5.5 → e2_tier_target_states (updated)
T6.5 → e2_tier_target_states (updated)
```

**New Pipeline:**
```
TierElementSynthesis → tier_element_synthesis
  (includes: works, cohesion_summary, statistics)
```

---

## ⚠️ Important Notes

1. **Tables are NOT dropped yet** - kept for backward compatibility
2. **Endpoints still exist** - can be called manually if needed
3. **T6 has fallback** - uses TierElementSynthesis first, falls back to legacy cohesion_notes
4. **Safe to remove** - after confirming no external dependencies

---

**Last Updated:** 2025-01-27  
**Migration Applied:** ✅ 037_deprecate_legacy_tier_tables.sql

