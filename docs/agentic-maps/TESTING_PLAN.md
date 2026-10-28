---
status: implementing
last_updated: 2025-12-12
level: 3-implementation
---

# Vibe Maps Testing Implementation Plan

## Overview

This document outlines the structured testing approach for implementing and validating all 33 building block tests for Vibe Maps.

## Testing Infrastructure

### Log System ✅

```
logs/tests/
├── index.json              # Master list of all test runs
├── 001-test-1-1.json       # Run #001
├── 002-test-2-1.json       # Run #002
└── ...
```

### UI Flow

1. **Select Test** - Click test in sidebar → input auto-fills, test badge shows
2. **Run Test** - Press Enter → test executes with detailed logging
3. **View Result** - Panel shows Run ID (e.g., #001), duration, status
4. **Copy Logs** - Click "Full JSON" or "Formatted" to copy logs for debugging
5. **Mark Verdict** - Click Pass ✅ or Fail ❌
6. **Debug** - Share Run ID with AI to analyze logs and fix issues

### Log Contents

Every test run captures:
- **Input**: Raw input string, parsed JSON (if applicable)
- **Steps**: Timestamped execution steps with data
- **API Calls**: Full request/response for each API call including prompts
- **Output**: Success/failure status, result data, error messages
- **Verdict**: Human-assigned pass/fail status

---

## Implementation Phases

### Phase 0: Quick Wins (Same Stack as 1.1)

These tests use the **same Gemini API and map rendering** as the working Test 1.1, just with different prompts.

| Test | Description | Status |
|------|-------------|--------|
| 1.1 | Generate vibe areas (Things to Do) | ✅ Working |
| 2.1 | Generate stay areas with booking links | ⬜ Not Started |
| 3.1 | Generate dual-layer areas (Stay + Do) | ⬜ Not Started |
| 7.1 | City character analysis (areas overview) | ⬜ Not Started |

**What needs to change:**
- Different Gemini prompt for each test type
- Different data structure in response parsing
- UI may show different info cards

### Phase 1: FREE Tests (Turf.js + URL Generation)

**API Cost: $0.00** - These use local computation only.

| Test | Description | Status |
|------|-------------|--------|
| S.4 | Generate Google Maps / TikTok URLs | ⬜ |
| S.5 | Generate Booking.com URLs | ⬜ |
| 3.2 | Display travel lines between areas | ⬜ |
| 5.3 | Compute polygon intersection (Turf.js) | ⬜ |
| 6.2 | Interactive matrix hover display | ⬜ |
| 6.4 | Generate Google Maps directions URL | ⬜ |

**Dependencies:**
- Install Turf.js: `npm install @turf/turf`
- Implement polygon rendering on map
- Implement travel line rendering

### Phase 2: Gemini Flash Tests

**API Cost: ~$0.002-0.005 per test** - Uses cheaper Gemini Flash model.

| Test | Description | Status |
|------|-------------|--------|
| 1.2 | Generate itinerary for an area | ⬜ |
| 1.3 | Generate itinerary with coordinates | ⬜ |
| 2.2 | Nearby highlights for stay areas | ⬜ |
| 4.4 | Curate winner ("The Local Favorite") | ⬜ |
| 5.4 | Identify neighborhoods in polygon | ⬜ |
| 6.3 | AI picks best intersections | ⬜ |
| 7.2 | Chat to understand preferences | ⬜ |
| 7.3 | Chat about multi-stop route details | ⬜ |
| 7.5 | Compute route options | ⬜ |
| 7.6 | AI picks best route options | ⬜ |

### Phase 3: Mapbox API Tests

**API Cost: ~$0.0005-0.005 per test**

| Test | Description | Status |
|------|-------------|--------|
| 5.1 | Geocode location | ⬜ |
| 5.2 | Generate isochrone | ⬜ |
| 5.5 | Handle multi-polygon isochrones | ⬜ |
| 7.4 | Matrix of travel times | ⬜ |
| 7.7 | Two-stop directions | ⬜ |
| 7.8 | Multi-stop directions | ⬜ |

**Dependencies:**
- Mapbox API key setup
- Mapbox Directions API integration
- Mapbox Isochrone API integration

### Phase 4: External API Tests

**API Cost: ~$0.001-0.01 per test**

| Test | Description | Status |
|------|-------------|--------|
| 4.1 | Google Search for place | ⬜ |
| 4.2 | Get place details | ⬜ |
| 4.3 | Get place reviews | ⬜ |
| 6.1 | Multi-modal isochrones (Geoapify) | ⬜ |

**Dependencies:**
- ScrapingDog API key setup
- Geoapify API key setup

### Phase 5: Shared Renderers

These are UI components used by multiple tests.

| Test | Description | Status |
|------|-------------|--------|
| S.1 | Render circles on map | ✅ Working |
| S.2 | Render info card | ✅ Working |
| S.3 | Render single place pin | ⬜ |

---

## Testing Protocol

### For Each Test:

1. **Agent Implements** - Writes the test-specific code
2. **User Runs** - Selects test, enters input, executes
3. **Review Results**:
   - Does the map show expected visualization?
   - Is the data correct/reasonable?
   - Are coordinates accurate?
4. **Copy Logs** if failed - Share Run ID with agent
5. **Agent Debugs** - Reads full logs, identifies issue, fixes
6. **Repeat** until passing
7. **Mark Pass** - Update test doc status

### Debugging Flow

```
User: "Run #003 failed"

Agent reads: logs/tests/003-test-X-X.json
- Checks API calls for errors
- Checks response parsing
- Checks step execution
- Identifies root cause
- Implements fix

User: Re-runs test
```

---

## Progress Tracking

Update this table as tests are implemented:

| Phase | Tests | Completed | Status |
|-------|-------|-----------|--------|
| 0 | 4 | 1 | 🟡 In Progress |
| 1 | 6 | 0 | ⬜ Not Started |
| 2 | 10 | 0 | ⬜ Not Started |
| 3 | 6 | 0 | ⬜ Not Started |
| 4 | 4 | 0 | ⬜ Not Started |
| 5 | 3 | 2 | 🟡 In Progress |

**Total: 33 tests | 3 completed | 30 remaining**

---

## API Key Status

| Service | Status | Key Location |
|---------|--------|--------------|
| Gemini API | ✅ Configured | Hardcoded (TODO: move to env) |
| Mapbox | ✅ Configured | In code |
| ScrapingDog | ⬜ Needed | - |
| Geoapify | ⬜ Needed | - |

---

## Files Reference

- **Logger**: `src/lib/vibe-maps/testLogger.ts`
- **Result Panel**: `src/components/vibe-maps/TestResultPanel.tsx`
- **Test Picker**: `src/components/vibe-maps/TestPickerPanel.tsx`
- **Test Data**: `src/components/vibe-maps/testInputData.ts`
- **Main Page**: `src/app/vibe-maps/page.tsx`
- **Log API**: `src/app/api/test-logs/`
- **Log Files**: `logs/tests/`

---

## Next Steps

1. ✅ Test infrastructure complete
2. ⬜ Implement Test 2.1 (Stay areas)
3. ⬜ Implement Test 3.1 (Stay + Do)
4. ⬜ Implement Test 7.1 (City character)
5. ⬜ Move to Phase 1 (FREE tests)

