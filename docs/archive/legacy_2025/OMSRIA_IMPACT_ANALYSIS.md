# OMSRIA Impact Analysis: What Becomes Obsolete?

**Created:** 2025-01-27  
**Purpose:** Analyze which parts of the pipeline become obsolete or require changes after OMSRIA implementation

---

## 📊 Summary

**OMSRIA is a required evolution** - it becomes a mandatory step in the pipeline. Components must use OMSRIA output exclusively. No fallback to furniture-free images - if OMSRIA hasn't run, subsequent steps should fail with clear error messages.

---

## ✅ Components That Remain Unchanged

### F0: Furniture Removal
**Status:** ✅ **Still Required**  
**Reason:** OMSRIA works on furniture-free images. F0 must run first to produce the input for OMSRIA.

**No changes needed.**

---

### R1: Select Best Image Per Room
**Status:** ✅ **Still Required**  
**Reason:** OMSRIA uses R1's selected images as input. R1 selects the best wide-angle image, then OMSRIA processes it.

**No changes needed.**

---

### R2b-Master, R2b, R3, R4, R5, R6
**Status:** ✅ **Still Required**  
**Reason:** These steps use R2a output, which will now describe OMSRIA-processed images instead of raw furniture-free images.

**No changes needed** (they work with R2a output, which will change internally).

---

## 🔄 Components That Need Updates

### R2a: Describe Room Images

**Current Behavior:**
- Reads `manual_photo_clusters.selected_photo_url`
- Fetches `listing_photos_furniture_free.furniture_free_url`
- Uses furniture-free images directly for description

**Required Changes:**
1. **REQUIRE OMSRIA output (no fallback):**
   ```typescript
   // Fetch OMSRIA processed images (REQUIRED)
   const { data: omsriaImages, error: omsriaError } = await supabase
     .from('omsria_processed_images')
     .select('room_id, image_url, image_type, visible_spaces')
     .eq('listing_id', listingId)
     .eq('is_redundant', false);
   
   if (omsriaError || !omsriaImages || omsriaImages.length === 0) {
     throw new Error(`OMSRIA output not found. Run R1.5 (OMSRIA) first. Error: ${omsriaError?.message || 'No images found'}`);
   }
   
   const omsriaImageMap = new Map(
     omsriaImages.map(img => [img.room_id, img.image_url])
   );
   ```

2. **Use OMSRIA image exclusively:**
   ```typescript
   for (const cluster of clustersWithPhotos) {
     const roomId = `cluster_${cluster.id}`;
     const photoUrl = omsriaImageMap.get(roomId);
     
     if (!photoUrl) {
       throw new Error(`OMSRIA image not found for room ${roomId}. Run R1.5 (OMSRIA) first.`);
     }
     // ... rest of processing
   }
   ```

**Impact:** High - Breaking change: R2a now REQUIRES OMSRIA output. Pipeline will fail if OMSRIA hasn't run.

---

### R3: Render Rooms

**Current Behavior:**
- Uses `furnitureFreeMap.get(beforePhotoUrl)` as the "before" image
- Line 287: `const furnitureFreeUrl = furnitureFreeMap.get(beforePhotoUrl);`
- Uses furniture-free image directly for rendering

**Required Changes:**
1. **REQUIRE OMSRIA output (no fallback):**
   ```typescript
   // Fetch OMSRIA processed images (REQUIRED)
   const { data: omsriaImages, error: omsriaError } = await supabase
     .from('omsria_processed_images')
     .select('room_id, image_url')
     .eq('listing_id', listingId)
     .eq('is_redundant', false);
   
   if (omsriaError || !omsriaImages || omsriaImages.length === 0) {
     throw new Error(`OMSRIA output not found. Run R1.5 (OMSRIA) first. Error: ${omsriaError?.message || 'No images found'}`);
   }
   
   const omsriaImageMap = new Map(
     omsriaImages.map(img => [img.room_id, img.image_url])
   );
   ```

2. **Use OMSRIA image exclusively as "before" for rendering:**
   ```typescript
   const beforePhotoUrl = cluster.photo_url;
   const omsriaImageUrl = omsriaImageMap.get(roomId);
   
   if (!omsriaImageUrl) {
     throw new Error(`OMSRIA image not found for room ${roomId}. Run R1.5 (OMSRIA) first.`);
   }
   
   // Use OMSRIA image as "before" (no fallback)
   const beforeImageUrl = omsriaImageUrl;
   ```

**Impact:** High - Breaking change: R3 now REQUIRES OMSRIA output. Pipeline will fail if OMSRIA hasn't run.

---

### Before/After Carousel Component

**Current Behavior:**
- Line 802: `furnitureFreeMap` maps original URLs to furniture-free URLs
- Line 1087: Uses `furnitureFreeMap[originalBeforeUrl]` for unfurnished toggle
- Shows furniture-free images when "Unfurnished" toggle is on

