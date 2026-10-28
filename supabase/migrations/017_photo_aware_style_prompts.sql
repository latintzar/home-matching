-- Migration: Add photo_url to renovation_style_prompts for photo-aware prompt generation
-- This enables per-photo prompts that reference actual geometry, lighting, and materials
-- Each room can now have multiple prompts (one per photo), allowing photo-specific renovations

-- Add photo_url and photo_index columns (nullable initially to allow migration of existing data)
ALTER TABLE public.renovation_style_prompts
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS photo_index INTEGER;

-- Drop existing rows that don't have photo_url (legacy data) - we'll regenerate with photo-aware prompts
DELETE FROM public.renovation_style_prompts WHERE photo_url IS NULL;

-- Drop the old composite primary key
ALTER TABLE public.renovation_style_prompts
DROP CONSTRAINT IF EXISTS renovation_style_prompts_pkey;

-- Make photo_url NOT NULL now that legacy rows are deleted
ALTER TABLE public.renovation_style_prompts
ALTER COLUMN photo_url SET NOT NULL;

-- Add new composite primary key: (listing_id, tier, room_id, photo_url)
-- This allows multiple prompts per room (one per photo from manual_photo_clusters)
ALTER TABLE public.renovation_style_prompts
ADD PRIMARY KEY (listing_id, tier, room_id, photo_url);

-- Create index for efficient lookups by photo URL
CREATE INDEX IF NOT EXISTS idx_renovation_style_prompts_photo_url 
ON public.renovation_style_prompts (photo_url);

CREATE INDEX IF NOT EXISTS idx_renovation_style_prompts_photo_index 
ON public.renovation_style_prompts (listing_id, tier, photo_index);

COMMENT ON COLUMN public.renovation_style_prompts.photo_url IS 'URL of the before photo this prompt applies to (from manual_photo_clusters.photo_urls). Allows per-photo prompt generation.';
COMMENT ON COLUMN public.renovation_style_prompts.photo_index IS 'Display order index of the photo (matches listing_photos.display_order for pairing with after_photos.index)';

