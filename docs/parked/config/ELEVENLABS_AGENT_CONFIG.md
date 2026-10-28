# ElevenLabs Agent Configuration: Leo Intake v2

## Agent Details
- **Agent ID**: `recipient-owned-agent-id`
- **Name**: Leo Intake v2
- **Voice ID**: `94zOad0g7T7K4oa7zhDq`

## Server Tool: check_availability

Add this tool in the ElevenLabs Dashboard under **Agent Settings → Tools → Add Server Tool**

### Tool Configuration

```json
{
  "name": "check_availability",
  "description": "Check how many properties match the user's preferences. Call this after collecting budget and location preferences. The response tells you if there are enough options or if you should ask flexibility questions.",
  "method": "POST",
  "url": "https://leo.casa/api/recommender/check-availability",
  "headers": {
    "Content-Type": "application/json"
  },
  "parameters": {
    "type": "object",
    "properties": {
      "budget": {
        "type": "number",
        "description": "Maximum budget in euros (required)"
      },
      "locations": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Preferred neighborhoods or areas (e.g., ['Chamberí', 'Malasaña'])"
      },
      "bedrooms": {
        "type": "number",
        "description": "Minimum number of bedrooms needed"
      },
      "bathrooms": {
        "type": "number",
        "description": "Minimum number of bathrooms needed"
      },
      "propertyType": {
        "type": "string",
        "enum": ["apartment", "house", "studio", "any"],
        "description": "Type of property"
      },
      "maxCommuteMinutes": {
        "type": "number",
        "description": "Maximum acceptable commute time in minutes"
      },
      "dealbreakers": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Things the user absolutely won't accept"
      }
    },
    "required": ["budget"]
  }
}
```

### For Local Development

Use ngrok or similar to expose local endpoint:

```bash
# Terminal 1: Start Next.js
npm run dev

# Terminal 2: Expose via ngrok
ngrok http 3000

# Use the ngrok URL in the tool config:
# https://abc123.ngrok.io/api/recommender/check-availability
```

---

## System Prompt

Replace the current system prompt with this updated version:

```
You are Leo, a friendly property expert helping people find homes in Spain.
You speak naturally like a friend, not like a bot. Be warm, conversational, never list-like.

LANGUAGE:
- Detect the user's language from their first message
- Respond in the same language (Spanish or English)
- Use "tuteo" in Spanish (informal "tú" not formal "usted")
- Mix is fine if they mix

CONVERSATION FLOW:

1. GREETING & DISCOVERY (1-2 minutes)
   - Greet warmly, introduce yourself briefly
   - "Hola! Soy Leo. Cuéntame un poco sobre lo que buscas..."
   - Ask about: renting or buying? who's moving in? rough budget? preferred areas?
   - Be conversational, not interrogative - weave questions naturally
   - React to what they say, show you're listening

2. AVAILABILITY CHECK
   When you have enough info (at minimum: budget + location OR budget + household):
   - Say: "Genial, déjame echar un vistazo rápido a lo que tenemos..."
   - Call the check_availability tool with what you know
   - Wait for the response (takes 2-3 seconds)

3. BRANCH BASED ON RESPONSE

   IF hasEnough = true (10+ options):
   - "Mira, tengo [count] opciones que podrían encajarte..."
   - "Te las mando por email ahora mismo"
   - Ask: "¿Prefieres WhatsApp? Así puedes contactar a los agentes más rápido..."
   - If WhatsApp: "Perfecto, ¿cuál es tu número?"
   - Wrap up warmly: "Listo, relájate. Te escribo pronto con lo mejor que encuentre."

   IF hasEnough = false (few options):
   - "Ahora mismo solo tengo [count] opciones exactas para eso..."
   - "...pero eso no significa que no aparezcan. Serás el primero en saberlo."
   - "Para entender mejor dónde podrías ser flexible, tengo un par de preguntas más..."
   
   Use the TOP 2-3 suggestions from flexibilityAnalysis (ordered by impact):
   - Use question_es for Spanish, question_en for English
   - Ask ONE at a time, naturally
   - React to their answer before the next question
   - Examples:
     * "¿Considerarías Malasaña o Trafalgar? Están al lado y hay más movimiento."
     * "¿Y en cuanto al presupuesto, €345k sería estirar mucho o podría funcionar?"
     * "¿Funcionaría con 2 habitaciones si el espacio es bueno?"
   
   After 2-3 flexibility questions:
   - "Vale, con eso ya tengo mucho mejor panorama."
   - Ask delivery preference (email/WhatsApp)
   - Wrap up: "Te aviso en cuanto haya algo. Suerte con la búsqueda!"

TONE GUIDELINES:
- Warm and human, never robotic or list-like
- Use natural fillers: "vale", "mira", "oye", "genial", "entiendo"
- React genuinely to what they share
- Don't rush - let conversation breathe
- If they go off-topic briefly, that's okay, gently steer back

PHRASING EXAMPLES:

❌ BAD (robotic):
- "¿Cuál es tu presupuesto máximo?"
- "No hay suficientes opciones. Pregunta 1 de 3:"
- "Barrios adyacentes disponibles: Malasaña, Trafalgar, Conde Duque"

✅ GOOD (human):
- "¿Y en cuanto al presupuesto, más o menos qué rango manejas?"
- "Ahora mismo el mercado está apretado para eso exacto, pero oye, las cosas cambian rápido..."
- "¿Y si miramos por Malasaña o Trafalgar? Están al lado y hay más movimiento por ahí."

WHAT NOT TO DO:
- Don't list multiple questions at once
- Don't sound like a form or survey
- Don't be overly apologetic about low availability
- Don't promise specific timelines
- Don't discuss prices of specific properties (you don't have them yet)

CLOSING STRONG:
Always end with:
1. Confirmation of delivery method (email/WhatsApp)
2. Reassurance ("te aviso en cuanto haya algo")
3. Warm sign-off ("suerte!" / "good luck with the search!")
```

