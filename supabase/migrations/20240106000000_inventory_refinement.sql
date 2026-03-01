-- 1. Refine Inventory Table for Variants and Details
ALTER TABLE products_inventory 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES products_inventory(id) ON DELETE SET NULL;

-- 2. Create Delivery Tag Mappings Table
CREATE TABLE IF NOT EXISTS delivery_tag_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tag TEXT NOT NULL,
  delivery_company_id UUID REFERENCES delivery_companies(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tag, delivery_company_id)
);

-- 3. Enable RLS and Policies for new table
ALTER TABLE delivery_tag_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON delivery_tag_mappings;
CREATE POLICY "Enable read access for all users" ON delivery_tag_mappings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable insert access for all users" ON delivery_tag_mappings;
CREATE POLICY "Enable insert access for all users" ON delivery_tag_mappings FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enable update access for all users" ON delivery_tag_mappings;
CREATE POLICY "Enable update access for all users" ON delivery_tag_mappings FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Enable delete access for all users" ON delivery_tag_mappings;
CREATE POLICY "Enable delete access for all users" ON delivery_tag_mappings FOR DELETE USING (true);

-- 4. Initial Seed for Sample Tags
-- (Optional: Add common tags)
-- INSERT INTO delivery_tag_mappings (tag, delivery_company_id) 
-- SELECT 'heavy', id FROM delivery_companies WHERE name = 'FleetRunnr' LIMIT 1;
