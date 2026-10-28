## Room Layout Consistency – Implementation Brief (Chunk 1)

Last updated: 2025-01-27

### 🧭 Pipeline Summary

You now have clusters of photos per room and per-photo visibility_mappings.

From these, the pipeline:

1️⃣ builds structured room layouts → 2️⃣ fuses them into a whole-home layout → 3️⃣ generates each room's anchor "after" render → 4️⃣ produces consistent renders for all other angles → 5️⃣ aligns color/light across visible rooms.

---

## ⚙️ New E1 — Room Layout Extraction (Gemini 2.5 Flash)

### Purpose

Turn each room's photo set into a text-based spatial layout description capturing geometry, objects, materials, and any other rooms visible in the shots.

### Inputs

| Field | Type | Description |
|-------|------|-------------|
| `photos` | array of base64 JPEGs | All images for one room cluster |
| `visibility_mappings` | JSON object | `{ photo_url → [visible_cluster_ids] }` list of other rooms visible in each photo |
| `cluster_name` | string | Human label, e.g. "Living Room" |
| `style_brief` (optional) | string | Renovation tier tag such as "Mid-range Mediterranean" |

### Prompt

```
You are an architectural spatial analyst.

You will receive multiple photos of the same room taken from different angles,
plus a mapping that indicates which other rooms are visible in each photo.

Your goal:

1. Infer the 2D room layout as if viewed from above.

2. Identify walls, openings, fixed elements, and movable furniture.

3. Describe each object's approximate position (x,y in meters if estimable),
   orientation, material, and color.

4. When an element belongs to a different room that is visible in the photo,
   mark it using the provided visibility mapping with field "room_ref".

5. Infer floor and wall surface materials and lighting character.

6. CRITICAL: Generate unique object IDs using the format: "{type}_cluster{room_id}_{number}"
   Example: For room cluster_77, use "sink_cluster77_1", "mirror_cluster77_1", etc.
   This ensures each room's objects have unique IDs and prevents conflicts.

7. Output a single structured JSON object exactly following the schema below.

8. Do not include narrative sentences or non-JSON text.
```

### Output Schema

```json
{
  "room_id": "cluster_2",
  "room_name": "Living Room",
  "dimensions_est_m": [5.2, 4.1],
  "walls": [
    {"id": "north", "has_window": true, "window_width_m": 2.1},
    {"id": "south", "has_door": true}
  ],
  "objects": [
    {
      "id": "sofa_cluster2_1",
      "type": "sofa",
      "position": [2.3, 1.2],
      "orientation_deg": 0,
      "color": "beige",
      "material": "linen"
    },
    {
      "id": "dining_table_cluster3_1",
      "type": "table",
      "room_ref": "cluster_3",
      "visible_from_photo": "living1.jpg"
    }
  ],
  "surfaces": {
    "floor": "oak",
    "walls": "matte_white",
    "ceiling": "white"
  },
  "lighting": "natural_south_window",
  "openings": [
    {"type": "arch", "faces_room": "cluster_3"}
  ]
}
```

### Model: Gemini 2.5 Flash

- **Output**: JSON (text)
- **Calls**: One per room cluster

---

## ⚙️ New E2 — Unified Home Layout Fusion (Gemini 2.5 Flash)

### Purpose

Merge all per-room layout JSONs and listing description into one allocentric, cross-referenced layout describing the full dwelling and room adjacencies.

### Inputs

| Field | Type | Description |
|-------|------|-------------|
| `room_layouts` | array of JSON | Output objects from Step 2 |
| `listing_text` | string | Agent description text |
| `visibility_mappings` | JSON | Complete `{ cluster_id → visibility_mappings }` block |

### Prompt

```
You are merging detailed room layouts of a single property.

Input data:

• An array of room layout JSONs produced by previous analysis.

• The listing text written by the agent.

• Visibility mappings that indicate which rooms are visible from which photos.

Instructions:

1. Merge all room layouts into one unified home representation.

2. Use visibility_mappings to identify adjacency between rooms.

3. Merge duplicate objects that appear in multiple rooms (e.g., a shared table).

4. Use the listing text only to clarify naming, orientation, or adjacency—
   never invent geometry that photos do not support.

5. Include a top-level list of connections between rooms.

6. Include global features (floor material, orientation, light quality).

7. Output JSON exactly matching the schema below.
```

### Output Schema

```json
{
  "home_id": "listing_1000000121",
  "rooms": [
    { "room_id": "cluster_1", "room_name": "Kitchen", "surfaces": {...}, "objects": [...] },
    { "room_id": "cluster_2", "room_name": "Living Room", "surfaces": {...}, "objects": [...] }
  ],
  "connections": [
    { "from": "cluster_1", "to": "cluster_2", "type": "archway" },
    { "from": "cluster_3", "to": "cluster_4", "type": "door" }
  ],
  "global_features": {
    "floor_material": "oak",
    "orientation": "south",
    "lighting": "natural"
  }
}
```

### Model: Gemini 2.5 Flash

- **Output**: JSON (text)
- **Calls**: One per property

---

## Data Model

### Table: `room_analyses`

- `room_layout_json` JSONB - Per-room layout from E1
- `unified_home_layout_json` JSONB - Complete home layout from E2 (stored once per listing)

### Persistence

- E1 outputs: One JSON per room cluster → `room_analyses.room_layout_json`
- E2 output: Single unified layout → `room_analyses.unified_home_layout_json` (or separate table if preferred)

---

## API Endpoints

### E1: Room Layout Extraction

`POST /api/listings/[id]/rooms/[roomId]/layout/extraction`

**Request:**
```json
{
  "cluster_name": "Living Room",
  "style_brief": "Mid-range Mediterranean" // optional
}
```

**Response:**
```json
{
  "room_id": "cluster_2",
  "room_layout": { /* E1 output schema */ }
}
```

### E2: Unified Home Layout Fusion

`POST /api/listings/[id]/rooms/layout/fusion`

**Request:**
```json
{
  "listing_text": "Beautiful apartment in..."
}
```

**Response:**
```json
{
  "home_id": "listing_1000000121",
  "unified_layout": { /* E2 output schema */ }
}
```

---

## Downstream Use

1. **Renovation Scope**: Reference elements unambiguously (e.g., "Remove the carpet in the living room", "Knock down the wall between the living room and the kitchen")
2. **After Image Generation**: Consistent room references across all angles
3. **Style Prompts**: Anchor prompts to specific room elements and adjacencies
4. **Room-by-Room Writeups**: Reference elements with anchors to photos

---

## Edge Cases

- **Occlusions / mirrors / strong perspective distortions**: Lower confidence; allow partial agreement
- **Visibility mappings missing**: Infer adjacency from object references across rooms
- **Multiple similar items**: Disambiguate by relations ("north wall", "adjacent to door")
- **Estimating dimensions**: Use photo metadata, scale references, or standard room proportions

---

## Milestones

1. ✅ Implement E1 endpoint (room layout extraction)
2. ✅ Implement E2 endpoint (unified home layout fusion)
3. ✅ Persist room layouts and unified layout
4. ✅ Feed layout into renovation scope generation
5. ✅ Feed layout into after image prompt generation
6. ✅ Update room writeups to reference layout elements
