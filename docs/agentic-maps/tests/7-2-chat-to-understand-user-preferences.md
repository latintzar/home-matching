---
test_id: "7.2"
name: "Chat to understand user preferences"
scenario: 7
scenario_name: "Scenario 7: Multi-Stop Route"
status: not-started
api: "Gemini 2.5 Flash (conversational)"
cost: "~$0.003"
implementation: null
last_tested: null
---

### Test 7.2 - Chat to understand user preferences

| | |
|---|---|
| **Input** | City name (from 7.1) |
| **Output** | Conversational flow collecting vibe, interests, pace |
| **API** | Gemini 2.5 Flash (conversational) |
| **Cost** | ~$0.003 |
| **Proves** | AI can have natural preference-gathering conversation |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | User has seen city areas (7.1) | Context established |
| 2 | AI opens conversation | "What kind of day are you imagining? Lively pubs, cultural sites, local hidden gems?" |
| 3 | User responds | Free text |
| 4 | AI asks follow-up | "Are you more 'tick off the highlights' or 'wander and discover'?" |
| 5 | Continue 2-3 turns | Gather: vibe, interests, pace |
| 6 | AI summarizes | "Got it: pub-focused with some history, relaxed pace" |
| 7 | Store preferences | `{ vibe, interests, pace, impliedMix }` |

**📋 TEST CONVERSATION (respond to AI prompts):**

**Your response 1:**
```
Definitely want to hit some classic pubs, but also see some history
```

**Your response 2:**
```
More relaxed, we have my dad with us
```

**Your response 3:**
```
Would love to see Trinity College
```

**Expected AI summary:**
```
✨ Got it! Here's what I'm hearing:
• Pub-focused with history mixed in
• Relaxed pace (dad-friendly)
• Trinity College is a must
Ready to talk logistics?
```
