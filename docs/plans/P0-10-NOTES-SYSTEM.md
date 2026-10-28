# P0-10: Notes System (WhatsApp-Style)

> User notes are a critical feedback signal. Notes feed into fit scoring and preference learning.

## 1. The Vision

Transform the notes panel into a **WhatsApp-like chat** where users can dump text, photos, and voice notes freely. Leo periodically responds with his "two cents" about the property based on their notes.

```
┌─────────────────────────────────────────────────────────────┐
│ 💬 Tus notas sobre este piso                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [You]: La cocina es pequeña         ✓✓ 14:32              │
│                                                             │
│  [You]: Pero me gusta la luz         ✓✓ 14:32              │
│                                                             │
│  [You]: [🎤 0:08 ▶────────]          ✓✓ 14:33              │
│                                                             │
│  [You]: [📸 kitchen photo]           ✓✓ 14:33              │
│                                                             │
│  [Leo]: 🤔 Dame un momento...                               │
│                                                             │
│  [Leo]: ✨ Esto es lo que pienso:                           │
│         La luz natural es algo que valoras mucho -          │
│         cocina pequeña pero luminosa > grande y oscura.     │
│         He actualizado tus preferencias.                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [📷] [🎤] [  Escribe aquí...                     ] [➤]     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Key UX Principles

| Behavior | WhatsApp-Style | NOT like Q&A Chat |
|----------|----------------|-------------------|
| User sends text | **Instant appear** ✓✓ | ~~Loading spinner~~ |
| User sends photo | **Instant appear** with thumbnail | ~~Wait for processing~~ |
| User sends voice | **Instant appear** with waveform | ~~Transcription wait~~ |
| Send button state | **Normal arrow** (always) | ~~Square while waiting~~ |
| Leo responds | **Loading only then** | ~~Loading on every send~~ |

**Key insight**: User messages are notes, not questions. They appear instantly. Leo responds periodically (after ~1 min idle), NOT after every message.

---

## 3. Notes Processing Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User views property → Takes notes                           │
│                                                             │
│ "Love the balcony but kitchen is too small"                 │
│ "Hate the carpet, would need to redo floors"                │
│ "Perfect location near the park"                            │
└─────────────────────────────────────────────────────────────┘
                        ↓
                [20 minute delay OR 1 min idle]
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Background job triggers:                                    │
│                                                             │
│ 1. Analyze notes with AI                                    │
│ 2. Extract likes/dislikes                                   │
│ 3. Update user profile preferences                          │
│ 4. Recalculate fit scores for saved properties              │
│ 5. Queue WPA update if significant preference change        │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema

```sql
-- Migration: 072_notes_processing.sql

-- Track when notes were last processed
ALTER TABLE property_notes
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS extracted_signals JSONB,
ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('text', 'photo', 'voice')),
ADD COLUMN IF NOT EXISTS media_url TEXT,           -- Supabase Storage URL
ADD COLUMN IF NOT EXISTS media_duration_ms INTEGER, -- For voice notes
ADD COLUMN IF NOT EXISTS transcription TEXT;        -- Voice → text

-- Store extracted preference signals
CREATE TABLE IF NOT EXISTS user_preference_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('note', 'followup_call', 'onboarding')),
  source_id UUID,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('like', 'dislike', 'must_have', 'dealbreaker')),
  category TEXT NOT NULL,
  description TEXT,
  confidence FLOAT DEFAULT 0.8,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_preference_signals_user ON user_preference_signals(user_id);