**Required Changes:**
1. **REQUIRE OMSRIA images (no fallback):**
   ```typescript
   // Fetch OMSRIA processed images (REQUIRED)
   const { data: omsriaImages, error: omsriaError } = await supabase
     .from('omsria_processed_images')
     .select('room_id, image_url, image_type')
     .eq('listing_id', listingId)
     .eq('is_redundant', false);
   
   if (omsriaError || !omsriaImages || omsriaImages.length === 0) {
     console.error('OMSRIA images not found. Run R1.5 (OMSRIA) first.');
     // Show error state in UI - don't render carousel
     return <div>OMSRIA images not available. Please run R1.5 (OMSRIA) first.</div>;
   }
   
   // Build map: cluster_id -> OMSRIA image_url
   const omsriaImageMap: Record<string, string> = {};
   omsriaImages.forEach(img => {
     const clusterId = img.room_id.replace('cluster_', '');
     omsriaImageMap[clusterId] = img.image_url;
   });
   ```

2. **Use OMSRIA images exclusively for unfurnished toggle:**
   ```typescript
   // Map original URLs to OMSRIA images via cluster_id
   const getOmsriaImage = (originalUrl: string): string | null => {
     const clusterId = urlToClusterId[originalUrl];
     return clusterId ? omsriaImageMap[clusterId] || null : null;
   };
   
   const omsriaImageUrl = getOmsriaImage(originalBeforeUrl);
   if (!omsriaImageUrl) {
     // Show error state - OMSRIA image required
     return <div>OMSRIA image not found for this room. Run R1.5 (OMSRIA) first.</div>;
   }
   
   const currentBeforeUrl = showFurnished 
     ? originalBeforeUrl 
     : omsriaImageUrl; // REQUIRED - no fallback
   ```

**Impact:** High - Breaking change: Carousel now REQUIRES OMSRIA output. Will show error if OMSRIA hasn't run.

---

### Download Scripts

**Files Affected:**
- `scripts/download-images-organized.ts` (Line 185-186)
- `scripts/download-images.ts` (if it downloads before-unfurnished)

**Current Behavior:**
- Uses `furnitureFreeUrl` as "before_unfurnished.jpg"
- Falls back to original photo if furniture-free not available

**Required Changes:**
1. **REQUIRE OMSRIA output (no fallback):**
   ```typescript
   // Fetch OMSRIA processed images (REQUIRED)
   const { data: omsriaImages, error: omsriaError } = await supabase
     .from('omsria_processed_images')
     .select('room_id, image_url')
     .eq('listing_id', listingId)
     .eq('is_redundant', false);
   
   if (omsriaError || !omsriaImages || omsriaImages.length === 0) {
     console.error('OMSRIA images not found. Run R1.5 (OMSRIA) first.');
     process.exit(1);
   }
   
   const omsriaImageMap = new Map(
     omsriaImages.map(img => [img.room_id, img.image_url])
   );
   ```

2. **Use OMSRIA image exclusively for before-unfurnished:**
   ```typescript
   const roomId = firstPhoto.room_id;
   const omsriaImageUrl = omsriaImageMap.get(roomId);
   
   if (!omsriaImageUrl) {
     console.error(`OMSRIA image not found for room ${roomId}. Run R1.5 (OMSRIA) first.`);
     continue; // Skip this room
   }
   
   // Use OMSRIA image exclusively (no fallback)
   const beforeUrl = omsriaImageUrl;
   ```

**Impact:** Medium - Scripts now REQUIRE OMSRIA output. Will fail if OMSRIA hasn't run.

---

## 🚫 Nothing Becomes Obsolete (But OMSRIA is Required)

### Why Nothing is Obsolete:

