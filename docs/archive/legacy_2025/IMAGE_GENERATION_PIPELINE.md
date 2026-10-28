# Image Generation Pipeline (After Images)

**⚠️ STATUS: This document describes legacy endpoints which have been REMOVED.**

**Current Standard Pipeline:** R Pipeline (Room-Based Approach)

See `PIPELINE_FLOW.md` for the current R pipeline documentation.

---

## Legacy Endpoints (REMOVED)

**All endpoints described below have been removed:**

- ~~`/api/listings/[id]/style-direction`~~ - **REMOVED** (replaced by T2.5 tier-specific style direction)
- ~~`/api/listings/[id]/renovation-style-prompts`~~ - **REMOVED** (replaced by R2b generate-room-prompts)
- ~~`/api/listings/[id]/image-gen/rooms`~~ - **REMOVED** (legacy endpoint, depended on removed renovation-style-prompts)

**Current R Pipeline Endpoints:**
- F0: `/api/listings/[id]/photos/remove-furniture`
- R1: `/api/listings/[id]/after/select-room-images`
- R2a: `/api/listings/[id]/after/describe-room-images`
- R2b-Master: `/api/listings/[id]/after/generate-master-references`
- R2b: `/api/listings/[id]/after/generate-room-prompts`
- R3: `/api/listings/[id]/after/render-rooms`
- R4: `/api/listings/[id]/after/consistency-pass`
- R5-Master: `/api/listings/[id]/after/generate-furniture-master-references`
- R5: `/api/listings/[id]/after/add-furniture`
- R6: `/api/listings/[id]/after/consistency-pass-furniture`

## Storage Conventions

- Before: `property-images/<listing_id>/before/<filename>`
- After:  `property-images/<listing_id>/after/<tier>/<index>.png`

## Tables

- `listing_photos`
  - `listing_id TEXT`, `url TEXT`, `display_order INT`, `photo_type TEXT`, `filename TEXT`, etc.
- `after_photos`
  - `listing_id BIGINT`, `tier TEXT`, `index INT`, `url TEXT`, `created_at TIMESTAMPTZ`
  - Primary key / conflict target: `(listing_id, tier, index)`

## Tier Naming

- Pipeline tiers: `estandar | optimo | plus`
- Current UI uses: `livable | comfortable | competitive`
- Until UI is migrated, map:
  - estandar → livable
  - optimo → comfortable
  - plus → competitive

## Error Handling Notes

- If a generated image fails, keep placeholder row; retry generation later
- Use upsert for Storage (overwrite) and DB rows to avoid duplicates
