-- Add columns for voice intake transcript storage
-- These columns store the ElevenLabs conversation data

ALTER TABLE public.user_lifestyle_profiles
ADD COLUMN IF NOT EXISTS voice_transcript TEXT,
ADD COLUMN IF NOT EXISTS voice_conversation_id TEXT;

-- Add index for conversation lookup
CREATE INDEX IF NOT EXISTS idx_user_lifestyle_profiles_voice_conversation_id 
ON public.user_lifestyle_profiles(voice_conversation_id);

COMMENT ON COLUMN public.user_lifestyle_profiles.voice_transcript IS 'Full transcript from ElevenLabs voice conversation';
COMMENT ON COLUMN public.user_lifestyle_profiles.voice_conversation_id IS 'ElevenLabs conversation ID for reference';