1. **Furniture-free images remain necessary:**
   - OMSRIA works on furniture-free images (they're the input)
   - F0 must still run to produce furniture-free images for OMSRIA
   - Furniture-free images are intermediate artifacts, not final output

2. **All pipeline steps remain:**
   - F0 → R1 → **R1.5 (OMSRIA) [REQUIRED]** → R2a → R2b → R3 → ...
   - OMSRIA adds a new mandatory step
   - Subsequent steps REQUIRE OMSRIA output

3. **OMSRIA is mandatory, not optional:**
   - R2a, R3, and Carousel will fail if OMSRIA hasn't run
   - Orchestrator must enforce OMSRIA as required step
   - No fallback to furniture-free images - OMSRIA output is the only source

---

## 📋 Migration Checklist

### Phase 1: Database & Core OMSRIA
- [x] Create `omsria_processed_images` table
- [ ] Implement OMSRIA endpoint
- [ ] Test OMSRIA process end-to-end

### Phase 2: Update R2a
- [ ] Add OMSRIA image fetching (REQUIRED, no fallback)
- [ ] Update image selection logic (OMSRIA ONLY)
- [ ] Add error handling if OMSRIA not found
- [ ] Test R2a with OMSRIA output
- [ ] Test R2a fails gracefully if OMSRIA hasn't run

### Phase 3: Update R3
- [ ] Add OMSRIA image fetching (REQUIRED, no fallback)
- [ ] Update "before" image selection logic (OMSRIA ONLY)
- [ ] Add error handling if OMSRIA not found
- [ ] Test R3 with OMSRIA output
- [ ] Test R3 fails gracefully if OMSRIA hasn't run

### Phase 4: Update Carousel
- [ ] Add OMSRIA image fetching (REQUIRED, no fallback)
- [ ] Update unfurnished toggle logic (OMSRIA ONLY)
- [ ] Add error UI if OMSRIA not found
- [ ] Test carousel with OMSRIA images
- [ ] Test carousel shows error if OMSRIA hasn't run

### Phase 5: Update Scripts (Optional)
- [ ] Update download scripts to use OMSRIA images
- [ ] Test download scripts

### Phase 6: Orchestrator Integration
- [ ] Add R1.5 (OMSRIA) as REQUIRED step to orchestrator pipeline
- [ ] Enforce OMSRIA completion before R2a
- [ ] Add validation: fail if OMSRIA hasn't run
- [ ] Test full pipeline with OMSRIA
- [ ] Verify pipeline fails gracefully if OMSRIA step skipped

---

## 🔍 Key Insights

### 1. OMSRIA Creates a New Layer, Doesn't Replace

**Before OMSRIA:**
```
Original Photo → F0 → Furniture-Free Image → R2a/R3
```

**After OMSRIA:**
```
Original Photo → F0 → Furniture-Free Image → R1.5 (OMSRIA) → Before-Unfurnished Image → R2a/R3
```

OMSRIA adds a refinement layer on top of furniture-free images.

---

### 2. OMSRIA is Required - No Fallback

All components MUST use OMSRIA output exclusively:
```typescript
// Fetch OMSRIA images (REQUIRED)
const { data: omsriaImages, error: omsriaError } = await supabase
  .from('omsria_processed_images')
  .select('room_id, image_url')
  .eq('listing_id', listingId)
  .eq('is_redundant', false);

if (omsriaError || !omsriaImages || omsriaImages.length === 0) {
  throw new Error(`OMSRIA output not found. Run R1.5 (OMSRIA) first.`);
}

const imageUrl = omsriaImageMap.get(roomId);
if (!imageUrl) {
  throw new Error(`OMSRIA image not found for room ${roomId}. Run R1.5 (OMSRIA) first.`);
}
```

This ensures:
- ✅ All listings use OMSRIA images (consistent quality)
- ✅ Pipeline fails clearly if OMSRIA hasn't run (prevents silent errors)
- ✅ OMSRIA is enforced as mandatory evolution step

---

### 3. Storage Implications

**New Storage Path:**
- `property-images/{listing_id}/before-unfurnished/` (OMSRIA output)

**Existing Storage Paths (Still Used):**
- `property-images/{listing_id}/furniture-free/` (F0 output)
- `property-images/{listing_id}/after/` (R3 output)

**Storage Impact:** Minimal - OMSRIA creates one image per room (same as R1 output)

---

## 📊 Component Dependency Graph

```
F0 (Furniture Removal)
  ↓
R1 (Select Best Image)
  ↓
R1.5 (OMSRIA) ← NEW STEP
  ├─ Input: Furniture-free images from F0
  ├─ Input: Selected images from R1
  └─ Output: Before-unfurnished images (space-isolated)
  ↓
R2a (Describe Images) ← UPDATED: REQUIRES OMSRIA output
  └─ OMSRIA images ONLY (no fallback)
  ↓
R2b-Master, R2b (Generate Prompts) ← No changes (uses R2a output)
  ↓
R3 (Render Rooms) ← UPDATED: REQUIRES OMSRIA output as "before"
  └─ OMSRIA images ONLY (no fallback)
  ↓
R4, R5, R6 ← No changes (uses R3 output)
```

---

## 🎯 Conclusion

**OMSRIA is a required evolution** - it becomes a mandatory step in the pipeline:

1. **Adds a new REQUIRED step** (R1.5) to the pipeline
2. **Enforces OMSRIA output** in R2a, R3, and Carousel (no fallback)
3. **Breaks backward compatibility** - old listings must run OMSRIA before proceeding
4. **Improves quality** by providing space-isolated before-unfurnished images

**This is a breaking change.** The pipeline now REQUIRES OMSRIA. Components will fail with clear error messages if OMSRIA hasn't run. This ensures all listings use the improved space-isolated images and prevents silent degradation to lower-quality furniture-free images.

---

**Last Updated:** 2025-01-27  
**Status:** Analysis Complete - Ready for Implementation

