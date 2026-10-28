-- Migration: Fix RLS Policy for final_renovation_scope_calibrated
-- Fixes RLS policy to allow service role to insert/update
-- Date: 2025-01-27

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Service role can manage final_renovation_scope_calibrated" ON final_renovation_scope_calibrated;

-- Create policy matching the pattern from final_renovation_scope table
-- Uses auth.jwt() which works better with service role key
CREATE POLICY "Service role can manage final_renovation_scope_calibrated" 
  ON final_renovation_scope_calibrated 
  FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Also ensure public can still view
DROP POLICY IF EXISTS "Public can view final_renovation_scope_calibrated" ON final_renovation_scope_calibrated;
CREATE POLICY "Public can view final_renovation_scope_calibrated" 
  ON final_renovation_scope_calibrated 
  FOR SELECT 
  USING (true);

