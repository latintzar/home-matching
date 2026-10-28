-- Migration: Add flexibility preference columns to user_lifestyle_profiles
-- Purpose: Store user's flexibility answers from opportunity area questions during intake
-- Date: 2024-12-01

-- Flexibility preferences (collected during opportunity area questions)

-- User's stretched budget if they said yes to budget flex
ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS flexibility_budget_max INTEGER;

-- Additional commute minutes they'd accept
ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS flexibility_commute_extra_mins INTEGER;

-- Adjacent neighborhoods they'd consider
ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS flexibility_neighborhoods TEXT[];

-- Lower bedroom count they'd accept
ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS flexibility_bedrooms_min INTEGER;

-- Dealbreakers they'd waive for the right place
ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS flexibility_dealbreakers_removed TEXT[];

-- Store the last check_availability response for reference
-- { count, hasEnough, matchedLocations, checkedAt }
ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS availability_check_result JSONB;

-- Timestamp when availability was last checked during intake
ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS availability_checked_at TIMESTAMPTZ;

-- Add comment explaining the flexibility system
COMMENT ON COLUMN user_lifestyle_profiles.flexibility_budget_max IS 
  'Maximum budget user would stretch to (collected via opportunity area questions)';

COMMENT ON COLUMN user_lifestyle_profiles.flexibility_commute_extra_mins IS 
  'Additional commute minutes user would accept beyond their stated max';

COMMENT ON COLUMN user_lifestyle_profiles.flexibility_neighborhoods IS 
  'Adjacent neighborhoods user would consider (from opportunity area suggestions)';

COMMENT ON COLUMN user_lifestyle_profiles.flexibility_bedrooms_min IS 
  'Minimum bedrooms user would accept (may be lower than their stated preference)';

COMMENT ON COLUMN user_lifestyle_profiles.flexibility_dealbreakers_removed IS 
  'Dealbreakers user would waive for the right property';

COMMENT ON COLUMN user_lifestyle_profiles.availability_check_result IS 
  'Last check_availability response: {count, hasEnough, matchedLocations, checkedAt}';

