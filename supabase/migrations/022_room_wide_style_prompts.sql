-- Migration: Convert renovation_style_prompts from per-photo to room-wide prompts
-- This enables one prompt per room per tier (not per photo), improving consistency
-- across all photos of the same room

-- Step 1: Drop existing primary key constraint
ALTER TABLE public.renovation_style_prompts
DROP CONSTRAINT IF EXISTS renovation_style_prompts_pkey;

-- Step 2: Remove photo_url and photo_index columns (no longer needed)
ALTER TABLE public.renovation_style_prompts
DROP COLUMN IF EXISTS photo_url,
DROP COLUMN IF EXISTS photo_index;

-- Step 3: Rename after_prompt to room_wide_prompt for clarity
ALTER TABLE public.renovation_style_prompts
RENAME COLUMN after_prompt TO room_wide_prompt;

-- Step 4: Add new composite primary key: (listing_id, tier, room_id)
-- This ensures one prompt per room per tier
ALTER TABLE public.renovation_style_prompts
ADD PRIMARY KEY (listing_id, tier, room_id);

-- Step 5: Drop old indexes that referenced photo_url/photo_index
DROP INDEX IF EXISTS idx_renovation_style_prompts_photo_url;
DROP INDEX IF EXISTS idx_renovation_style_prompts_photo_index;

-- Step 6: Update comments
COMMENT ON COLUMN public.renovation_style_prompts.room_wide_prompt IS 'Room-wide renovation prompt describing how to transform the entire room (all angles) for this tier. Used by Q3 (anchor) and Q4 (angle-matching) for consistent renders across all photos of the room.';

-- Step 7: Clean up any duplicate rows (keep the most recent one per room/tier)
-- This handles the case where multiple prompts existed for the same room/tier
DELETE FROM public.renovation_style_prompts a
USING public.renovation_style_prompts b
WHERE a.listing_id = b.listing_id
  AND a.tier = b.tier
  AND a.room_id = b.room_id
  AND a.generated_at < b.generated_at;

