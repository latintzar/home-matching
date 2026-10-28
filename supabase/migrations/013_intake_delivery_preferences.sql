-- Migration: Add intake delivery preferences and completeness tracking
-- These fields support the intake flow where users can choose email vs WhatsApp delivery

-- Completeness tracking
ALTER TABLE public.user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS completeness_score INTEGER DEFAULT 0;

ALTER TABLE public.user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS minimum_met BOOLEAN DEFAULT FALSE;

ALTER TABLE public.user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS missing_fields TEXT[] DEFAULT '{}';

-- Delivery preferences
ALTER TABLE public.user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS delivery_preference TEXT DEFAULT 'email' 
CHECK (delivery_preference IN ('email', 'whatsapp'));

ALTER TABLE public.user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Follow-up tracking
ALTER TABLE public.user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS follow_up_sent_at TIMESTAMPTZ;

ALTER TABLE public.user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS last_recommendation_sent_at TIMESTAMPTZ;

-- Language preference (from homepage/signup)
ALTER TABLE public.user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'es' 
CHECK (language IN ('es', 'en'));

-- Email for non-authenticated users (early access, waiting list)
ALTER TABLE public.user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Index for follow-up queries
CREATE INDEX IF NOT EXISTS idx_profiles_follow_up 
ON public.user_lifestyle_profiles(minimum_met, follow_up_sent_at) 
WHERE minimum_met = FALSE;

-- Index for daily recommendation cron
CREATE INDEX IF NOT EXISTS idx_profiles_recommendations 
ON public.user_lifestyle_profiles(delivery_preference, last_recommendation_sent_at) 
WHERE minimum_met = TRUE;

COMMENT ON COLUMN public.user_lifestyle_profiles.completeness_score IS '0-100 score indicating profile completeness';
COMMENT ON COLUMN public.user_lifestyle_profiles.minimum_met IS 'TRUE if we have enough info for basic recommendations (budget + location/household)';
COMMENT ON COLUMN public.user_lifestyle_profiles.delivery_preference IS 'How user wants to receive property recommendations';
COMMENT ON COLUMN public.user_lifestyle_profiles.phone_number IS 'WhatsApp number if delivery_preference is whatsapp';
COMMENT ON COLUMN public.user_lifestyle_profiles.language IS 'User language preference from homepage/signup';

