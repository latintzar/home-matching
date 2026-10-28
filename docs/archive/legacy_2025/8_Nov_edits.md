# 8 November 2025 - Pipeline Refinements

## Overview
This document captures refinements to the renovation pipeline based on consistency issues, redundancy analysis, and furniture removal strategy.

## Key Issues Identified

### 1. Cross-Photo/Cross-Room Consistency Problems
- **Issue**: Pool appearing in photos where it shouldn't be visible (e.g., terrace photos showing pool instead of other terrace areas)
- **Root Cause**: E5 POV mapping may not be correctly identifying what's visible in each photo, or E5 data isn't being properly incorporated into prompts
- **Impact**: Generated after-images show incorrect elements, breaking spatial consistency

### 2. Redundancy Between T4-T5-T5.5 and Q2
- **Current State**:
  - T4: Decide Elements (element-level decisions)
  - T5: Cohesion (holistic notes)
  - T5.5: Apply Cohesion Corrections (corrects T4 based on T5)
  - Q2: After Layouts (material specifications) - **currently re-deciding things T4-T5.5 already decided**
- **Problem**: Q2 is making decisions that should have been made in T4-T5.5
- **Solution**: Q2 should translate T4/T5.5 decisions into material specs, not re-decide

### 3. T6 Output Clarification
- **Current State**: T6 (Budget Calibration) outputs `adjustments` array but doesn't produce a revised scope
- **Question**: What should T6 output?
  - Option A: Revised version of T5.5 output (applied adjustments)
  - Option B: Just adjustments (current state) - but then where are adjustments applied?
- **Recommendation**: T6 should output a **revised scope** (T5.5 scope with adjustments applied)

### 4. Q2 Purpose Clarification
- **Current Understanding**: Q2 generates tier-specific canonical layouts
- **Proposed Change**: Q2 should be about **per-photo prompts**, not layouts
- **Inputs**: 
  - T6 output (final revised scope)
  - E5 (per-photo POV mapping)
- **Output**: Per-photo prompts that reference what's visible in each photo
- **Purpose**: Translate scope into photo-specific prompts using E5 visibility data

## Furniture Removal Strategy

### Rationale
- Houses are rarely sold furnished
- Furniture obscures architectural elements (walls, floors, windows, structural openings)
- Cleaner analysis when furniture is removed first
- E5 POV mapping would be more accurate without furniture blocking views
- Style direction can guide furniture selection later (cohesive with renovation)

### F0: Furniture Removal Preprocessing Step

**New Endpoint**: `/api/listings/[id]/photos/remove-furniture`
- **Input**: Original listing photos (from `listing_photos` table)
- **Process**: 
  - Use nano banana or similar AI tool to remove furniture from each photo
  - Store furniture-free photos in separate location
- **Output**: Furniture-free photos stored in `property-images/{listing_id}/furniture-free/`
- **Storage**: New table `listing_photos_furniture_free` or add `furniture_free_url` column to `listing_photos`
- **Status**: Must run before E1/E2/E5 pipeline

### Updated Pipeline Flow
1. **F0: Furniture Removal** → Remove furniture from original photos
2. **Furniture-free photos** → Full analysis pipeline (E1, E2, E5, text analysis, etc.)
   - **E1**: Uses furniture-free photos (not original listing photos)
   - **E2**: Uses furniture-free photos for layout mapping
   - **E5**: Uses furniture-free photos for POV extraction (focuses on fixed elements only)
3. **Generate after images (furniture-free)** → Architectural changes only
4. **Add furniture back** → Using style direction from T2.5 to guide selection (separate step)

### Benefits
- Cleaner E1/E2 layouts (no furniture objects to map)
- More accurate E5 POV (clear view of fixed elements)
- Better analysis (focus on what actually needs renovation)
- Style-coherent furniture (T2.5 style direction informs furniture choices)

### Fixed Elements (After-Without-Furniture)
- Walls, floors, ceilings
- Windows, doors
- Built-ins, structural openings
- Staircases, railings
- Permanent fixtures, lighting mounts
- Exterior continuations: terraces, balconies, steps, patios, pools, planters, gardens, driveways, paths, boundary walls/fences

### Furniture Layer (After-With-Furniture)
- Added after architectural changes are complete
- Guided by T2.5 style direction
- Cohesive with renovation aesthetic

## T6 Budget Calibration Integration

### Current State
- T6 outputs `adjustments` array but doesn't apply them
- No step that creates revised scope from T6 adjustments

### Required Changes

#### 1. T6 Should Revise N's Output
- **Input**: N's final scope (work items, cost, time, permits) + Budget brackets (T1.5 or Customised)
- **Output**: Revised final scope (work items, cost, time, permits with budget adjustments)
- **Storage**: New table (e.g., `final_renovation_scope_calibrated`) or update `final_renovation_scope` with `is_calibrated` flag
- **UI**: T6's output goes directly to UI for display (work items, cost, time, permits)

#### 2. Budget Inputs to T6
- **Tier Budgeting (T1.5)**: Baseline budget brackets per tier
  - Must feed into T6
  - Provides target ranges for calibration
- **Customised Tier Budgeting** (if exists): Override Tier Budgeting
  - If exists, should override T1.5 output
  - Must feed into T6
  - Takes precedence over baseline budgeting

#### 3. T6 Flow
```
N (Finalize) → Final scope (work items, cost, time, permits)
↓
T1.5 Tier Budgeting → Baseline budget brackets
↓
Customised Tier Budgeting (if exists) → Override baseline
↓
T6 Budget Calibration → 
  - Input: N's final scope + Budget brackets (T1.5 or Customised)
  - Process: Revise work items, cost, time, permits to hit budget targets
  - Output: Revised final scope (work items, cost, time, permits with budget adjustments)
  - UI: T6's output goes directly to UI for display (work items, cost, time, permits)
```

