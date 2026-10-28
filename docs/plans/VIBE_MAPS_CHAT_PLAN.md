# ⚠️ SUPERSEDED

> **This document has been consolidated into the unified Agentic Maps documentation.**
>
> **New location**: [`/docs/agentic-maps/AGENTIC_MAPS.md`](../agentic-maps/AGENTIC_MAPS.md)
>
> Content from this document has been migrated to:
> - [`architecture/CHAT-UI.md`](../agentic-maps/architecture/CHAT-UI.md)
> - [`architecture/CHAT-HISTORY.md`](../agentic-maps/architecture/CHAT-HISTORY.md)
> - [`scenarios/01-THINGS-TO-DO.md`](../agentic-maps/scenarios/01-THINGS-TO-DO.md)
> - [`scenarios/02-WHERE-TO-STAY.md`](../agentic-maps/scenarios/02-WHERE-TO-STAY.md)
> - [`scenarios/03-STAY-AND-DO.md`](../agentic-maps/scenarios/03-STAY-AND-DO.md)

---

# Vibe Maps - Lovable-Style Chat Interface Plan

> **Status**: Superseded → See `docs/agentic-maps/`  
> **Created**: December 2024  
> **Superseded By**: `docs/agentic-maps/architecture/CHAT-UI.md`  
> **Location**: `/src/app/vibe-maps/page.tsx`

---

## ⚠️ Note

This document has been superseded by the comprehensive Agentic Maps documentation at `docs/agentic-maps/`. The UI layout and chat flow described below are still valid and have been incorporated into the new architecture.

---

---

## UI Layout

