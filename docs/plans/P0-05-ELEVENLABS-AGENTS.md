# P0-05: ElevenLabs Agents — Tools & State Machine

> **Parent:** [P0 Index](./P0_INDEX.md)

---

## Overview

Leo uses ElevenLabs voice agents for intake calls. The agent has access to tools that:
- Update user profiles in real-time
- Generate commute zone visualizations
- Trigger WPA on properties
- Push properties to the UI for vibe-check

---

## Agent State Machine

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          LEO INTAKE STATE MACHINE                                       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  INTRO                    CORE QUESTIONS              WHAT-IFS                        │
│  ─────                    ──────────────              ────────                        │
│                                                                                        │
│  ┌─────────┐  city found  ┌─────────────┐  got all   ┌────────────────┐               │
│  │ WELCOME │────────────►│ EXPLORE_NEEDS│────────────►│ VIBE_CHECK     │               │
│  └─────────┘              └─────────────┘             └────────────────┘               │
│      │                          │                           │                          │
│      │                          │ anchor found              │ 3 properties             │
│      │                          ▼                           │ calibrated               │
│      │                    ┌─────────────┐                   ▼                          │
│      │                    │ SHOW_ZONES  │             ┌────────────────┐               │
│      │                    └─────────────┘             │ CALIBRATE      │               │
│      │                          │                     └────────────────┘               │
│      │                          │ zones shown               │                          │
│      │                          ▼                           │ calibrated               │
│      │                    ┌─────────────┐                   ▼                          │
│      │                    │ CONFIRM_AREA│             ┌────────────────┐               │
│      │                    └─────────────┘             │ WRAP_UP        │               │
│      │                                                └────────────────┘               │
│      │                                                      │                          │
│      │                                                      ▼                          │
│      │                                                ┌────────────────┐               │
│      └───────────────────────────────────────────────►│ END_CALL       │               │
│                                                       └────────────────┘               │
│                                                                                        │
│  EXCEPTION STATES:                                                                     │
│  ─────────────────                                                                     │
│  • DEEPER_QUESTIONS → If inventory insufficient, probe flexibility                     │
│  • HANDLE_ISOLATED_ANCHOR → If commute zones don't overlap                            │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Tools

### Core Tools

| Tool | Endpoint | Purpose | When Used |
|------|----------|---------|-----------|
| `detect_city` | `/api/agents/detect-city` | Trigger `ZOOM_TO_CITY` on map | City mentioned |
| `add_anchor` | `/api/agents/add-anchor` | Generate commute zones, show on map | Work/school mentioned |
| `update_profile` | `/api/agents/update-profile` | Save extracted preferences | Any preference shared |
| `check_availability` | `/api/agents/check-availability` | Count matching listings | After getting budget + area |
| `show_property` | `/api/agents/vibe-check` | Show property carousel for reaction | During What-Ifs |
| `record_calibration` | `/api/agents/record-calibration` | Store user reaction vs WPA | After vibe-check |

### Location Tools (Updated for Turf.js)

| Tool | Endpoint | Purpose | Cost |
|------|----------|---------|------|
| `generate_commute_zones` | `/api/recommender/generate-commute-zones` | Turf.js radial circles | FREE |
| `calculate_penalties` | `/api/recommender/calculate-penalties` | Graduated commute scoring | FREE |
| `probe_city_familiarity` | `/api/agents/probe-familiarity` | Record user's city knowledge | FREE |
| `surface_tradeoff` | `/api/agents/surface-tradeoff` | Show local wisdom | FREE |
| `score_destination_multimode` | `/api/recommender/score-destination` | Walk/bike/moped/transit | FREE |
| `score_area_vibe` | `/api/recommender/score-area-vibe` | AllThePlaces density | FREE |
| `score_quality_poi` | `/api/recommender/score-quality-poi` | ScrapingDog + Flash-Lite | ~$0.01 |

---

## Tool Configurations

### add_anchor.json

```json
{
  "type": "webhook",
  "name": "add_anchor",
  "description": "Add a commute anchor (work, school, family) and generate commute zones on the map",
  "response_timeout_secs": 5,
  "api_schema": {
    "url": "https://leo.casa/api/agents/add-anchor",
    "method": "POST",
    "content_type": "application/json",
    "request_body_schema": {
      "type": "object",
      "required": ["userId", "address", "anchorType"],
      "properties": {
        "userId": {
          "type": "string",
          "is_system_provided": true,
          "dynamic_variable": "user_id"
        },
        "address": {
          "type": "string",
          "description": "Address or place name (e.g., 'Diagonal Mar', 'Plaza Catalunya')"
        },
        "anchorType": {
          "type": "string",
          "enum": ["work", "school", "partner_work", "family", "gym", "other"],
          "description": "Type of commute anchor"
        },
        "transportMode": {
          "type": "string",
          "enum": ["transit", "bike", "moped", "drive", "walk"],
          "default": "transit"
        },
        "maxMinutes": {
          "type": "integer",
          "default": 30,
          "description": "Maximum acceptable commute time"
        }
      }
    }
  }
}
```

### show_property.json

