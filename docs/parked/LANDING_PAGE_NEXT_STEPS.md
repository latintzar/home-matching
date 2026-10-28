# Leo.casa Landing Page - Next Steps

**Last Updated:** November 27, 2025  
**Status:** ✅ Core features deployed and working!

---

## ✅ Completed This Session

### 1. Mobile & UX Fixes
- [x] **Fixed professional tabs positioning** - Now use single fixed pill at top (like consumer tabs)
- [x] **Reduced redundant CTAs** - Removed duplicate CTAs from Benefits and Testimonials sections
- [x] **Cleaner scroll flow** - Single CTA at bottom of each persona flow

### 2. Isochrone Visualization
- [x] **Beautiful blobby isochrones** in hero section (`src/components/landing/illustrations/Isochrones.tsx`)
- [x] **Colorful gradient zones** - 10/20/30 min commute rings with emerald/blue/amber colors
- [x] **Location labels** - Work, Gym, Friends, Metro with time indicators
- [x] **Animation** - Subtle floating/pulsing effect

### 3. Compact Vignettes (~150-180px)
- [x] **VignetteLeoAsks** - Chat interface showing Leo learning your preferences
- [x] **VignettePropertyMatch** - Property card with "94% fit" and "Why it fits" explanation
- [x] **VignetteFeedbackLoop** - Quick reactions + viewing notes tags

### 4. Micro Mockups (~100px)
Created `src/components/landing/illustrations/MicroMockups.tsx` with:
- `MicroPropertyCard`, `MicroChecklist`, `MicroFitBadge`
- `MicroReactions`, `MicroViewingNote`
- `MicroLeoBubble`, `MicroUserBubble`
- `MicroAssigneeStatus`, `MicroClientFit`
- `MicroRedFlag`, `MicroGreenCheck`
- `MicroSendToLeo`, `MicroNotification`, `MicroPriceCompare`, `MicroTimeline`

### 5. "Listing vs Reality" Mockup
- Shows staged listing photo vs your viewing photos
- Highlights discrepancies: dark corners, water stains, etc.
- Leo insight card explaining what he learned

---

## 🎯 Next: Generate Gemini Images

The page now has great React mockups. To add lifestyle/mood imagery, use Gemini 3 Pro Image.

### Image Generation API

Use existing routes in `src/app/api/listings/[id]/visuals/r3-render/route.ts` as reference.

### Images to Generate

1. **Hero Background - Spanish City Map**
   ```
   Prompt: "Aerial view of a Mediterranean European city in Spain, Barcelona/Valencia style, 
   no recognizable landmarks, no text. Soft stylized look like a game minimap meets 
   editorial illustration. Clear street grid and blocks with parks and plazas. 
   Calm color palette: muted blues, terracotta roofs, soft neutrals. 
   Warm welcoming mood, slightly idealized."
   ```

2. **Interior Lifestyle Image**
   ```
   Prompt: "Modern realistic interior of a Spanish apartment, bright living room with 
   natural light, some plants, simple furniture. Editorial magazine feel, not glossy 
   real estate brochure. Clean composition for web landing page background."
   ```

3. **Street/Neighbourhood Image**
   ```
   Prompt: "Walkable Spanish street scene, low to mid-rise buildings, small balconies, 
   trees, café terrace. Late afternoon golden light. No signage or legible text. 
   Calm lived-in mood, not touristy."
   ```

4. **Building Façade (for Buyers)**
   ```
   Prompt: "Typical Spanish apartment building façade, 1960-1980s era, balconies, 
   slight wear but not run-down. Neutral sky, clean framing. Honest mood, 
   no visible brand names or signage."
   ```

### How to Add Images

1. Generate images using Gemini 3 Pro Image routes
2. Save to Supabase Storage: `public/landing/hero-city.png`, etc.
3. Update components to use Next.js `<Image>` with the URLs

---

## 📋 Remaining Polish Tasks

### Visual Polish
- [ ] Generate Gemini background images (see above)
- [ ] Add subtle CSS animations to micro-mockups (fade-in on scroll)
- [ ] Test isochrone colors on different screens

### Professional Section
- [ ] Add compact vignettes to Buyer Agents section (extension overlay mockup)
- [ ] Add compact vignettes to Relocation section (housing brief mockup)
- [ ] Use MicroMockups for inline illustrations

### Mobile Responsiveness
- [ ] Test compact vignettes stack gracefully on mobile
- [ ] Verify isochrone scales down properly
- [ ] Check touch targets on all toggles

### Functional Connections
- [ ] Connect "Talk to Leo" CTA to actual chat/onboarding
- [ ] Connect "Sign in" to auth page
- [ ] Add smooth scroll for "How Leo works" nav link

---

## 📁 Key Files

```
src/components/landing/
├── illustrations/
│   ├── Isochrones.tsx          # Blobby commute zones
│   ├── MicroMockups.tsx        # Tiny 100px inline elements
│   ├── CompactVignettes.tsx    # 150-180px step illustrations
│   ├── MarketingMockups.tsx    # Larger marketing illustrations
│   └── index.ts                # All exports
├── sections/
│   ├── SectionHero.tsx         # Now supports showIsochrone prop
│   ├── RentersHowItWorks.tsx   # Custom section with vignettes
│   └── ...
├── RentersContent.tsx          # Main renters page
├── BuyersContent.tsx           # Buyers page
├── BuyerAgentsContent.tsx      # Professional section
├── RelocationContent.tsx       # Professional section
└── content-data.ts             # All copy (source of truth)
```

---

## 🚀 Deployment Status

- **Build**: ✅ Passing
- **Deployed**: ✅ Pushed to `master`
- **Vercel**: Should auto-deploy from push

Safe travels! ✈️
