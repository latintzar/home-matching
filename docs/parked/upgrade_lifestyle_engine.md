# Plan: Upgrade Lifestyle Intelligence to "The Matchmaker"

## 🎯 Objective
Transform the existing "Lifestyle Intelligence" (which focuses on location/amenity mapping) into a full-stack **Listing Recommendation Engine** ("The Matchmaker").

**Core Shift**: Instead of just finding the *right area* ("Sweet Spot"), we now find the *right specific listing* by combining:
1.  **Location Fit** (Existing "Sweet Spot" logic).
2.  **Property Fit** (New hard/soft constraints from our enriched data).
3.  **Lifestyle DNA** (Psychologist output).

## 🏗️ Architecture Overview

### 1. "The Psychologist" (Upgrade) 🧠
*   **Goal**: Extract structured *Property Preferences* alongside *Lifestyle DNA* from conversational input.
*   **New Responsibilities**:
    *   Parse hard constraints: "Must have elevator", "Min 2 beds", "Max €400k".
    *   Parse soft constraints: "High ceilings", "Natural light", "Quiet street" (mapped to `orientation`, `floor_level`, `noise_level`).
    *   Parse trade-offs: "Willing to renovate if location is perfect" (maps to `condition`).
*   **Output**: `user_lifestyle_profile` (Enhanced JSON).

### 2. "The Recommender" (Engine Upgrade) ⚙️
*   **Goal**: Efficiently filter & rank listings based on the merged Location + Property profile.
*   **Logic Flow**:
    1.  **Spatial Filter**: Only consider listings inside the calculated "Sweet Spot" (GeoJSON).
    2.  **Hard Filter (SQL)**: Apply strict property constraints (Price, Beds, Elevator, Terrace).
    3.  **Soft Ranking (Scoring)**: Score remaining candidates based on soft matches (e.g., `floor_level` preference, `orientation` preference).
*   **New Capabilities**:
    *   "Smart Relaxing": If 0 results, automatically relax the least critical constraint (defined by Psychologist).

### 3. Data Schema Updates 🗄️
*   **`user_lifestyle_profiles` Table**:
    *   Add `property_constraints` (JSONB): Stores structured needs (beds, budget, elevator, etc.).
    *   Add `trade_off_matrix` (JSONB): Stores what the user is willing to compromise on.

## 📋 Execution Steps

### Phase 1: The Psychologist (Prompt Engineering)
- [ ] **Update Prompt**: Modify `generateSmartLifestyleProfile` to extract property specifics.
- [ ] **Structure Definition**: Define strict JSON schema for `property_preferences` (aligned with `listings` columns).
    *   `min_beds`, `max_price`, `must_have_elevator`, `min_floor_level`, `preferred_orientation`.

### Phase 2: The Recommender (Query Logic)
- [ ] **Update Endpoint**: `/api/lifestyle/recommendations`.
- [ ] **Enhanced Query**:
    *   Combine PostGIS `ST_Within` (Location) with SQL `WHERE` clauses (Property).
    *   Example: `WHERE price <= X AND bedrooms >= Y AND has_elevator = true`.
- [ ] **Scoring Algo**: Implement a simple weighted score for soft matches (e.g., +10 for "Exterior", +5 for "South Facing").

### Phase 3: UI Integration (Results Page)
- [ ] **"Why this Listing?"**: Show a match breakdown card.
    *   "✅ Location: 95% match (Near Gym + Coffee)"
    *   "✅ Property: 100% match (Elevator + Terrace)"
    *   "⚠️ Trade-off: Slightly above budget (+€10k)"

## 🔗 Dependencies
*   **Enriched Listing Data**: We rely heavily on the new `floor_level`, `orientation`, `has_elevator`, etc. fields being populated (Done).
*   **Geolocation**: We rely on the existing `Sweet Spot` generator (Done).

---
**Next Step**: Create the migration for `user_lifestyle_profiles` and update the Psychologist prompt.

