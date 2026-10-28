# What Leo Learns About You

**Purpose**: This document defines the target information Leo aims to extract from users during conversation. Questions are adaptive — this is the **schema of understanding**, not a script.

**Last Updated**: 2025-11-28  
**Status**: Draft for iteration

---

## 1. Where Your Life Happens (Anchors)

The fixed points that define where you need to be.

| Field | Description | Example Values |
|-------|-------------|----------------|
| `primary_anchor` | Main work/study location | Address or area |
| `secondary_anchors[]` | Regular destinations | Gym, partner's place, family, kids' school |
| `anchor_frequency` | How often you go to each | Daily, 3x/week, weekly |
| `transport_preference` | How you prefer to get there | Walk, bike, metro, drive |
| `max_commute_minutes` | Maximum acceptable travel time | 20, 30, 45 mins |

---

## 2. How You Use Your Home

Understanding what happens inside the walls.

| Field | Description | Example Values |
|-------|-------------|----------------|
| `household_composition` | Who lives with you | Solo, couple, family, roommates |
| `pets` | Animals in the home | Dog (size), cat, none |
| `work_from_home` | Remote work frequency | Never, 1-2 days, mostly, always |
| `hosting_frequency` | How often you have people over | Rarely, monthly, weekly |
| `outdoor_space_need` | Balcony/terrace importance | Essential, nice-to-have, park is fine |
| `storage_needs` | Bikes, gear, seasonal items | High, moderate, minimal |

---

## 3. Your Sensory Tolerances

What you can and can't live with.

| Field | Description | Example Values |
|-------|-------------|----------------|
| `noise_sensitivity` | How much noise bothers you | Very sensitive, somewhat, unbothered |
| `noise_sources_avoid` | Specific noise types to avoid | Traffic, nightlife, neighbors, schools |
| `light_priority` | How important is natural light | Essential, important, flexible |
| `temperature_sensitivity` | Heat/cold tolerance | Need AC, tolerate heat, need heating |
| `stairs_tolerance` | Floors without lift acceptable | 0, 1-2, 3-4, any |

---

## 4. Your Taste in Buildings

Aesthetic and character preferences.

| Field | Description | Example Values |
|-------|-------------|----------------|
| `building_era_preference` | Modern vs. older buildings | Modern only, character/older, no preference |
| `character_features_appeal` | Original features (tiles, ceilings, moldings) | Exciting, neutral, feels like maintenance |
| `aesthetic_style` | Interior style preference | Minimalist, warm, industrial, classic |
| `building_community_vibe` | Neighbor interaction preference | Anonymous, nodding terms, neighborly |

---

## 5. Your Neighborhood Feel

The streets and area around home.

| Field | Description | Example Values |
|-------|-------------|----------------|
| `street_energy` | Desired neighborhood vibe | Quiet residential, mixed lively, urban buzz |
| `nightlife_proximity` | Bars/restaurants nearby | Asset, neutral, liability |
| `tourist_tolerance` | Tourist presence in area | Fine, prefer less, avoid |
| `green_space_importance` | Parks and nature access | Essential, nice-to-have, not important |
| `local_commerce_preference` | Shopping style | Local markets/shops, supermarket fine, don't care |

---

## 6. Your Appetite for Work

Willingness to take on a project.

| Field | Description | Example Values |
|-------|-------------|----------------|
| `renovation_appetite` | How much work you'd consider | Move-in ready only, cosmetic OK, open to project |
| `cosmetic_tolerance` | Paint, furnishing, minor fixes | Yes, limited, no |
| `structural_openness` | Layout changes, major work | Excited by it, would consider, no way |
| `project_excitement` | Does "potential" appeal to you? | Yes — love a project, Maybe if price is right, No — want turnkey |

---

## 7. Your Risk Comfort

Tolerance for unknowns and older buildings.

