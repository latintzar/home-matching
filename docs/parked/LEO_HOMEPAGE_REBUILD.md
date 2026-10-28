# Leo.casa Homepage Rebuild

**Last Updated**: December 2, 2025

> **📌 See also**: P0_LEAN_APP.md (`./plans/P0_LEAN_APP.md`, historical reference) - Consolidated P0 MVP spec for the full app (post-homepage)

---

## Overview

A complete rebuild of the Leo.casa homepage to create a clean, production-ready landing page inspired by [jackandjill.ai](https://jackandjill.ai)'s simplicity, but adapted to Leo's four distinct user personas.

---

## The Vision

Make Leo feel like a **trusted, calm, "I've got you" AI co-pilot** for housing decisions. The page should be:
- Fast, responsive, and minimal
- Copy-first (the provided text is the source of truth)
- Default orientation: Renters first
- Also serves: Buyers, Buyer Agents/Personal Shoppers, and Relocation Agencies

---

## What Was Built

### 1. Navigation & Structure
- **Top nav**: Logo (Leo.casa), "How Leo works", "For professionals", "FAQ", "Sign in", Primary CTA "Talk to Leo"
- **Consumer toggles**: `Renting` | `Buying` (switches main content)
- **Professional toggles**: `Buyer Agents` | `Relocation` (in "For professionals" section)
- All content switches happen client-side (no page reload)

### 2. Four Persona Content Systems

Each persona has its own content component with:
- Hero section
- "How it works" steps
- Benefits/"Why Leo"
- Testimonials/love letters
- Closing CTA

**Content source**: `/src/components/landing/content-data.ts` — single source of truth for all copy

### 3. Reusable Section Components

```
src/components/landing/sections/
├── SectionHero.tsx
├── SectionHowItWorks.tsx
├── SectionChecklist.tsx
├── SectionBenefits.tsx
├── SectionTestimonials.tsx
├── SectionCTA.tsx
├── SectionFeatureCard.tsx
├── SectionCallout.tsx
├── RentersHowItWorks.tsx  (custom with vignettes)
└── index.ts
```

### 4. Visual Mockups & Illustrations

```
src/components/landing/illustrations/
├── Isochrones.tsx          # Venn diagram map with Barcelona coast
├── CompactVignettes.tsx    # 150-200px story-telling UI elements
├── MicroMockups.tsx        # Small UI components
├── MarketingMockups.tsx    # Full mockups per persona
└── index.ts
```

### 5. Key Visual Elements

#### Isochrone Map (Hero)
- **Venn diagram style**: Three overlapping blobs (Work/blue, Friends/amber, Lifestyle/rose)
- **Sweet spot**: Emerald overlap area where all priorities meet
- **Barcelona-style map underneath**:
  - Angled 3D perspective (`rotateX(8deg) rotateY(-3deg)`)
  - Coastline on right (east) with beach strip
  - Eixample grid in center
  - Major avenues: Diagonal, Gran Via, Passeig de Gràcia, La Rambla
  - Parks as rectangles fitted to street blocks (Ciutadella, Park Güell, Plaça Catalunya)
  - Montjuïc and Collserola hills as green areas
  - All roads stop before the coastline (no overflow into sea)
- **Labels**: Work (15 min), Friends (12 min), Gym (10 min), Metro (5 min)

#### Voice AI Orb (Step 1)
- **ElevenLabs-inspired**: Amorphous, fluid orb with animated waveform inside
- **Speech bubbles**: Show transcribed verbal input
- Makes it obvious Leo is conversational/voice-based

#### Listing vs Reality Mockup
- **Beautiful listing photo** vs **actual viewing photos** (darker, smaller, weird layout)
- Shows how Leo protects you from misleading listings

#### Casual Feedback (Step 3)
- **iMessage-style thread**: User sending quick voice-note style feedback
- "honestly pretty nice but the street was loud af 😩"
- Leo responds: "Got it—prioritizing quieter streets 🤫"

---

## How Instructions Evolved

### Phase 1: Initial Structure
> "Rebuild Leo.casa homepage using the copy as source of truth. Inspired by jackandjill.ai."

Built the four-persona system with content toggles and reusable section components.

### Phase 2: Visual Mockups Direction
> "Use simple, schematic product mockups... marketing illustrations built from real UI pieces."

Created React-based UI mockups for each persona:
- Renters: Phone mockup with chat + property cards
- Buyers: Split layout with listing + checklist
- Buyer Agents: Browser extension overlay
- Relocation: Housing brief + assignee list

### Phase 3: Compact Vignettes
> "How it works should have small UI elements (~150px tall) that tell the story as you scroll."

Refactored to use compact, punchy vignettes instead of large mockups. Created `CompactVignettes.tsx` with story-telling elements.

### Phase 4: Voice AI Orb
> "The voice orb should be an amorphous orb with ziggy inside, like ElevenLabs."

Updated `VignetteLeoAsks` to feature an animated, fluid orb with waveform animation. Added speech bubbles showing transcribed verbal input.

### Phase 5: Isochrone Evolution
> "Isochrones should look more like a Venn diagram of blobs, not concentric circles."

Complete redesign from concentric rings to overlapping colorful blobs with a "sweet spot" overlap.

### Phase 6: Map Refinement
> "Make the map look more like Barcelona... more evident coast... angle it... parks should fit naturally in between streets."

Multiple iterations:
1. Added Barcelona-style street grid (Eixample, Gràcia, Old Town, Poblenou)
2. Added coastline on the right (east) with beach strip and Port Olímpic hint
3. Angled the map with 3D perspective (`rotateX(8deg) rotateY(-3deg)`)
4. Rotated coastline clockwise for more accurate Barcelona orientation
5. Changed parks from ellipses to rectangles fitted within street blocks
6. Filled bottom gaps with more streets (Sant Antoni / Poble Sec area)
7. Made sure isochrones don't float over water
8. **Fixed all roads/streets to stop before the coastline** — no elements overflow into the sea
9. Added major avenues (Diagonal, Gran Via, Passeig de Gràcia, La Rambla, Meridiana)
10. Added Montjuïc hill (bottom left) and Collserola hills (top left)

### Phase 7: Feedback Loop Refinement
> "The feedback should look like a quick voice note or text to a friend, in the language of a 30 year old."

Changed from formal feedback form to casual iMessage-style thread with emojis.

---

## File Structure

```
src/
├── app/
│   ├── page.tsx              # Main page with nav & persona toggles
│   ├── layout.tsx            # Root layout with metadata
│   └── globals.css           # Animations (waveform, float, morphOrb)
│
└── components/landing/
    ├── content-data.ts       # ALL COPY (source of truth)
    ├── RentersContent.tsx    # Persona content
    ├── BuyersContent.tsx
    ├── BuyerAgentsContent.tsx
    ├── RelocationContent.tsx
    ├── phone-mockups.tsx     # Legacy mockup components
    ├── sections/             # Reusable section components
    └── illustrations/        # Visual mockups & vignettes
```

---

## What's Left To Do

### High Priority

1. **Gemini-Generated Images**
   - [ ] Hero background: Stylized aerial Barcelona illustration
   - [ ] Interior lifestyle shot (Spanish apartment, natural light)
   - [ ] Street/neighbourhood shot (walkable Spanish street, golden light)
   - [ ] Building façade (typical Spanish apartment block)
   - [ ] Work scene (agent at laptop, calm workspace)
   - [ ] City skyline for Relocation section

2. **Professional Personas Polish**
   - [ ] Buyer Agents: Browser extension mockup with "Send to Leo" overlay
   - [ ] Buyer Agents: Client vs Agent view cards side-by-side
   - [ ] Relocation: Housing brief document mockup
   - [ ] Relocation: Assignee list with status pills

3. **Buyers Section**
   - [ ] Viewing checklist mockup (tick-list items)
   - [ ] Comparison strip (2-3 properties with "Feels right / Maybe / No")
   - [ ] Renovation analysis teaser

### Medium Priority

4. **Mobile Optimization**
   - [ ] Test all persona toggles on mobile
   - [ ] Ensure isochrone map scales well
   - [ ] Check vignette sizing on small screens

5. **Interactions**
   - [ ] Smooth scroll to sections when nav links clicked
   - [ ] Maybe subtle entrance animations for sections

6. **Content Review**
   - [ ] Final copy review pass
   - [ ] Ensure all testimonials have real-feeling names
   - [ ] Check for any placeholder text

### Lower Priority

7. **Performance**
   - [ ] Lazy load below-fold content
   - [ ] Optimize SVG map if needed
   - [ ] Image optimization for Gemini-generated assets

8. **Analytics / Tracking**
   - [ ] CTA click tracking
   - [ ] Persona toggle tracking (which persona do users look at?)

---

## Key Design Decisions

### Why Venn Diagram Isochrones?
Traditional concentric circles suggest "distance from center" but Leo is about **multiple priorities overlapping**. The Venn diagram makes it obvious: your sweet spot is where Work + Friends + Lifestyle all intersect.

### Why ElevenLabs-style Orb?
Makes it immediately clear Leo is voice-based. The amorphous, breathing orb feels alive and conversational, not like a static chat interface.

### Why Casual Feedback?
The formal "feedback form" felt clinical. Real renters text their friends "the street was loud af" — Leo should speak their language.

### Why Parks with Straight Edges?
Real Barcelona parks are bounded by streets. Elliptical blobs looked like lakes or random shapes. Rectangles fitted to the grid feel urban and accurate.

### Why Roads Stop Before the Coast?
Geographic accuracy matters for trust. Roads floating over the Mediterranean would look careless. Each street now respects the coastline boundary, reinforcing that this is a real city map, not a generic placeholder.

---

## Running Locally

```bash
cd /Users/peterneyra/puedo_casa
npm run dev
# Open http://localhost:3000
```

---

## Commits

- Initial structure with 4 personas
- Compact vignettes for Renters
- ElevenLabs-style voice orb
- Venn diagram isochrones
- Barcelona map with coastline
- Parks fitted to street grid
- Angled perspective with 3D tilt
- Coastline rotated clockwise
- Green areas with visible parks
- **Fix roads/streets overflowing into the sea** — all elements now stay on land

---

## Notes

- **Copy is sacred**: Don't change meaning, tone, or promises. Structure into sections but keep exact wording.
- **Renters is flagship**: Focus polish here first, then apply learnings to other personas.
- **Less is more**: Fewer, clearer mockups > many small ones.

