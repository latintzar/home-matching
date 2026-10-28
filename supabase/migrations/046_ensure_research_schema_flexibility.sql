-- Ensure category columns are TEXT to allow new categories (Mega-Categories & Contractor)
ALTER TABLE renovation_research_results ALTER COLUMN category TYPE TEXT;
ALTER TABLE analysis_curated_results ALTER COLUMN category TYPE TEXT;

-- Ensure tier column exists
ALTER TABLE renovation_research_results ADD COLUMN IF NOT EXISTS tier TEXT;

-- Drop old constraints that might block multi-tier data
ALTER TABLE renovation_research_results DROP CONSTRAINT IF EXISTS renovation_research_results_listing_category_key;
ALTER TABLE renovation_research_results DROP CONSTRAINT IF EXISTS renovation_research_results_listing_category_unique;
ALTER TABLE renovation_research_results DROP CONSTRAINT IF EXISTS renovation_research_results_listing_category_tier_unique;

-- Create proper unique index for upserts (handling NULL tiers if any legacy data exists)
CREATE UNIQUE INDEX IF NOT EXISTS renovation_research_results_listing_category_tier_idx 
ON renovation_research_results (listing_id, category, COALESCE(tier, ''));