| Field | Description | Example Values |
|-------|-------------|----------------|
| `building_age_comfort` | Comfort with older construction | Prefer modern, fine if maintained, love character |
| `maintenance_history_importance` | Need clear building records? | Essential, preferred, flexible |
| `investigation_willingness` | Comfortable digging into unknowns? | Yes, somewhat, need certainty |
| `deal_complexity_tolerance` | Okay with complicated purchases? | Simple only, some complexity OK, bring it on |

---

## 8. Your Budget Reality

The money conversation.

| Field | Description | Example Values |
|-------|-------------|----------------|
| `budget_hard_max` | Absolute ceiling | €X |
| `budget_comfortable` | Sweet spot range | €X - €Y |
| `budget_stretch_triggers` | What's worth paying more for? | Location, space, light, outdoor, view |
| `upfront_flexibility` | Deposit and fees capacity | Standard only, some flexibility, flexible |

---

## 9. Your Timeline & Flexibility

When and how fast.

| Field | Description | Example Values |
|-------|-------------|----------------|
| `move_deadline` | When you need to be in | Specific date, within X months, flexible |
| `deadline_flexibility` | How firm is that date? | Hard deadline, some flex, very flexible |
| `decision_speed` | Can you act fast? | Yes — ready to move, Need a few days, Need time to think |
| `current_situation` | Lease/living situation | Month-to-month, lease ending [date], own current place |

---

## 10. Your Deal-Breakers & Must-Haves

The hierarchy of what matters.

| Field | Description | Example Values |
|-------|-------------|----------------|
| `non_negotiables[]` | Will walk away without these | List of absolute requirements |
| `strong_preferences[]` | Would only compromise for exceptional fit | List of strong wants |
| `nice_to_haves[]` | Would be delighted but won't filter | List of bonuses |

---

## 11. What You've Learned From Past Homes

Wisdom from experience.

| Field | Description | Example Values |
|-------|-------------|----------------|
| `past_home_wins[]` | What worked in previous places | "Loved the morning light", "Great neighbors" |
| `past_home_frustrations[]` | What drove you crazy | "Street noise", "No storage", "Dark kitchen" |
| `expectation_corrections[]` | What you thought mattered but didn't | "Thought I needed 2 bathrooms, actually fine with 1" |
| `surprise_needs[]` | What you didn't know you needed | "Realized I need a dedicated work space" |

---

## How This Drives Matching

| Category | Matching Behavior |
|----------|-------------------|
| **Anchors** | Generates geographic "sweet spot" polygon |
| **Home Use** | Filters by size, layout, features |
| **Sensory Tolerances** | Filters by floor, orientation, street type |
| **Building Taste** | Weights building age and style |
| **Neighborhood Feel** | Filters by area character |
| **Renovation Appetite** | Determines condition filter |
| **Risk Comfort** | Decides whether to show "needs investigation" properties |
| **Budget** | Hard price filter + stretch scoring |
| **Timeline** | Urgency weighting, availability filter |
| **Deal-Breakers** | Hard filters (instant reject) |
| **Past Learnings** | Soft scoring refinement over time |

---

## Implementation Notes

### Current Coverage in `AIProfile`

| Category | Status |
|----------|--------|
| Anchors | ✅ Implemented |
| Home Use | ⚠️ Partial (bedrooms, bathrooms only) |
| Sensory Tolerances | ❌ Missing |
| Building Taste | ❌ Missing |
| Neighborhood Feel | ⚠️ Partial (vibe array) |
| Renovation Appetite | ⚠️ Partial (condition_preference) |
| Risk Comfort | ❌ Missing |
| Budget | ✅ Implemented |
| Timeline | ❌ Missing |
| Deal-Breakers | ⚠️ Partial (hard_constraints) |
| Past Learnings | ❌ Missing |

### Next Steps

1. Extend `AIProfile` interface with missing fields
2. Update AI Profiler prompt to extract new categories
3. Update matching logic to use new fields
4. Add feedback loop to capture "Past Learnings" over time

---

## Changelog

| Date | Change |
|------|--------|
| 2025-11-28 | Initial draft created |