```
┌───────────────────┬─────────────────────────────────────────────┐
│  💬 Leo           │  [○] ← toggle chat (top-left)               │
│                   │                                             │
│  "Barcelona! 🇪🇸   │                                             │
│                   │                 M A P                       │
│  Looking for      │                                             │
│  activities or    │            ○ Gothic    ○ Born               │
│  also a place     │                 ○ Gràcia                    │
│  to stay?"        │            ○ Barceloneta                    │
│                   │                                             │
│  ┌─────────────┐  │                                             │
│  │🎉 Activities│  │   ┌──────────────────────────────────┐      │
│  └─────────────┘  │   │  🎉 THINGS TO DO            [▼]  │      │
│  ┌─────────────┐  │   │  • Barceloneta                   │      │
│  │🏨 Stay + Do │  │   │  • Gràcia ●                      │      │
│  └─────────────┘  │   │  • Born                          │      │
│                   │   ├──────────────────────────────────┤      │
│                   │   │  📍 Gràcia                       │      │
│  ─────────────────│   │  🔍 Web verified                 │      │
│                   │   │                                  │      │
│  [Type here...]   │   │  Bohemian vibes, indie cafes...  │      │
│                   │   │                                  │      │
│                   │   │       [←]  2 / 5  [→]            │      │
│                   │   └──────────────────────────────────┘      │
└───────────────────┴─────────────────────────────────────────────┘
     CHAT SIDEBAR                      MAP + INFO CARD
      (LEFT)                              (RIGHT)
```

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER SUBMITS PROMPT                          │
│              "romantic weekend barcelona"                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              1. CLASSIFICATION CALL (Gemini 2.5 Flash)          │
│                                                                 │
│  Input: User prompt                                             │
│  Output: {                                                      │
│    city_known: true,                                            │
│    city_name: "Barcelona",                                      │
│    center_lat: 41.3874,                                         │
│    center_lng: 2.1686,                                          │
│    intent_known: false,        // unclear if stay or activities │
│    clarification_needed: true,                                  │
│    clarification_question: "Are you looking for places to       │
│                             stay, or just things to do?"        │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              2. OPEN MAP VIEW                                   │
│                                                                 │
│  • city_known=true  → Zoom to Barcelona (lat/lng from response) │
│  • city_known=false → Show globe view                           │
│                                                                 │
│  • clarification_needed=true → Open chat sidebar with question  │
│  • clarification_needed=false → Proceed to generation           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              3. USER ANSWERS IN CHAT                            │
│                                                                 │
│  Clicks: [🏨 Stay + Activities]                                 │
│  Or types: "both, we need a hotel too"                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              4. GENERATION CALL (Gemini 2.5 Pro + Grounding)    │
│                                                                 │
│  Mode: "stay+activities"                                        │
│  Output: {                                                      │
│    stay_areas: [                                                │
│      { name: "Gothic Quarter", lat: ..., why: ..., ... },       │
│      { name: "El Born", lat: ..., why: ..., ... }               │
│    ],                                                           │
│    activity_areas: [                                            │
│      { name: "Barceloneta", lat: ..., why: ..., ... },          │
│      { name: "Gràcia", lat: ..., why: ..., ... },               │
│      { name: "Eixample", lat: ..., why: ..., ... }              │
│    ]                                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              5. DISPLAY VIBE CIRCLES                            │
│                                                                 │
│  • Render circles on map                                        │
│  • Show info card with category selector                        │
│  • Close chat sidebar (user can reopen with toggle)             │
│  • Zoom to fit all circles                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Two Modes

| Mode | Areas Generated | Use Case |
|------|-----------------|----------|
| `activities` | 5 "Things to Do" areas | "bars tonight", "date ideas", "what to do this weekend" |
| `stay+activities` | 2 "Where to Stay" + 3 "Things to Do" | "weekend trip", "visiting for 3 days", "planning a trip" |

---

## API Calls

### 1. Classification Call (Gemini 2.5 Flash)

**Purpose**: Fast, cheap analysis of user intent

```javascript
const CLASSIFICATION_PROMPT = `Analyze this travel query and extract structured information.

QUERY: "${userQuery}"

Return ONLY valid JSON:
{
  "city_known": boolean,           // Is a specific city/region mentioned?
  "city_name": string | null,      // City name if known
  "center_lat": number | null,     // City center latitude
  "center_lng": number | null,     // City center longitude
  "intent_known": boolean,         // Is intent clear (activities vs stay)?
  "intent": "activities" | "stay+activities" | null,
  "clarification_needed": boolean,
  "clarification_question": string | null  // Question to ask user
}

INTENT DETECTION:
- "activities" → nightlife, food, things to do, date night, weekend plans
- "stay+activities" → trip planning, visiting, staying, weekend away, vacation
- null → ambiguous, need to ask

EXAMPLES:
- "bars in berlin tonight" → activities, no clarification
- "romantic weekend paris" → stay+activities likely, but ask to confirm
- "tokyo" → city known, intent unknown, ask what they're looking for
- "best coffee" → city unknown, intent=activities, ask where`;

// Call Gemini 2.5 Flash
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: CLASSIFICATION_PROMPT }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1000 }
    })
  }
);
```

### 2. Generation Call (Gemini 2.5 Pro + Grounding)

**Purpose**: Generate high-quality vibe areas with web verification

```javascript
// Same as current implementation, but with mode-aware prompt
const GENERATION_PROMPT = `You are a world travel expert.

TRIP: "${userQuery}"
MODE: "${mode}"  // "activities" or "stay+activities"

${mode === 'stay+activities' ? `
Generate:
- 2 "WHERE TO STAY" neighborhoods (best areas for accommodation)
- 3 "THINGS TO DO" neighborhoods (best areas for activities)

Return JSON:
{
  "city": "City Name",
  "stay_areas": [...],      // 2 areas
  "activity_areas": [...]   // 3 areas
}
` : `
Generate 5 "THINGS TO DO" neighborhoods.

Return JSON:
{
  "city": "City Name",
  "areas": [...]  // 5 areas
}
`}

Each area needs: name, lat, lng, radius, color, why (max 140 chars), itinerary (3 items)
Use Google Search to verify real places and accurate coordinates!`;
```

---

## State Management

```typescript
interface VibeMapsState {
  // View state
  showMap: boolean;
  chatOpen: boolean;
  
  // Map state
  viewState: { longitude: number; latitude: number; zoom: number };
  
  // Chat state
  messages: ChatMessage[];
  awaitingResponse: boolean;
  
  // Classification result
  classification: {
    city_known: boolean;
    city_name: string | null;
    center_lat: number | null;
    center_lng: number | null;
    intent_known: boolean;
    intent: 'activities' | 'stay+activities' | null;
  } | null;
  
  // Areas state
  mode: 'activities' | 'stay+activities' | null;
  stayAreas: VibeArea[];      // 0 or 2 areas
  activityAreas: VibeArea[];  // 3 or 5 areas
  
  // UI state
  currentCategory: 'stay' | 'activities';
  currentAreaIndex: number;
  categoryExpanded: boolean;
  
  // Loading
  classifying: boolean;
  generating: boolean;
}

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
  options?: { label: string; value: string; emoji: string }[];
}
```

---

## Component Structure

```
VibeMapsPage
├── LandingView (initial search)
│   └── SearchInput
│
└── MapView (after first search)
    ├── ChatSidebar (LEFT)
    │   ├── ChatHeader (Leo branding)
    │   ├── MessageList
    │   │   ├── AssistantMessage
    │   │   │   └── OptionButtons (if clarification)
    │   │   └── UserMessage
    │   └── ChatInput
    │
    ├── MapContainer (RIGHT)
    │   ├── ToggleChatButton (top-left circle)
    │   ├── MapboxMap
    │   │   └── VibeCircles
    │   └── NavigationControl
    │
    └── InfoCard (bottom-left of map)
        ├── CategorySelector (collapsible)
        │   ├── StayCategory (if mode=stay+activities)
        │   └── ActivitiesCategory
        ├── AreaDetails
        │   ├── AreaHeader (name, color, verified badge)
        │   ├── WhyText
        │   └── Itinerary
        └── NavigationButtons (prev/next)
```

---

## Implementation Steps

### Phase 1: Basic Chat Sidebar
- [ ] Add chat sidebar component (left side)
- [ ] Add toggle button (circle in top-left of map)
- [ ] Basic open/close animation
- [ ] Chat message list UI

### Phase 2: Classification Flow
- [ ] Add Gemini 2.5 Flash classification call
- [ ] Parse classification response
- [ ] Show clarification question in chat
- [ ] Handle option button clicks
- [ ] Handle free-text responses

### Phase 3: Mode-Aware Generation
- [ ] Update generation prompt for two modes
- [ ] Parse stay_areas + activity_areas
- [ ] Store in separate state arrays

### Phase 4: Category UI
- [ ] Add collapsible category selector to info card
- [ ] "🏨 WHERE TO STAY" section (if mode=stay+activities)
- [ ] "🎉 THINGS TO DO" section
- [ ] Area list within each category
- [ ] Click to select area

### Phase 5: Navigation Updates
- [ ] Prev/Next cycles through ALL areas (both categories)
- [ ] Category header updates based on current area
- [ ] Circle highlighting matches selected area

### Phase 6: Fix Circle Clicks
- [ ] Handle map onClick event
- [ ] Use queryRenderedFeatures to detect circle clicks
- [ ] Update selected area on circle click

### Phase 7: Polish
- [ ] Smooth animations for sidebar
- [ ] Loading states in chat
- [ ] Error handling
- [ ] Mobile responsiveness

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/app/vibe-maps/page.tsx` | Main implementation |
| `src/components/vibe-maps/ChatSidebar.tsx` | New component |
| `src/components/vibe-maps/CategorySelector.tsx` | New component |

---

## Testing Scenarios

1. **Clear intent**: "bars in berlin tonight" → No clarification, activities mode
2. **Clear trip**: "planning 3 days in tokyo" → No clarification, stay+activities mode
3. **City known, intent unclear**: "barcelona" → Ask about intent
4. **City unknown, intent clear**: "best coffee shops" → Ask about location
5. **Both unclear**: "travel ideas" → Ask about location first, then intent

---

*Delete this file after implementation is complete.*