#### 4. T6.5: Iterate T5.5 Based on T6 Scope Changes
- **Purpose**: Update T5.5's element-level decisions to reflect T6's scope changes
- **Input**: 
  - T6's revised scope (work items with budget adjustments)
  - T5.5's element decisions (from `e2_tier_target_states`)
- **Process**: 
  - Compare T6's revised scope to original scope
  - Update element decisions based on scope changes:
    - If work item removed → element decision might need to change (e.g., remove → keep)
    - If work item added → new element decision needed
    - If work item modified → element decision might need update
- **Output**: Updated element decisions (update `e2_tier_target_states`)
- **Storage**: Update `e2_tier_target_states` table with iterated decisions

## Q2 Refactoring

### Current Q2: After Layouts
- Generates tier-specific canonical layouts
- Uses T4 tier target states + T5 cohesion notes
- Outputs material specifications

### Proposed Q2: Per-Photo Prompt Synthesis
- **Purpose**: Generate per-photo prompts for after-image generation
- **Inputs**:
  - T6.5 output (iterated T5.5 element decisions - updated based on T6 scope changes)
  - E5 (per-photo POV mapping - what's visible, what's not)
- **Output**: Per-photo prompts that:
  - Reference what's visible in each photo (from E5)
  - Include element-level decisions relevant to that photo (from T6.5)
  - Maintain cross-photo consistency via text constraints
  - Use T2.5 style direction for aesthetic guidance

### Q2 Flow
```
T6 Revised Scope → Final work items per tier (goes to UI)
↓
T6.5 Iterate T5.5 → Updated element decisions based on T6 scope changes
↓
E5 POV Mapping → Per-photo visibility data
↓
Q2 Per-Photo Prompts → 
  - For each photo/tier combination
  - Prompt includes: visible elements (E5), element decisions (T6.5), style direction (T2.5)
  - Ensures consistency via text constraints
```

## E5 POV Mapping Improvements

### Current Issues
- Pool appearing where it shouldn't be visible
- Inconsistent cross-photo elements
- E5 may not be correctly mapping what's visible in each photo

### Required Improvements
1. **Better Visibility Detection**: E5 should accurately identify what's visible vs. not visible in each photo
2. **Layout Integration**: E5 should map each photo's POV back to the main room layout (E2)
3. **Prompt Integration**: E5 visibility data must be incorporated into Q2/Q3 prompts
4. **Furniture Removal**: Removing furniture first will make E5 more accurate

### E5 Output Structure
```json
{
  "photo_url": "...",
  "room_id": "...",
  "visible_elements": [
    {
      "element_type": "wall|floor|window|door|structural|exterior",
      "element_id": "ref to E2 layout",
      "visibility": "fully_visible|partially_visible|not_visible"
    }
  ],
  "adjacent_rooms": ["room_id1", "room_id2"],
  "camera_perspective": {
    "angle": "front|side|corner|overhead",
    "height": "eye_level|high|low",
    "focal_point": "center|left|right"
  }
}
```

## What Else Uses Original Listing Photos?

### Analysis Pipeline (Should Use Furniture-Free)
- ✅ **E1** (Room Analysis) - Uses furniture-free
- ✅ **E2** (Layout Mapping) - Uses furniture-free
- ✅ **E5** (POV Extraction) - Uses furniture-free

### After-Image Generation (Should Use Furniture-Free)
- ✅ **Q4** (After-Image Render) - Should use furniture-free photos as "before" images
  - Currently uses original photos as input
  - Should change to furniture-free photos

### Style Direction (Keep Original - Style Visible in Furniture)
- ⚠️ **T2.5** (Tier Style Direction) - Keep original photos
  - Style is visible in furniture, so original photos are better for style assessment
  - Furniture-free photos might lose style context

### Clustering (Should Use Furniture-Free)
- ⚠️ **Clustering** - Should use furniture-free photos
  - Clustering by room is easier without furniture distractions
  - But clustering might need original photos for initial setup?

### UI Display (Keep Original)
- ✅ **Photo Display Endpoints** - Keep original photos
  - UI should show original photos to users
  - Furniture-free photos are internal pipeline only

### Text Analysis (Keep Original - Display Only)
- ✅ **Text Analysis Results** - Keep original photos
  - Just for display/context, not analysis

## Implementation Priority

### Phase 1: Critical Fixes (Before Furniture-Free)
**Do these first to test what works before major changes:**

1. ✅ **T6 Integration with T1.5**
   - Update T6 to fetch T1.5 budget brackets
   - Update T6 to fetch Customised Tier Budgeting (if exists)
   - T6 revises N's output (work items, cost, time, permits)
   - T6 output goes to UI

2. ✅ **T6.5 New Step**
   - Create `/api/listings/[id]/tiers/iterate-element-decisions`
   - Takes T6 revised scope + T5.5 element decisions
   - Updates element decisions based on scope changes
   - Updates `e2_tier_target_states` table

3. ✅ **Q2 Refactoring**
   - Update Q2 to use T6.5 (iterated element decisions) + E5
   - Remove material decision-making (comes from T6.5)
   - Generate per-photo prompts only
   - Replaces old Q2 (After Layouts) and old Q3 (Per-Photo Prompts)

4. ✅ **Remove Old Endpoints** - **COMPLETED**
   - ~~Deprecate/remove `/api/listings/[id]/after/layouts` (old Q2)~~ - **REMOVED**
   - ~~Update `/api/listings/[id]/after/prompts` (old Q3) with new Q2 implementation~~ - **REMOVED** (replaced by R2a + R2b)

