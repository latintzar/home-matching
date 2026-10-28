## Pair-Graph Clustering – New Auto-Clustering Core

**Goal**: Replace the current “all-in-one” Super Stage 0 + Stage 2/3/5 clustering logic with a more stable, explainable pipeline based on:
- Per-photo descriptors
- Targeted pairwise “same room?” judgements
- Simple graph clustering in code
- A final Pro pass that mostly **names** and lightly smooths clusters

This is meant to produce **floorplan-level spaces** (Bedroom 1 vs Bedroom 2, etc.), not just “all bedrooms together”.

---

## Overview of the New Clustering Strategy

This becomes the **new core of `auto-test/full`** for building room clusters. It replaces the old Super Stage 0 + Stage 2/3/5 clustering, while **keeping Stage 4 (visibility) unchanged**.

The clustering path is composed of four sub-steps:

- **Stage 0A – Per-photo descriptors (Flash Lite)**
- **Stage 0B – Pair candidate selection + pairwise judgements (Flash Lite)**
- **Stage 0C – Graph clustering (code-only)**
- **Stage 0D – Pro naming + listing-based sanity (Gemini Pro)**

Downstream stages (2, 3, 4, 5) can keep using the same data shapes as current Super Stage 0; this just changes how Stage 0 is produced.

---

## Stage 0A – Per-photo Descriptors (Flash Lite)

**Purpose**: For each photo, capture the key visual anchors that distinguish spaces at a “floorplan room” level (e.g. bed pattern, wall color, view type), in a small structured JSON.

- **Input**: Listing ID → load `listing_photos` in display order.
- **Model**: Gemini 2.5 Flash / Flash Lite, one photo at a time (or small batch).
- **Output per photo (conceptual)**:

```ts
PhotoDescriptor = {
  photo_index: number;      // 0-based, matches display_order position
  photo_url: string;
  coarse_room_type:
    | 'bedroom'
    | 'bathroom'
    | 'kitchen'
    | 'living'
    | 'terrace'
    | 'corridor'
    | 'community'
    | 'view'
    | 'floorplan'
    | 'certificate'
    | 'other';
  anchors: string[];          // short tags: "zebra duvet", "lilac wall", "double sink"
  materials: string[];        // e.g. "white walls", "wood floor", "ceramic tiles"
  distinctive_markers: string; // 1–2 key cues to recognize this exact space
};
```

These descriptors are **hints** for later steps. They do not define clusters by themselves.

---

## Stage 0B – Pair Candidates + Pairwise “Same Space?” (Flash Lite)

### 0B.1 Pair Candidate Selection (code-only)

**Purpose**: Avoid asking the model about every possible pair (which is \(N^2\)), and skip obviously silly comparisons.

From the `PhotoDescriptor[]` we build a list of **candidate pairs** `(i, j)` where it is plausible that the photos show the same room:

- **Include pairs only if**:
  - `coarse_room_type[i] === coarse_room_type[j]`  
    (or clearly compatible types, e.g. `living` + `terrace`).
  - AND either:
    - `anchors[i]` and `anchors[j]` have enough overlap, **or**
    - `|photo_index_i - photo_index_j| <= 2` (neighbors in sequence) and room types are compatible.

- **Auto-skip pairs when**:
  - One is `view` and the other is not.
  - One is `floorplan` or `certificate` and the other is anything else.
  - Coarse types are clearly incompatible (e.g. `bedroom` vs `kitchen` vs `bathroom`).

Output of this step is just a list of **candidate pairs** to test:

```ts
type PairCandidate = { i: number; j: number };
```

### 0B.2 Pairwise “Same Space?” Judgements (Flash Lite)

**Purpose**: For each plausible pair, ask a very narrow question that Gemini is good at: “same physical room or not?”.

- **Input per call**:
  - Two photos (as images),
  - Their descriptors from Stage 0A (as short text).
- **Model**: Gemini 2.5 Flash Lite (or Flash, depending on quality/cost tradeoff).
- **Prompt (conceptual)**:
  - “Do these two photos show the same physical room/space from different angles? Return JSON: `{ same_space, confidence, reason }`.”

- **Output per pair (stored as TS shape)**:

