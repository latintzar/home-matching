---
test_id: "7.3"
name: "Chat to understand logistics & constraints"
scenario: 7
scenario_name: "Scenario 7: Multi-Stop Route"
status: not-started
api: "Gemini 2.5 Flash (conversational)"
cost: "~$0.003"
implementation: null
last_tested: null
---

### Test 7.3 - Chat to understand logistics & constraints

| | |
|---|---|
| **Input** | Preferences from 7.2 |
| **Output** | Conversational flow collecting timing, people, constraints |
| **API** | Gemini 2.5 Flash (conversational) |
| **Cost** | ~$0.003 |
| **Proves** | AI handles complex constraint gathering gracefully |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | AI asks timing | "What time are you starting, and when do you need to wrap up?" |
| 2 | User responds | "Starting at 11am, want to be done by 10pm" |
| 3 | AI asks about group | "How many people? Any accessibility needs or quirks?" |
| 4 | User responds | "4 people - dad needs a siesta around 3pm, friend in wheelchair" |
| 5 | AI confirms constraints | "So: wheelchair accessible venues, 2-hour break ~3pm. Anything else?" |
| 6 | User confirms or adds | "That's it!" |
| 7 | AI announces ready | "✅ I have everything! Here's what I'm working with: [summary]" |
| 8 | Store logistics | `{ startTime, endTime, people, constraints: [...] }` |

**📋 TEST CONVERSATION (respond to AI prompts):**

**Your response 1:**
```
Probably around 11am, need to finish by 10pm for the last bus
```

**Your response 2:**
```
4 of us - me, my partner, my dad, and a friend. Dad usually needs a siesta around 3pm, and my friend uses a wheelchair
```

**Your response 3:**
```
Nope, that's everything
```

**Expected AI summary:**
```
✅ Perfect, I have everything I need!

📋 Planning for:
• 4 people, 11am - 10pm
• Pubs + history, relaxed pace
• Trinity College must-see
• Wheelchair accessible
• Siesta break 3-5pm

Let me work out some options...
```