### Phase 2: Consistency Improvements
1. E5 POV mapping improvements
2. E5 integration into Q2 prompts
3. Cross-photo consistency validation

### Phase 3: Simplified Room-Based After-Image Pipeline (Furniture Removal)

**New Approach**: Room-based generation instead of per-photo. One image per room, with consistency passes.

**Key Architecture Principles**:
- **E2 (Improved)**: Allocentric visual descriptions - detailed materials, textures, boundaries (NOT generic)
- **T6.5**: Evolution of E2 with renovation decisions - detailed natural language descriptions
- **R2a**: Egocentric camera-centric descriptions - references E2, describes occlusion and which sides visible
- **R2b**: Super detailed renovation prompts - whole paragraphs per element from T6.5

#### Prerequisites: E2 Improvement
- **E2 (Unified Home Layout)**: Must be enhanced to include:
  - **Detailed visual descriptions** (NOT generic):
    - Materials and textures: "rough white stucco walls with visible texture", "polished cream marble floor with subtle veining"
    - Visual appearance of boundaries: "arched doorway with white painted wooden frame, approximately 2 meters wide"
    - Boundary between rooms: "Terrace connects to Dining Area through a wide arched opening with white stucco archway, revealing polished marble floor continuing into dining space"
  - **Relative relationships**: "left wall", "center of room", "adjacent to window"
  - **Approximate sizes**: "approximately 3 meters wide", "covers most of the wall"
  - **Room connections**: Visual description of how rooms meet, what you see at the boundary
  - **Structured sections with detailed natural language** (not just structured data)

#### Prerequisites: T6.5 Evolution
- **T6.5 (Iterate Element Decisions)**: Builds on improved E2 with:
  - Incorporates T4/T5 element decisions (with T5 corrections)
  - **Very detailed natural language descriptions** within structured sections covering:
    - **Placements**: Where elements are positioned (relative to room, other elements)
    - **Materials**: Specific materials for each element
    - **Sizes**: Approximate dimensions and scale
    - **Colors**: Color palette and finishes
    - **Structure**: Structural relationships and connections
    - **Connections**: How elements connect to other rooms/elements
    - **Occlusion**: What's visible vs. hidden
  - **Master Reference Specifications** (for backgroundless reference image generation):
    - **Discrete Objects** (fence, door, window, fixture): Full specification sufficient for standalone reference image
      - Material, color (with codes), finish, texture, structural details, scale reference
      - Example: "Dark green (RAL 6005), powder-coated, heavy-gauge steel, rigid welded mesh fence with small rectangular openings and a 3D profile"
    - **Architectural Surfaces** (walls, floors, ceilings): Sample section specifications
      - Material texture/pattern description, color, finish, scale reference
      - For floors: "2x2 meter sample showing full pattern repeat, polished cream marble with subtle veining, tile size and grout details"
      - For walls: "1x1 meter sample section, rough white stucco texture, visible texture depth, finish details"
      - Pattern repeat information, tile/panel dimensions, grout/joint details
  - Structured by room, then by element, with detailed descriptions

#### Step 1: Furniture Removal
- **F0: Furniture Removal Preprocessing**
   - **Endpoint**: `/api/listings/[id]/photos/remove-furniture`
   - **Input**: Original listing photos (from `listing_photos` table)
  - **Process**: Remove furniture using AI tool (nano banana or similar)
   - **Output**: Furniture-free photos stored in separate storage path
   - **Storage**: 
     - Path: `property-images/{listing_id}/furniture-free/`
     - Table: New `listing_photos_furniture_free` table OR add `furniture_free_url` column to `listing_photos`

#### Step 2: Select Best Image Per Room (R1)
- **Process**: For each room with multiple photos, select the most wide-angle image
  - **Room-by-room call**: Process rooms individually (only for rooms with >1 photo)
  - Criteria: Best perspective, placement, camera angle, coverage of room
  - Analyze photos to identify best candidate (wide-angle, good coverage, clear view of room boundaries)
- **Input**: All photos per room (furniture-free)
- **Output**: One "master" image per room (furniture-free)
- **Note**: T6.5 already provides the renovation element list (per room, per tier)

#### Step 3a: Describe Selected Images (R2a)
- **Process**: Analyze all selected wide-angle images together (egocentric/camera-centric description)
  - **References E2 elements** but describes from camera's perspective
  - **How E2 elements are arranged from camera's POV**: "Left wall (from E2: rough white stucco) occupies left third of frame"
  - **What delineates boundary to another room**: "Arched doorway (from E2: white painted frame) visible on right wall, opening reveals Dining Area"
  - **Which parts of adjacent rooms are visible**: "Through the archway, approximately 2 meters of Dining Area floor visible, with white table legs in frame"
  - **Which parts are off-camera**: "Right wall extends beyond frame", "Ceiling not visible in this angle"
  - **Occlusion details**: 
    - "Dining table partially occludes view of floor behind it"
    - "Left wall's front face visible, but right edge occluded by corner column"
    - "Kitchen counter occludes lower portion of kitchen wall, but upper cabinets fully visible"
  - **Which sides of elements are visible**:
    - "Left wall (from E2: rough white stucco) - front face fully visible, right edge partially visible at corner, back face not visible"
    - "Dining table (from E2: white wooden table) - top surface fully visible, front legs fully visible, back legs partially visible (occluded by tabletop), left side not visible, right side edge visible"
    - "Floor (from E2: polished cream marble) - top surface visible from foreground to middle distance, front edge visible at camera position, back edge occluded by furniture"
- **Input**: All rooms' selected wide-angle images (furniture-free) - single batch call
- **Output**: Detailed egocentric descriptions per room covering perspective, structure, connections, occlusion, which sides visible, what's visible/occluded/off-camera