-- Leo's responses (separate from user notes)
CREATE TABLE IF NOT EXISTS leo_note_responses (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL,
  profile_type TEXT DEFAULT 'renter',
  trigger_note_ids BIGINT[],
  response_json JSONB NOT NULL,
  signals_extracted JSONB,
  fit_score_before INTEGER,
  fit_score_after INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/notes` | POST | Create note (text/photo/voice) - INSTANT |
| `/api/notes` | GET | Get notes for listing |
| `/api/notes/analyze` | POST | Trigger Leo's analysis |
| `/api/notes/upload` | POST | Upload photo/voice to Storage |
| `/api/notes/process` | POST | Process unprocessed notes (cron) |

### Notes Processing API

```typescript
// POST /api/notes/process - Triggered by cron after 20min delay
interface NotesProcessRequest {
  noteIds: string[];
}

interface ExtractedSignal {
  type: 'like' | 'dislike' | 'must_have' | 'dealbreaker';
  category: string; // 'kitchen', 'balcony', 'location', etc.
  description: string;
  confidence: number;
}

interface NotesAnalysis {
  signals: ExtractedSignal[];
  profileUpdates: {
    addToPreferences?: string[];
    addToDealbreakers?: string[];
    updateTradeoffs?: Record<string, number>;
  };
  shouldUpdateWPA: boolean;
}
```

---

## 6. Signal Types

| Signal Type | Example Note | Impact |
|-------------|--------------|--------|
| `like` | "Me gusta la luz" | +weight to natural_light in fit scoring |
| `dislike` | "La cocina muy pequeña" | -weight to small_kitchen tolerance |
| `must_have` | "Necesito terraza sí o sí" | Adds `outdoor_space` as requirement |
| `dealbreaker` | "Nunca sin ascensor" | Adds `elevator_required` dealbreaker |
| `photo_context` | 📸 of dark room | AI extracts "lighting concern" |
| `voice_sentiment` | 🎤 "Ugh this bathroom..." | AI extracts tone + content |

---

## 7. Signal Categories

```
kitchen, bathroom, bedroom, living_room, outdoor_space, 
light, location, noise, flooring, storage, size, 
transport, parking, general
```

### Category → Dimension Mapping

```typescript
// src/lib/signals/signalToDimensionMap.ts
export const SIGNAL_TO_DIMENSION: Record<string, string[]> = {
  // WPA dimensions
  light: ['wpa.natural_light_intensity', 'wpa.window_quality'],
  kitchen: ['wpa.kitchen_functionality', 'wpa.kitchen_size'],
  bathroom: ['wpa.bathroom_condition', 'wpa.bathroom_modernity'],
  outdoor_space: ['wpa.outdoor_space_quality', 'wpa.has_outdoor_space'],
  storage: ['wpa.storage_quality', 'wpa.closet_space'],
  flooring: ['wpa.flooring_condition', 'wpa.flooring_quality'],
  
  // Listing dimensions  
  size: ['listing.sqm', 'wpa.perceived_spaciousness'],
  bedroom: ['listing.bedrooms'],
  parking: ['listing.has_parking'],
  
  // Location/neighborhood dimensions
  location: ['neighborhood.overall_score'],
  noise: ['wpa.noise_level', 'neighborhood.noise_score'],
  transport: ['neighborhood.transit_score', 'listing.commute_minutes'],
};
```

---

## 8. Leo's "Two Cents" Response

```typescript
interface LeoTwoCentsResponse {
  summary: string;           // "Esto es lo que pienso..."
  observations: {
    positives: string[];     // Things user seems to like
    concerns: string[];      // Things user seems worried about
    tradeoffs: string[];     // "Te gusta la luz > tamaño cocina"
  };
  profileUpdates: {
    newLikes: string[];
    newDislikes: string[];
    newDealbreakers: string[];
  };
  fitScoreImpact: {
    thisProperty: number;    // Updated fit score for current property
    reason: string;          // "Subió porque valoras la luz"
  };
}
```

---

## 9. Processing Timing

### Option A: Vercel Cron (for batching)

```typescript
// Vercel Cron: /api/cron/process-notes
// Schedule: Every 5 minutes

export async function GET() {
  const { data: notes } = await supabase
    .from('property_notes')
    .select('*')
    .is('processed_at', null)
    .lt('created_at', new Date(Date.now() - 20 * 60 * 1000).toISOString())
    .limit(500);

  const byUser = groupBy(notes, 'user_id');

  await Promise.all(
    Object.entries(byUser).map(([userId, userNotes]) =>
      processUserNotes(userId, userNotes)
    )
  );
  
  return Response.json({ processed: notes?.length || 0 });
}
```

### Option B: On-demand (debounce after 1 min idle)

```typescript
const debouncedProcess = useDebouncedCallback(
  async (noteId: string) => {
    await fetch('/api/notes/process', { 
      method: 'POST', 
      body: JSON.stringify({ noteIds: [noteId] }) 
    });
  },
  60_000 // 1 minute of no typing
);
```

**Decision**: Use **both** - Option B for fast feedback, Option A as fallback.

---

## 10. Signal → Weight → Fit Score Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  NEEDED STATE (complete pipe)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Notes → Signals → MAPPING → Weights → Fit Scores                           │
│              │         │         │           │                              │
│              ▼         ▼         ▼           ▼                              │
│         user_pref   SIGNAL_   user_life   fitScoringV2                      │
│         _signals   TO_DIM    style_prof  .calculateFit                      │
│         table      mapping   .preference  Score()                           │
│                              _weights                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Weight Adjustment Formula

```typescript
// For each "like" signal, increase weight by (0.1 × confidence)
// For each "dislike" signal, decrease weight by (0.1 × confidence)

const dimensions = SIGNAL_TO_DIMENSION[signal.category];
const adjustment = signal.type === 'like' ? 0.1 : -0.1;
const finalAdjustment = adjustment * signal.confidence;

// Update user profile
await supabase
  .from('user_lifestyle_profiles')
  .update({
    preference_weights: {
      ...existingWeights,
      [dimension]: (existingWeights[dimension] || 1.0) + finalAdjustment
    }
  })
  .eq('user_id', userId);
```

---

## 11. Fit Score vs WPA Updates

| What | When | Why |
|------|------|-----|
| **Fit Scores** | IMMEDIATELY after notes/followup | User wants instant feedback |
| **WPA** | Weekly | Major criteria changes are rare |

Only regenerate WPA for **major** changes:
- New dealbreaker identified
- Budget range changed significantly
- Location preferences shifted
- Multiple consistent patterns (e.g., keeps disliking ground floor)

---

## 12. Component Architecture

```
NotesChat (new component)
├── NotesList
│   ├── UserNote (text)
│   ├── UserNote (photo) ─────────> Supabase Storage
│   ├── UserNote (voice) ─────────> Supabase Storage
│   └── LeoResponse
├── NotesInput
│   ├── PhotoPicker (camera + gallery)
│   ├── VoiceRecorder (hold-to-record)
│   └── TextInput
└── useDebouncedLeoResponse (1 min idle → trigger Leo)
```

---

## 13. Current Implementation Status

| Component | Status | What Exists | What's Missing |
|-----------|--------|-------------|----------------|
| Notes CRUD API | ✅ | `/api/notes` | Media upload |
| Notes table | ✅ | `property_notes` | media_type, media_url columns |
| Signal extraction | ⚠️ | Keyword-based regex | Gemini-powered extraction |
| `user_preference_signals` table | ✅ | Stores extracted signals | Category → dimension mapping |
| Cron job | ✅ | Every 5 min | - |
| `recalculateFitScores()` | ⚠️ | Function exists | Actually recalculate |
| WhatsApp-style UI | ❌ | - | NotesChat component |
| Photo notes | ❌ | - | PhotoPicker + Storage |
| Voice notes | ❌ | - | VoiceRecorder + transcription |
| Leo's "two cents" | ❌ | - | `/api/notes/analyze` |
| Signals → Weights | ❌ | Signals stored | Wire to fit scoring |

---

## 14. Task Checklist

- [x] Apply migration 072 (notes_processing)
- [x] Create `/api/notes/process` endpoint
- [x] Create `/api/cron/process-notes` cron job
- [x] Implement AI note analysis (keyword-based)
- [x] Create `user_preference_signals` table logic
- [ ] Upgrade to Gemini-powered signal extraction
- [ ] Create NotesChat component (WhatsApp-style)
- [ ] Add photo upload support
- [ ] Add voice recording + transcription
- [ ] Create `/api/notes/analyze` (Leo's two cents)
- [ ] Wire signals → preference weights
- [ ] Implement real fit score recalculation
- [ ] Test full flow: note → 1 min → process → fit scores update

---

*Part of [P0 Lean App Documentation](./P0_INDEX.md)*

