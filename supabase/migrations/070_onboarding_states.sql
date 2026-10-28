-- Migration: 070_onboarding_states.sql
-- Purpose: Add columns to track detailed onboarding progress

-- Add intake_step to track current position in onboarding
-- 0 = not started, 1-5 = in progress, 6+ = core done
ALTER TABLE user_lifestyle_profiles
ADD COLUMN IF NOT EXISTS intake_step INTEGER DEFAULT 0;

-- Track if whatif questions have been completed
ALTER TABLE user_lifestyle_profiles
ADD COLUMN IF NOT EXISTS whatifs_completed BOOLEAN DEFAULT FALSE;

-- Track number of follow-up conversations
ALTER TABLE user_lifestyle_profiles
ADD COLUMN IF NOT EXISTS followup_count INTEGER DEFAULT 0;

-- Track when last follow-up occurred
ALTER TABLE user_lifestyle_profiles
ADD COLUMN IF NOT EXISTS last_followup_at TIMESTAMPTZ;

-- Index for quick state lookups
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_state 
ON user_lifestyle_profiles(user_id, intake_completed, whatifs_completed);

-- Comments for documentation
COMMENT ON COLUMN user_lifestyle_profiles.intake_step IS 'Current step in onboarding (0=not started, 1-5=in progress, 6+=core done)';
COMMENT ON COLUMN user_lifestyle_profiles.whatifs_completed IS 'Whether whatif questions have been completed';
COMMENT ON COLUMN user_lifestyle_profiles.followup_count IS 'Number of follow-up conversations with Leo';
COMMENT ON COLUMN user_lifestyle_profiles.last_followup_at IS 'Timestamp of last follow-up conversation';

