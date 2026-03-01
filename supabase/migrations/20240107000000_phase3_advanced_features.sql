-- Phase 3: Locations, Bundles, and Enhanced Auditing

-- 1. Inventory Locations
CREATE TABLE IF NOT EXISTS inventory_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  details TEXT,
  precise_location_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Stock Levels per Location
CREATE TABLE IF NOT EXISTS inventory_levels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products_inventory(id) ON DELETE CASCADE,
  location_id UUID REFERENCES inventory_locations(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, location_id)
);

-- 3. Update Audit Logs for Reason
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS reason TEXT;

-- 4. Update Product Links for Bundle Quantity
ALTER TABLE product_links ADD COLUMN IF NOT EXISTS quantity_per_unit INTEGER DEFAULT 1;

-- 5. Enable RLS and Policies for new tables
ALTER TABLE inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for anyone for now" ON inventory_locations;
CREATE POLICY "Enable all for anyone for now" ON inventory_locations FOR ALL USING (true);
DROP POLICY IF EXISTS "Enable all for anyone for now" ON inventory_levels;
CREATE POLICY "Enable all for anyone for now" ON inventory_levels FOR ALL USING (true);

-- 6. Insert Default Location if none exists
INSERT INTO inventory_locations (name, details)
VALUES ('Main Warehouse', 'Primary storage facility')
ON CONFLICT DO NOTHING;
