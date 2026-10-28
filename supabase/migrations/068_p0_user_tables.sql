-- P0 MVP User Tables Migration
-- Adds user_id support to lifestyle profiles and creates saved_properties table

-- ============================================
-- 1. Add user_id to user_lifestyle_profiles
-- ============================================

-- Add user_id column if it doesn't exist
ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Add intake_completed flag
ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS intake_completed BOOLEAN DEFAULT FALSE;

-- Add budget columns
ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS budget_min INTEGER;

ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS budget_max INTEGER;

-- Add preference columns
ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS preferred_areas TEXT[];

ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS bedrooms_min INTEGER;

ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS bathrooms_min INTEGER;

ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS work_location TEXT;

ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS max_commute_minutes INTEGER;

ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS lifestyle_notes TEXT;

-- Add user type column
ALTER TABLE user_lifestyle_profiles 
ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'renter' CHECK (user_type IN ('renter', 'buyer', 'pro'));

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_user_lifestyle_profiles_user_id ON user_lifestyle_profiles(user_id);

-- ============================================
-- 2. Create saved_properties table
-- ============================================

CREATE TABLE IF NOT EXISTS saved_properties (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(user_id, listing_id)
);

-- Enable RLS
ALTER TABLE saved_properties ENABLE ROW LEVEL SECURITY;

-- Users can only see their own saved properties
CREATE POLICY "Users can view own saved properties" 
  ON saved_properties FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved properties" 
  ON saved_properties FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved properties" 
  ON saved_properties FOR DELETE 
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_properties_user_id ON saved_properties(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_properties_listing_id ON saved_properties(listing_id);

-- ============================================
-- 3. Create property_notes table
-- ============================================

CREATE TABLE IF NOT EXISTS property_notes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  note_type TEXT NOT NULL CHECK (note_type IN ('text', 'photo', 'voice')),
  content TEXT, -- For text notes
  media_url TEXT, -- For photo/voice notes (Supabase Storage URL)
  duration_seconds INTEGER, -- For voice notes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE property_notes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notes
CREATE POLICY "Users can view own notes" 
  ON property_notes FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes" 
  ON property_notes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" 
  ON property_notes FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" 
  ON property_notes FOR DELETE 
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_property_notes_user_id ON property_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_property_notes_listing_id ON property_notes(listing_id);
CREATE INDEX IF NOT EXISTS idx_property_notes_user_listing ON property_notes(user_id, listing_id);

-- ============================================
-- 4. Create property_views table (track viewed properties)
-- ============================================

CREATE TABLE IF NOT EXISTS property_views (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  viewing_completed BOOLEAN DEFAULT FALSE,
  viewing_completed_at TIMESTAMPTZ,
  UNIQUE(user_id, listing_id)
);

-- Enable RLS
ALTER TABLE property_views ENABLE ROW LEVEL SECURITY;

-- Users can only see their own views
CREATE POLICY "Users can view own property views" 
  ON property_views FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own property views" 
  ON property_views FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own property views" 
  ON property_views FOR UPDATE 
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_property_views_user_id ON property_views(user_id);
CREATE INDEX IF NOT EXISTS idx_property_views_listing_id ON property_views(listing_id);

-- ============================================
-- 5. Update RLS on user_lifestyle_profiles
-- ============================================

-- Drop old policies if they exist (public policies from original migration)
DROP POLICY IF EXISTS "Public profiles read" ON user_lifestyle_profiles;
DROP POLICY IF EXISTS "Public profiles insert" ON user_lifestyle_profiles;
DROP POLICY IF EXISTS "Public profiles update" ON user_lifestyle_profiles;

-- Create user-based policies
CREATE POLICY "Users can view own profile" 
  ON user_lifestyle_profiles FOR SELECT 
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own profile" 
  ON user_lifestyle_profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own profile" 
  ON user_lifestyle_profiles FOR UPDATE 
  USING (auth.uid() = user_id OR user_id IS NULL);