```ts
type PairJudgement = {
  i: number;                        // photo_index
  j: number;                        // photo_index
  same_space: 'yes' | 'no' | 'maybe';
  confidence: number;               // 0–1
  reason: string;                   // short ~140 char explanation
};
```

All these judgements together form the **pair graph**.

---

## Stage 0C – Graph Clustering in Code

**Purpose**: Turn lots of local “same room?” judgements into global clusters of photos that represent individual spaces.

- **Inputs**:
  - Photo count `N`,
  - `PairJudgement[]` from 0B.

- **Algorithm (high-level)**:
  - Build a graph:
    - Node = one photo (`photo_index`),
    - Edge between `i` and `j` if:
      - `same_space === 'yes'` **and**
      - `confidence >= threshold` (e.g. 0.7).
  - Use a simple **union-find / connected components** algorithm:
    - All photos in the same connected component → belong to the same **room cluster**.

- **Sanity checks**:
  - For each cluster, majority-vote the `coarse_room_type` from descriptors.
  - If a cluster contains obviously conflicting types (e.g. any `kitchen` mixed with `bedroom`), we:
    - Either drop low-confidence edges that caused the mix, or
    - Split suspicious photos into their own singleton clusters.

- **Output** (conceptual):

```ts
type GraphCluster = {
  cluster_id: string;       // internal ID, e.g. "cluster_1"
  photo_indices: number[];  // all photos in this cluster
  coarse_room_type: string; // majority from descriptors
};
```

This gives us **visual clusters** that already correspond to floorplan-level spaces, built from many small, reliable decisions instead of a single big guess.

---

## Stage 0D – Pro Naming + Listing-Based Sanity

**Purpose**: Take the graph-derived clusters and give them human-friendly names, mark excluded content, and cross-check against listing text. Do **not** reinvent clustering from scratch.

- **Inputs**:
  - `GraphCluster[]` from Stage 0C,
  - `PhotoDescriptor[]` from Stage 0A,
  - A summary of `PairJudgement[]` (optional, mainly for Pro’s context),
  - All photos (as images, or at least representative photos per cluster),
  - Listing details (title, description, bed/bath counts, etc.).

- **Model**: Gemini 2.5 Pro.

- **Task (conceptual prompt)**:
  - Treat the graph clusters as the **default answer** (strong prior).
  - For each cluster:
    - Verify it visually makes sense as a single space.
    - Assign a Spanish `cluster_name` (e.g. “Dormitorio Principal”, “Baño 2 (En-suite)”, “Zonas Comunitarias – Piscina”).
    - Mark excluded clusters explicitly:
      - `excluded - vistas`, `excluded - plano`, `excluded - certificado energético`, `excluded - other`.
  - Compare the number of bedroom-like / bathroom-like clusters to the listing’s stated counts and:
    - Surface **uncertainties**, but don’t silently force merges just to “fit the story”.

- **Output (aligned with existing Stage 0 shape)**:
  - `merged_photo_groupings[]`:
    - `cluster_name`,
    - `photo_indices[]`,
    - `is_excluded`, `excluded_type`, `excluded_reason`.
  - `target_clusters[]`: list of non-excluded cluster names.
  - `reasoning` + `uncertainties` about bed/bath counts vs listing.

This Stage 0D output is designed to **drop in** where the current Super Stage 0 result is expected, so Stages 2/3/5 can keep operating with minimal change.

---

## How This Fits Into `auto-test/full`

At a high level, the **new** `auto-test/full` clustering flow should be:

1. **Descriptors** → Stage 0A (Flash Lite)
2. **Pair decisions** → Stage 0B (Flash Lite)
3. **Graph clusters** → Stage 0C (code-only)
4. **Naming + listing sanity** → Stage 0D (Pro)
5. **Visibility mapping** → existing Stage 4 (unchanged)

The output of Stage 0D is kept compatible with the existing Stage 0 result shape (`merged_photo_groupings`, `target_clusters`, etc.) so the rest of the pipeline can continue to consume it without needing to know about the internal pair-graph details.

Behavioral intent:
- Use Flash Lite for **local “same room?” intelligence**.
- Use code for **graph clustering**.
- Use Pro **only** to name clusters and fix obvious contradictions, not to invent a new clustering from scratch.