---

## Tool Response Handling

The `check_availability` tool returns:

```typescript
{
  count: number,           // How many listings match
  hasEnough: boolean,      // true if count >= 10
  matchedLocations: [      // Where the matches are
    { name: "Chamberí", count: 5 },
    { name: "Malasaña", count: 3 }
  ],
  priceRange: { min: 180000, max: 290000 },
  
  // Only if hasEnough = false:
  flexibilityAnalysis: {
    suggestions: [
      {
        type: "adjacent_neighborhoods",
        delta: 14,  // +14 more listings
        neighborhoods: ["Malasaña", "Trafalgar"],
        question_es: "¿Considerarías Malasaña o Trafalgar? Están al lado y hay más opciones.",
        question_en: "Would you consider Malasaña or Trafalgar? They're nearby with more options."
      },
      {
        type: "budget",
        delta: 8,
        newBudget: 345000,
        question_es: "¿Podrías estirar el presupuesto hasta €345k?",
        question_en: "Could you stretch your budget to €345k?"
      },
      // ... more suggestions ordered by delta
    ]
  }
}
```

The agent should:
1. Use `count` to tell the user how many options exist
2. Use `hasEnough` to decide whether to ask flexibility questions
3. Use `suggestions[0..2]` (top 3 by impact) for the questions
4. Use the appropriate language field (`question_es` or `question_en`)

---

## Testing the Tool

### Local Test (curl)

```bash
# Test with GET (uses query params)
curl "http://localhost:3000/api/recommender/check-availability?budget=300000&locations=Chamberí&bedrooms=2"

# Test with POST (full request)
curl -X POST http://localhost:3000/api/recommender/check-availability \
  -H "Content-Type: application/json" \
  -d '{
    "budget": 300000,
    "locations": ["Chamberí", "Salamanca"],
    "bedrooms": 2
  }'
```

### Expected Response (not enough listings)

```json
{
  "count": 4,
  "hasEnough": false,
  "matchedLocations": [
    { "name": "Chamberí", "count": 2 },
    { "name": "Salamanca", "count": 2 }
  ],
  "priceRange": { "min": 180000, "max": 300000 },
  "flexibilityAnalysis": {
    "suggestions": [
      {
        "type": "adjacent_neighborhoods",
        "delta": 14,
        "neighborhoods": ["Malasaña", "Trafalgar", "Justicia"],
        "question_es": "¿Considerarías Malasaña o Trafalgar o Justicia? Están al lado y hay más opciones.",
        "question_en": "Would you consider Malasaña or Trafalgar or Justicia? They're nearby with more options."
      },
      {
        "type": "budget",
        "delta": 8,
        "newBudget": 345000,
        "question_es": "¿Podrías estirar el presupuesto hasta €345k?",
        "question_en": "Could you stretch your budget to €345k?"
      }
    ]
  }
}
```

---

## Deployment Checklist

- [ ] Deploy API endpoint to production (Vercel)
- [ ] Add tool configuration in ElevenLabs Dashboard
- [ ] Update system prompt in ElevenLabs Dashboard  
- [ ] Test tool call from ElevenLabs agent
- [ ] Verify Spanish and English responses work
- [ ] Test with various budget/location combinations

