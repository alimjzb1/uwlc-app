-- 1. Create Delivery Companies Table
CREATE TABLE IF NOT EXISTS delivery_companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  api_key TEXT, -- specific to the provider, e.g., FleetRunnr API Key
  base_url TEXT, -- API endpoint
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE delivery_companies ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies (Public access for MVP)
DROP POLICY IF EXISTS "Enable read access for all users" ON delivery_companies;
CREATE POLICY "Enable read access for all users" ON delivery_companies FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all users" ON delivery_companies;
CREATE POLICY "Enable insert access for all users" ON delivery_companies FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON delivery_companies;
CREATE POLICY "Enable update access for all users" ON delivery_companies FOR UPDATE USING (true);

-- 4. Insert Seed Data (FleetRunnr Placeholder)
INSERT INTO delivery_companies (name, base_url, is_active)
VALUES 
  ('FleetRunnr', 'https://api.fleetrunnr.com/v1', true),
  ('Local Courier', 'https://api.local-courier.com', false)
ON CONFLICT DO NOTHING;