```json
{
  "type": "webhook",
  "name": "show_property",
  "description": "Show the user a property carousel on their screen. Use when you want to validate properties with them or understand their visual preferences.",
  "response_timeout_secs": 10,
  "api_schema": {
    "url": "https://leo.casa/api/agents/vibe-check",
    "method": "POST",
    "content_type": "application/json",
    "request_body_schema": {
      "type": "object",
      "required": ["userId"],
      "properties": {
        "userId": {
          "type": "string",
          "is_system_provided": true,
          "dynamic_variable": "user_id"
        },
        "transcriptContext": {
          "type": "string",
          "description": "Last ~500 chars of conversation for context"
        },
        "specificRequest": {
          "type": "string",
          "description": "What to look for (e.g., 'more light', 'bigger kitchen')"
        },
        "count": {
          "type": "integer",
          "default": 3,
          "description": "Number of properties to show (1-5)"
        }
      }
    }
  }
}
```

### probe_city_familiarity.json

```json
{
  "type": "webhook",
  "name": "probe_city_familiarity",
  "description": "Record how well the user knows the city to adjust advice level",
  "response_timeout_secs": 3,
  "api_schema": {
    "url": "https://leo.casa/api/agents/probe-familiarity",
    "method": "POST",
    "content_type": "application/json",
    "request_body_schema": {
      "type": "object",
      "required": ["userId", "familiarity"],
      "properties": {
        "userId": {
          "type": "string",
          "is_system_provided": true,
          "dynamic_variable": "user_id"
        },
        "familiarity": {
          "type": "string",
          "enum": ["none", "visited", "expert"],
          "description": "How well user knows the city"
        }
      }
    }
  }
}
```

---

## WebSocket Events (Map Updates)

| Event | Trigger | Map Action |
|-------|---------|------------|
| `ZOOM_TO_CITY` | User mentions city | Zoom + city bounds |
| `ADD_COMMUTE_ZONE` | Anchor detected | Show Turf.js radial circles |
| `SET_NEIGHBORHOODS` | Lifestyle revealed | Color neighborhoods by match |
| `ADD_POIS` | POI searched | Show POI markers |
| `UPDATE_HEATMAP` | POI scored | Update gradient overlay |
| `SHOW_VIBE_CHECK` | Property carousel triggered | Switch to property view |

---

## Agent Prompts

### System Prompt (Leo-Intake-Renter)

```
You are Leo, a friendly and knowledgeable property finding assistant for Barcelona.

## Your Tools

You have access to these tools:

1. **detect_city** - Call when user mentions a city to zoom the map
2. **add_anchor** - Call when user mentions where they work/go to school/etc
3. **update_profile** - Call after extracting ANY preference to save immediately
4. **check_availability** - Call after getting budget + location to validate search
5. **show_property** - Call during What-Ifs to show 3-5 properties and gauge reaction
6. **probe_city_familiarity** - Call early to understand how much local wisdom to share
7. **surface_tradeoff** - Call when user mentions something with a common pitfall

## Key Flow Points

- **After city mentioned:** Call detect_city, then ask "Have you spent much time in [city]?"
- **After work/school mentioned:** Call add_anchor to generate commute zones
- **After each preference:** Call update_profile immediately
- **Before What-Ifs:** Call check_availability to confirm realistic search
- **During What-Ifs:** Call show_property to visually validate preferences

## Local Wisdom (For Newcomers)

When user's familiarity = 'none' and they mention:
- "Near beach" → Surface tradeoff about touristy areas
- "Central" → Explain tourist-heavy vs local-favorite neighborhoods
- "Nightlife" → Note that nightlife is inland, not coastal

## Important Behaviors

- Never negotiate on commute during the initial call
- Show the map updating in real-time as they share preferences
- Frame vibe-check as: "Let me show you a few places - it'll help me understand what catches your eye"
- End with: "I'll search for you and send first results within 24 hours"
```

---

## ElevenLabs CLI Commands

```bash
# 1. Export API key
export ELEVENLABS_API_KEY=$(grep ELEVENLABS_API_KEY .env.local | cut -d'=' -f2)

# 2. Pull existing agents
elevenlabs agents pull --all

# 3. Push tools
elevenlabs tools push tool_configs/add_anchor.json
elevenlabs tools push tool_configs/show_property.json
elevenlabs tools push tool_configs/probe_city_familiarity.json
elevenlabs tools push tool_configs/generate_commute_zones.json

# 4. Attach tools to agents
elevenlabs agents update Leo-Intake-Renter --add-tool add_anchor
elevenlabs agents update Leo-Intake-Renter --add-tool show_property
elevenlabs agents update Leo-Intake-Renter --add-tool probe_city_familiarity
elevenlabs agents update Leo-Intake-Renter --add-tool generate_commute_zones

# 5. Push updated agent configs
elevenlabs agents push agent_configs/Leo-Intake-Renter.json
```

---

## Files to Create

```
tool_configs/
├── add_anchor.json
├── show_property.json
├── probe_city_familiarity.json
├── surface_tradeoff.json
├── generate_commute_zones.json
└── record_calibration.json

agent_configs/
├── Leo-Intake-Renter.json
└── Leo-Intake-Buyer.json

src/app/api/agents/
├── add-anchor/route.ts
├── vibe-check/route.ts
├── probe-familiarity/route.ts
├── surface-tradeoff/route.ts
└── record-calibration/route.ts
```

---

## Related Documents

| Document | Contents |
|----------|----------|
| [P0-04-LOCATION-SCORING](./P0-04-LOCATION-SCORING.md) | Turf.js commute zones |
| [P0-06-UI-COMPONENTS](./P0-06-UI-COMPONENTS.md) | Map and carousel UI |

---

*Last Updated: December 2024*

