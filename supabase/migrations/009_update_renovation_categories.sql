-- Migration: Update renovation search terms table for 7 categories
-- This migration updates the category constraint to support the new 7-category system

-- First, drop the existing constraint
ALTER TABLE renovation_search_terms DROP CONSTRAINT IF EXISTS renovation_search_terms_category_check;

-- Add the new constraint with 7 categories
ALTER TABLE renovation_search_terms ADD CONSTRAINT renovation_search_terms_category_check 
  CHECK (category IN ('costs', 'timings', 'permits', 'laws_regulations', 'norms_standards', 'market_practices', 'incentives'));

-- Update any existing data if needed (optional - only if we have existing data)
-- UPDATE renovation_search_terms SET category = 'timings' WHERE category = 'durations';
-- UPDATE renovation_search_terms SET category = 'laws_regulations' WHERE category = 'norms';