#### Step 3b: Generate Master Reference Images (R2b-Master)
- **Process**: Generate backgroundless master reference images for each element from T6.5
  - **Input**: T6.5 renovation element list (per room, per tier) with master reference specifications
  - **For discrete objects** (fence, door, window, fixture): Generate standalone backgroundless reference image
    - Uses full T6.5 specification: material, color codes, finish, texture, structural details
    - Example: "Dark green (RAL 6005), powder-coated, heavy-gauge steel, rigid welded mesh fence with small rectangular openings and a 3D profile"
  - **For architectural surfaces** (walls, floors, ceilings): Generate sample section reference images
    - Floor: "2x2 meter sample showing full pattern repeat, polished cream marble with subtle veining, tile size and grout details"
    - Wall: "1x1 meter sample section, rough white stucco texture, visible texture depth, finish details"
  - **Output**: Master reference images stored with standardized filenames
    - Format: `{element_id}_{tier}_master_reference.png` (e.g., `pool_fence_estandar_master_reference.png`, `floor_kitchen_optimo_master_reference.png`)
  - **Storage**: `master_reference_images` table or storage path: `property-images/{listing_id}/master-references/`
  - **Purpose**: Ensures visual consistency - same element looks identical across all generated images

#### Step 3c: Generate Detailed Renovation Prompts (R2b)
- **Process**: Generate super detailed renovation prompts for all rooms
  - **Combines R2a (egocentric camera view) + T6.5 (renovation element list) + R2b-Master (master reference images)**
  - **Super detailed prompts**: Each element from T6.5 gets a **whole paragraph** describing how to edit the image
  - **Egocentric perspective**: Prompts reference camera view from R2a, describing how to apply renovations from this specific angle
  - **Master reference image references**: Prompts call out master reference image filenames for consistency
    - Example: "Replace the rough white stucco (currently visible on left wall, front face) with the material shown in `wall_living_room_estandar_master_reference.png`, maintaining the same texture depth but with a refined finish..."
    - Example: "Install the pool fence as specified in `pool_fence_estandar_master_reference.png` along the pool's edge, ensuring the rendered fence matches the reference exactly in material, color, and structural details..."
  - **Per-element detailed paragraphs** covering:
    - **Placements**: Specific positions for changes (referencing camera view from R2a)
      - "The left wall (currently visible in left third of frame, front face fully visible) should be updated to..."
    - **Materials**: Exact materials to use (from T6.5)
      - "Replace the rough white stucco (currently visible on left wall, front face) with smooth matte white paint, maintaining the same texture depth but with a refined finish..."
    - **Sizes**: Dimensions for new/renovated elements (referencing what's visible from camera)
      - "The arched doorway (currently visible on right wall, left side of arch fully visible, right side partially visible) should maintain its 2-meter width but..."
    - **Colors**: Specific colors and finishes (from T6.5)
      - "The polished cream marble floor (currently visible from foreground to middle distance, top surface visible, back edge occluded by furniture) should be replaced with..."
    - **Structure**: Structural changes and connections (referencing camera view)
      - "The connection to Dining Area (currently visible through arched doorway, approximately 2 meters of Dining Area floor visible) should be enhanced by..."
    - **Connections**: How renovated elements connect (referencing what's visible)
      - "The boundary between rooms (currently delineated by arched opening showing Dining Area) should be updated to..."
    - **Occlusion**: What should be visible/hidden after renovation (referencing current occlusion state)
      - "After renovation, the floor behind the dining table (currently occluded) should be visible, so ensure the new flooring extends fully..."
- **Input**: 
  - R2a descriptions (egocentric camera view per room)
  - T6.5 renovation element list (per room, per tier)
  - R2b-Master master reference images (filenames and paths)
- **Output**: Super detailed renovation prompt per room - whole paragraphs per element, referencing camera perspective and master reference image filenames

#### Step 4: Generate After-Images (Without Furniture) (R3)
- **Process**: Generate one after-image per room using the detailed prompt and master reference images
- **Input**: 
  - Furniture-free "before" image
  - Detailed renovation prompt (from R2b) with master reference image references
  - Master reference images (provided as visual context to image generation model)
- **Process**: Image generation model uses both:
  - Text prompt (from R2b) describing what to change and how
  - Master reference images (visual references) to ensure consistent look
- **Output**: One renovated image per room (architectural changes only, no furniture)
- **Storage**: `after_photos` table with `has_furniture: false` flag
- **Consistency**: Master reference images ensure same elements look identical across all rooms

#### Step 5: Cross-Room Consistency Pass (Without Furniture)
- **Process**: 
  1. **Identify Overlapping Rooms**: Find rooms that are visible in each other's images
  2. **Describe Overlaps**: Use Gemini Pro to describe overlapping areas between adjacent rooms
  3. **Generate Edit Prompts**: For each overlap, generate a new prompt to edit one of the photos
  4. **Decide Edit Order**: Determine which room's image to edit first (based on visibility, importance, etc.)
  5. **Execute Edits in Order**: Make edits sequentially, using previous edits as context
- **Input**: All room after-images (without furniture)
- **Output**: Consistency-corrected after-images (without furniture)
- **Note**: This ensures adjacent rooms match at boundaries (doorways, arches, etc.)

#### Step 6a: Generate Furniture Decisions & Master Reference Images (R5-Master)
- **Process**: Generate furniture decisions and backgroundless master reference images for furniture pieces
  - **Input**: 
    - T6.5 renovation element list (for room function and scope context)
    - T2.5 style direction (aesthetic guidance for furniture selection)
    - Tier budget constraints (furniture must be within budget for tier)
    - Renovation scope (to check if furniture is included in scope and costs)
  - **Furniture Decision Generation** (similar to T6.5 for architectural elements):
    - For each room, determine furniture pieces needed based on:
      - Room function (bedroom → bed, nightstands, wardrobe; kitchen → dining table, chairs, etc.)
      - T2.5 style direction (Mediterranean → warm tones, ornate details; Contemporary → clean lines, minimal)
      - Tier budget (Estándar → basic furniture; Óptimo → mid-range; Plus → premium)
    - Generate detailed furniture specifications (like T6.5 master reference specs):
      - Material, color, finish, texture, structural details, scale reference
      - Example: "Modern dining table, oak wood, light finish, clean lines, 6-person capacity, 180cm x 90cm"
      - Example: "Contemporary sofa, beige linen fabric, low profile, 3-seater, 220cm width, tapered legs"
    - **Furniture costs**: Include furniture costs in renovation scope/costs (if not already included)
      - Furniture decisions should respect tier budget constraints
      - Costs should be tracked per furniture piece and included in tier total costs
  - **Master Reference Image Generation**:
    - Generate standalone backgroundless reference images for each furniture piece
    - Uses furniture specifications from decisions above
    - Example: "Modern dining table, oak wood, light finish, clean lines, 6-person capacity" → `dining_table_kitchen_optimo_master_reference.png`
    - Example: "Contemporary sofa, beige linen fabric, low profile, 3-seater" → `sofa_living_room_estandar_master_reference.png`
  - **Output**: 
    - Furniture decisions (stored in `furniture_decisions` table or similar, structured like T6.5)
    - Master reference images stored with standardized filenames
    - Format: `{furniture_type}_{room_id}_{tier}_master_reference.png` (e.g., `dining_table_kitchen_optimo_master_reference.png`, `sofa_living_room_estandar_master_reference.png`)
  - **Storage**: 
    - Furniture decisions: `furniture_decisions` table (or extend T6.5 to include furniture)
    - Master reference images: `master_reference_images` table or storage path: `property-images/{listing_id}/master-references/furniture/`
  - **Purpose**: 
    - Ensures visual consistency - same furniture pieces look identical across all generated images
    - Ensures furniture costs are tracked and included in tier budgets

#### Step 6b: Add Furniture Layer (R5)
- **Process**: For each room's consistency-corrected after-image:
  - Generate prompt to add furniture based on master reference images
  - **Input**: 
    - Consistency-corrected after-images (without furniture)
    - R5-Master furniture master reference images (filenames and paths)
    - T6.5 renovation element list (for room context)
    - T2.5 style direction (aesthetic guidance)
    - Tier budget constraints
  - **Furniture prompt generation**:
    - References master reference image filenames for each furniture piece
    - Example: "Add a dining table matching the style and appearance shown in `dining_table_kitchen_optimo_master_reference.png`, positioned in the center of the dining area..."
    - Example: "Place a sofa matching `sofa_living_room_estandar_master_reference.png` against the left wall, ensuring it matches the reference exactly in material, color, and design..."
    - Describes placement, positioning, and integration with renovated space
  - **Process**: Image generation model uses both:
    - Text prompt describing furniture placement and integration
    - Master reference images (visual references) to ensure consistent furniture appearance
- **Output**: After-images with furniture added
- **Storage**: `after_photos` table with `has_furniture: true` flag
- **Consistency**: Master reference images ensure same furniture pieces look identical across all rooms

#### Step 7: Cross-Room Consistency Pass (With Furniture)
- **Process**: Same as Step 6, but applied to furniture-added images
  - Identify overlapping rooms
  - Describe overlaps with Gemini Pro
  - Generate edit prompts
  - Decide edit order
  - Execute edits sequentially
- **Input**: All room after-images (with furniture)
- **Output**: Final consistency-corrected after-images (with furniture)

#### Key Differences from Old Approach
- ❌ **No Modular Masters**: Removed modular master image concept
- ✅ **Room-Based**: One image per room instead of per-photo
- ✅ **Simplified**: Focus on best image per room, not all photos
- ✅ **Two Consistency Passes**: One without furniture, one with furniture
- ✅ **Sequential Editing**: Consistency edits happen in determined order

#### Endpoints
- **F0**: `/api/listings/[id]/photos/remove-furniture` (Furniture Removal)
- **R1**: `/api/listings/[id]/after/select-room-images` (Select best image per room - room-by-room for rooms with >1 photo)
- **R2a**: `/api/listings/[id]/after/describe-room-images` (Describe all selected wide-angle images - single batch call)
- **R2b-Master**: `/api/listings/[id]/after/generate-master-references` (Generate master reference images from T6.5 - backgroundless images for discrete objects, sample sections for surfaces)
- **R2b**: `/api/listings/[id]/after/generate-room-prompts` (Generate detailed renovation prompts - single batch call with T6.5 element list + master reference image filenames)
- **R3**: `/api/listings/[id]/after/render-rooms` (Generate one after-image per room using prompts + master reference images)
- **R4**: `/api/listings/[id]/after/consistency-pass` (Cross-room consistency correction - without furniture)
- **R5-Master**: `/api/listings/[id]/after/generate-furniture-master-references` (Generate furniture decisions + master reference images - backgroundless images for furniture pieces, includes furniture costs)
- **R5**: `/api/listings/[id]/after/add-furniture` (Add furniture layer using prompts + furniture master reference images)
- **R6**: `/api/listings/[id]/after/consistency-pass-furniture` (Final consistency pass with furniture)

## Technical Implementation Details

### Data Flow & Dependencies

Each step explicitly documents where it gets its inputs:

#### F0: Furniture Removal
- **Input Source**: `listing_photos` table (original photos)
- **Output Storage**: `listing_photos_furniture_free` table OR `listing_photos.furniture_free_url` column
- **Storage Path**: `property-images/{listing_id}/furniture-free/`

#### R1: Select Best Image Per Room
- **Input Source**: `listing_photos_furniture_free` table (furniture-free photos per room from `manual_photo_clusters`)
- **Output Storage**: Selection stored in `manual_photo_clusters.selected_photo_url` or new `selected_room_images` table
- **Dependencies**: Requires F0 to be completed

#### R2a: Describe Selected Images
- **Input Source**: 
  - Selected images from R1 (furniture-free)
  - `room_analyses.unified_home_layout_json` (E2 layout) - for referencing E2 elements
- **Output Storage**: New `room_image_descriptions` table or `room_analyses.egocentric_descriptions` JSONB field
- **Dependencies**: Requires R1 and E2 to be completed

#### R2b-Master: Generate Master Reference Images
- **Input Source**: 
  - `e2_tier_target_states.target_state` (T6.5 element decisions with master reference specs)
- **Output Storage**: 
  - `master_reference_images` table (new table needed)
  - Storage path: `property-images/{listing_id}/master-references/`
- **Dependencies**: Requires T6.5 to be completed

#### R2b: Generate Detailed Renovation Prompts
- **Input Source**:
  - R2a descriptions from `room_image_descriptions` table
  - T6.5 from `e2_tier_target_states.target_state`
  - R2b-Master from `master_reference_images` table (filenames/paths)
- **Output Storage**: New `renovation_prompts` table or `room_analyses.renovation_prompts` JSONB field
- **Dependencies**: Requires R2a, T6.5, and R2b-Master to be completed

#### R3: Generate After-Images (Without Furniture)
- **Input Source**:
  - Furniture-free "before" images from R1
  - Prompts from R2b (`renovation_prompts` table)
  - Master reference images from R2b-Master (`master_reference_images` table)
- **Output Storage**: `after_photos` table with `has_furniture: false` flag
- **Dependencies**: Requires R1, R2b, and R2b-Master to be completed

#### R4: Cross-Room Consistency Pass (Without Furniture)
- **Input Source**: `after_photos` table where `has_furniture: false`
- **Output Storage**: Updates `after_photos` table (same records, updated images)
- **Dependencies**: Requires R3 to be completed

#### R5-Master: Generate Furniture Decisions & Master Reference Images
- **Input Source**:
  - `e2_tier_target_states.target_state` (T6.5 for room context)
  - `style_direction.direction_data.tiers[tier]` (T2.5 style direction)
  - `final_renovation_scope_calibrated.scope_data.tiers[tier]` (tier budget constraints)
- **Output Storage**:
  - `furniture_decisions` table (new table needed, structured like T6.5)
  - `master_reference_images` table (furniture category)
  - Storage path: `property-images/{listing_id}/master-references/furniture/`
- **Dependencies**: Requires T6.5, T2.5, and T6 (budget calibration) to be completed

#### R5: Add Furniture Layer
- **Input Source**:
  - `after_photos` table where `has_furniture: false` (from R4)
  - `furniture_decisions` table (from R5-Master)
  - `master_reference_images` table where category='furniture' (from R5-Master)
- **Output Storage**: `after_photos` table with `has_furniture: true` flag (new records or update existing)
- **Dependencies**: Requires R4 and R5-Master to be completed

#### R6: Cross-Room Consistency Pass (With Furniture)
- **Input Source**: `after_photos` table where `has_furniture: true`
- **Output Storage**: Updates `after_photos` table (same records, updated images)
- **Dependencies**: Requires R5 to be completed

### Model Configurations

#### R2a: Describe Selected Images
- **Model**: `gemini-2.5-pro` (needs detailed analysis of multiple images) - matches R2b `generate-room-prompts` pattern for batch processing
- **Temperature**: `0.2` (factual, precise descriptions) - matches R2b `generate-room-prompts` and `tiers/iterate-element-decisions` pattern
- **maxOutputTokens**: `65536` (large batch of rooms, detailed descriptions) - matches R2b `generate-room-prompts` which processes all rooms at once
- **Structured Output**: Required
  - Response schema for egocentric descriptions per room
  - Fields: room_id, camera_perspective, visible_elements, occlusion_details, visible_sides, boundaries

#### R2b-Master: Generate Master Reference Images
- **Model**: `gemini-2.5-flash-image` (image generation)
- **Temperature**: `0.1` (precise material/color matching) - matches R3 `render-rooms` pattern
- **maxOutputTokens**: `32768` (per image generation) - matches R3 `render-rooms` and R4/R6 consistency pass pattern
- **Structured Output**: Not needed (image generation, not text)

#### R2b: Generate Detailed Renovation Prompts
- **Model**: `gemini-2.5-pro` (complex synthesis of multiple inputs)
- **Temperature**: `0.2` (detailed, precise prompts)
- **maxOutputTokens**: `65536` (whole paragraphs per element, multiple rooms)
- **Structured Output**: Required
  - Response schema for prompts per room
  - Fields: room_id, prompt_text (detailed paragraphs per element)

#### R3: Generate After-Images (Without Furniture)
- **Model**: `gemini-2.5-flash-image` (image generation)
- **Temperature**: `0.1` (precise architectural changes)
- **maxOutputTokens**: `32768` (image generation with text prompt)
- **Structured Output**: Not needed (image generation)

#### R4: Cross-Room Consistency Pass
- **Model**: `gemini-2.5-pro` (analysis and prompt generation)
- **Temperature**: `0.1` (factual consistency analysis)
- **maxOutputTokens**: `32768` (per consistency pass)
- **Structured Output**: Required
  - Response schema for consistency edits
  - Fields: overlapping_rooms, edit_prompts, edit_order

#### R5-Master: Generate Furniture Decisions & Master Reference Images
- **Model**: 
  - Decisions: `gemini-2.5-pro` (furniture decision generation)
  - Images: `gemini-2.5-flash-image` (image generation)
- **Temperature**: 
  - Decisions: `0.3` (style-appropriate furniture selection)
  - Images: `0.1` (precise furniture appearance)
- **maxOutputTokens**: 
  - Decisions: `32768` (detailed furniture specs per room)
  - Images: `8192` (per furniture piece)
- **Structured Output**: Required for decisions
  - Response schema for furniture decisions per room
  - Fields: room_id, furniture_pieces (array with material, color, finish, size, cost)

#### R5: Add Furniture Layer
- **Model**: `gemini-2.5-flash-image` (image generation)
- **Temperature**: `0.1` (precise furniture placement)
- **maxOutputTokens**: `32768` (image generation with text prompt)
- **Structured Output**: Not needed (image generation)

#### R6: Cross-Room Consistency Pass (With Furniture)
- **Model**: `gemini-2.5-pro` (analysis and prompt generation)
- **Temperature**: `0.1` (factual consistency analysis)
- **maxOutputTokens**: `32768` (per consistency pass)
- **Structured Output**: Required (same as R4)

### Database Schema & RLS

#### New Tables Needed

1. **`master_reference_images`**
   ```sql
   CREATE TABLE master_reference_images (
     id BIGSERIAL PRIMARY KEY,
     listing_id BIGINT NOT NULL REFERENCES listings(id),
     tier TEXT NOT NULL CHECK (tier IN ('estandar', 'optimo', 'plus')),
     element_id TEXT NOT NULL,
     element_type TEXT NOT NULL CHECK (element_type IN ('architectural', 'furniture')),
     room_id TEXT,
     filename TEXT NOT NULL,
     storage_path TEXT NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE(listing_id, tier, element_id, element_type)
   );
   
   ALTER TABLE master_reference_images ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "master_reference_images_public_read" ON master_reference_images
     FOR SELECT USING (true);
   CREATE POLICY "master_reference_images_service_write" ON master_reference_images
     FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
   ```

2. **`furniture_decisions`**
   ```sql
   CREATE TABLE furniture_decisions (
     id BIGSERIAL PRIMARY KEY,
     listing_id BIGINT NOT NULL REFERENCES listings(id),
     tier TEXT NOT NULL CHECK (tier IN ('estandar', 'optimo', 'plus')),
     room_id TEXT NOT NULL,
     furniture_data JSONB NOT NULL, -- Structured like T6.5: furniture pieces with specs, costs
     created_at TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE(listing_id, tier, room_id)
   );
   
   ALTER TABLE furniture_decisions ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "furniture_decisions_public_read" ON furniture_decisions
     FOR SELECT USING (true);
   CREATE POLICY "furniture_decisions_service_write" ON furniture_decisions
     FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
   ```

3. **`listing_photos_furniture_free`** (if not using column on existing table)
   ```sql
   CREATE TABLE listing_photos_furniture_free (
     id BIGSERIAL PRIMARY KEY,
     listing_id BIGINT NOT NULL REFERENCES listings(id),
     original_photo_url TEXT NOT NULL,
     furniture_free_url TEXT NOT NULL,
     storage_path TEXT NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE(listing_id, original_photo_url)
   );
   
   ALTER TABLE listing_photos_furniture_free ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "furniture_free_photos_public_read" ON listing_photos_furniture_free
     FOR SELECT USING (true);
   CREATE POLICY "furniture_free_photos_service_write" ON listing_photos_furniture_free
     FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
   ```

4. **`room_image_descriptions`** (if not using JSONB field)
   ```sql
   CREATE TABLE room_image_descriptions (
     id BIGSERIAL PRIMARY KEY,
     listing_id BIGINT NOT NULL REFERENCES listings(id),
     room_id TEXT NOT NULL,
     description_data JSONB NOT NULL, -- Egocentric descriptions from R2a
     created_at TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE(listing_id, room_id)
   );
   
   ALTER TABLE room_image_descriptions ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "room_image_descriptions_public_read" ON room_image_descriptions
     FOR SELECT USING (true);
   CREATE POLICY "room_image_descriptions_service_write" ON room_image_descriptions
     FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
   ```

5. **`renovation_prompts`** (if not using JSONB field)
   ```sql
   CREATE TABLE renovation_prompts (
     id BIGSERIAL PRIMARY KEY,
     listing_id BIGINT NOT NULL REFERENCES listings(id),
     tier TEXT NOT NULL CHECK (tier IN ('estandar', 'optimo', 'plus')),
     room_id TEXT NOT NULL,
     prompt_text TEXT NOT NULL, -- Detailed renovation prompt from R2b
     created_at TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE(listing_id, tier, room_id)
   );
   
   ALTER TABLE renovation_prompts ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "renovation_prompts_public_read" ON renovation_prompts
     FOR SELECT USING (true);
   CREATE POLICY "renovation_prompts_service_write" ON renovation_prompts
     FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
   ```

#### Existing Table Updates

1. **`after_photos`** - Already has RLS, but needs `has_furniture` column:
   ```sql
   ALTER TABLE after_photos 
   ADD COLUMN IF NOT EXISTS has_furniture BOOLEAN DEFAULT false;
   CREATE INDEX IF NOT EXISTS idx_after_photos_has_furniture 
     ON after_photos(listing_id, tier, has_furniture);
   ```

## Notes

- **Gemini Flash Image**: Need to understand how Gemini Flash Image works to properly address consistency issues
- **Text-Coordinated Consistency**: Current strategy uses detailed text prompts rather than visual cascading - this should be maintained
- **Redundancy Elimination**: T4-T5.5 should make all decisions; Q2 should only translate to prompts, not re-decide
- **Structured Outputs**: All text-generation endpoints MUST use structured output (responseSchema + responseMimeType) for reliability
- **RLS Policies**: All new tables follow the same pattern: public read, service_role write

## Complete Flow Summary

```
F0: Furniture Removal → Remove furniture from original photos
↓
Furniture-Free Photos → Used by E pipeline
↓
E1/E2/E5 → Use furniture-free photos (not original listing photos)
↓
... (rest of pipeline: T1-T6, I-N, etc.)
↓
T1.5 Tier Budgeting → Baseline budget brackets
↓
Customised Tier Budgeting (if exists) → Override baseline
↓
N (Finalize) → Final scope (work items, cost, time, permits)
↓
T6 Budget Calibration → Revises N's output to hit budget targets
  ├─→ UI (for display: work items, cost, time, permits)
  └─→ T6.5 Iterate T5.5
        ↓
        T5.5 Element Decisions (updated based on T6 scope changes)
        ↓
        E5 POV Mapping (uses furniture-free photos)
        ↓
        Q2 Per-Photo Prompts (uses T6.5 + E5)
        ↓
        Q4 After-Image Render (furniture-free architectural changes)
        ↓
        Q5 Add Furniture (optional, using T2.5 style direction)
```

## Removed Endpoints

### Removed Endpoints (Phase 3 Replaces Entire Q Pipeline)

#### Old Q Pipeline (REMOVED - Replaced by Phase 3 R Pipeline)
- ❌ **Old Q1**: `/api/listings/[id]/style-direction` - **REMOVED** (replaced by T2.5 tier-specific style direction)
- ❌ **Old Q2**: `/api/listings/[id]/after/layouts` - **REMOVED** (material specs come from T6.5 element decisions)
- ❌ **Old Q2**: `/api/listings/[id]/renovation-style-prompts` - **REMOVED** (replaced by R2b generate-room-prompts)
- ❌ **Old Q3**: `/api/listings/[id]/after/prompts` - **REMOVED** (replaced by R2a + R2b)
- ❌ **Old Q4**: `/api/listings/[id]/after/render` - **REMOVED** (replaced by R3 render-rooms)
- ❌ **Old Q Orchestration**: `/api/listings/[id]/after/generate-all` - **REMOVED** (Q pipeline removed)
- ❌ **Old Q5**: `/api/listings/[id]/after/add-furniture` (old implementation) - **REMOVED** (replaced by R5 with new implementation)
- ❌ **Old Cross-Room Consistency**: `/api/listings/[id]/after/cross-room-consistency` - **REMOVED** (replaced by R4 + R6)
- ❌ **Old Anchor/Angle-Match**: `/api/listings/[id]/rooms/[roomId]/after/anchor` and `/api/listings/[id]/rooms/[roomId]/after/angle-match` - **REMOVED** (replaced by R3)
- ❌ **E5**: `/api/listings/[id]/photos/pov/describe` - **REMOVED** (replaced by R2a describe-room-images)
- ❌ **Legacy Image Generation**: `/api/listings/[id]/image-gen/rooms` - **REMOVED** (depended on removed renovation-style-prompts)

### New Endpoints (Phase 3 R Pipeline)

#### Furniture Removal
- ✅ **F0**: `/api/listings/[id]/photos/remove-furniture` (Furniture Removal)

#### Room Selection & Description
- ✅ **R1**: `/api/listings/[id]/after/select-room-images` (Select best image per room)
- ✅ **R2a**: `/api/listings/[id]/after/describe-room-images` (Describe all selected wide-angle images - egocentric)

#### Master Reference Generation
- ✅ **R2b-Master**: `/api/listings/[id]/after/generate-master-references` (Generate architectural master reference images)
- ✅ **R5-Master**: `/api/listings/[id]/after/generate-furniture-master-references` (Generate furniture decisions + master reference images)

#### Prompt Generation
- ✅ **R2b**: `/api/listings/[id]/after/generate-room-prompts` (Generate detailed renovation prompts - replaces old Q3)

#### Image Generation
- ✅ **R3**: `/api/listings/[id]/after/render-rooms` (Generate one after-image per room - replaces old Q4)
- ✅ **R5**: `/api/listings/[id]/after/add-furniture` (Add furniture layer - replaces old Q5, but new implementation)

#### Consistency Passes
- ✅ **R4**: `/api/listings/[id]/after/consistency-pass` (Cross-room consistency correction - without furniture)
- ✅ **R6**: `/api/listings/[id]/after/consistency-pass-furniture` (Final consistency pass with furniture)

#### Tier Pipeline (Still Active)
- ✅ **T6.5**: `/api/listings/[id]/tiers/iterate-element-decisions` (Iterate T5.5 based on T6)

## Questions to Resolve

1. Does "Customised Tier Budgeting" endpoint exist? If so, where is it?
2. Should T6 output be stored in a separate table (e.g., `final_renovation_scope_calibrated`) or update existing `final_renovation_scope`?
3. ✅ Q2 replaces both old Q2 (After Layouts) and old Q3 (Per-Photo Prompts) - use Q3 endpoint name but new implementation
4. What's the best tool for furniture removal? (nano banana mentioned, but need to verify)
5. T6.5 endpoint name: `/api/listings/[id]/tiers/iterate-element-decisions` or similar?
6. Storage for furniture-free photos: New table `listing_photos_furniture_free` or add `furniture_free_url` column to `listing_photos`?
7. Should Q5 (Add Furniture) be a separate endpoint or part of Q4?
8. Should clustering use furniture-free photos or keep original?
