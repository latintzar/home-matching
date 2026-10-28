-- Migration: 064_pro_clients.sql
-- Purpose: Create pro_clients table for professional user client management
-- Part of Phase 0: Foundation

-- Pro clients table
-- Stores clients managed by professional users (agents, relocation specialists)
CREATE TABLE IF NOT EXISTS pro_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_user_id UUID NOT NULL,  -- References auth.users (the professional)
  
  -- Client info
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  
  -- Secure tokens for sharing
  shortlist_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  intake_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  
  -- Link to lifestyle profile (from intake)
  lifestyle_profile_id UUID REFERENCES user_lifestyle_profiles(id),
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'converted')),
  
  -- Notes from professional
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pro_clients_pro_user ON pro_clients(pro_user_id);
CREATE INDEX IF NOT EXISTS idx_pro_clients_shortlist_token ON pro_clients(shortlist_token);
CREATE INDEX IF NOT EXISTS idx_pro_clients_intake_token ON pro_clients(intake_token);
CREATE INDEX IF NOT EXISTS idx_pro_clients_status ON pro_clients(status);

-- Enable RLS
ALTER TABLE pro_clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Pros can manage their own clients
CREATE POLICY "Pros can manage own clients"
  ON pro_clients
  FOR ALL
  USING (pro_user_id = auth.uid())
  WITH CHECK (pro_user_id = auth.uid());

-- Allow reading by shortlist token (for public shortlist access)
CREATE POLICY "Public access via shortlist token"
  ON pro_clients
  FOR SELECT
  USING (shortlist_token IS NOT NULL);

-- Allow reading by intake token (for client intake)
CREATE POLICY "Public access via intake token"
  ON pro_clients
  FOR SELECT
  USING (intake_token IS NOT NULL);

-- Update trigger
CREATE OR REPLACE FUNCTION update_pro_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pro_clients_updated_at
  BEFORE UPDATE ON pro_clients
  FOR EACH ROW
  EXECUTE FUNCTION update_pro_clients_updated_at();

COMMENT ON TABLE pro_clients IS 'Clients managed by professional users (agents, relocation specialists)';
COMMENT ON COLUMN pro_clients.shortlist_token IS 'Secure token for sharing client shortlist publicly';
COMMENT ON COLUMN pro_clients.intake_token IS 'Secure token for client to complete intake themselves';

