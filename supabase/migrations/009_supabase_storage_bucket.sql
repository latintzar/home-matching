-- Migration 009: Supabase Storage Bucket for Listing Photos
-- Purpose: Create storage bucket for reliable photo storage and serving
-- Replaces: Dependence on Idealista URLs for photo storage

-- Create storage bucket for listing photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-photos',
  'listing-photos', 
  true,  -- Public bucket for easy serving
  10485760,  -- 10MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- Create RLS policy for public read access
CREATE POLICY "Public read access for listing photos" ON storage.objects
FOR SELECT USING (bucket_id = 'listing-photos');

-- Create RLS policy for authenticated write access
CREATE POLICY "Authenticated write access for listing photos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'listing-photos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated update access for listing photos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'listing-photos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated delete access for listing photos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'listing-photos' 
  AND auth.role() = 'authenticated'
);

-- Comments for documentation
COMMENT ON POLICY "Public read access for listing photos" ON storage.objects IS 'Allows public read access to listing photos for display';
COMMENT ON POLICY "Authenticated write access for listing photos" ON storage.objects IS 'Allows authenticated users to upload listing photos';
COMMENT ON POLICY "Authenticated update access for listing photos" ON storage.objects IS 'Allows authenticated users to update listing photos';
COMMENT ON POLICY "Authenticated delete access for listing photos" ON storage.objects IS 'Allows authenticated users to delete listing photos';

