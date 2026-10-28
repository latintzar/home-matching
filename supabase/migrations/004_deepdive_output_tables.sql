-- Deep Dive Output Tables (NEW - CRITICAL)
-- These tables are missing from the reformia schema but required for Deep Dive V2 UI

-- Deep dives table (published deep dive records)
CREATE TABLE IF NOT EXISTS deepdives (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id BIGINT REFERENCES listings(id) ON DELETE CASCADE,
  consideraciones_id BIGINT REFERENCES intelligent_consideraciones(id),
  total_views INTEGER DEFAULT 0,
  max_free_views INTEGER DEFAULT 3,
  price INTEGER DEFAULT 250,
  paywall_enabled BOOLEAN DEFAULT true,
  stripe_payment_id TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Intelligent consideraciones table
CREATE TABLE IF NOT EXISTS intelligent_consideraciones (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT REFERENCES listings(id) ON DELETE CASCADE,
  tier_specific_advice JSONB NOT NULL,
  general_advice JSONB NOT NULL,
  investigation_checklist JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deepdives_listing ON deepdives(listing_id);
CREATE INDEX IF NOT EXISTS idx_consideraciones_listing ON intelligent_consideraciones(listing_id);

-- Enable RLS
ALTER TABLE deepdives ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligent_consideraciones ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public deepdives read" ON deepdives FOR SELECT USING (true);
CREATE POLICY "Public consideraciones read" ON intelligent_consideraciones FOR SELECT USING (true);

-- Create function to increment view count
CREATE OR REPLACE FUNCTION increment_deepdive_views(deepdive_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE deepdives 
  SET total_views = total_views + 1,
      updated_at = NOW()
  WHERE id = deepdive_id;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at triggers
CREATE TRIGGER update_deepdives_updated_at
  BEFORE UPDATE ON deepdives
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consideraciones_updated_at
  BEFORE UPDATE ON intelligent_consideraciones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
