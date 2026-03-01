-- 1. Create Internal Inventory Table
CREATE TABLE IF NOT EXISTS products_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  quantity_on_hand INTEGER DEFAULT 0,
  bin_location TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Product Links Table (Mapping Shopify Line Items to Internal Inventory)
CREATE TABLE IF NOT EXISTS product_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_product_id TEXT,
  shopify_variant_id TEXT,
  inventory_product_id UUID REFERENCES products_inventory(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE products_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_links ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies (Public access for MVP)
CREATE POLICY "Enable read access for all users" ON products_inventory FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON products_inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON products_inventory FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON product_links FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON product_links FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON product_links FOR UPDATE USING (true);

-- 5. Insert Seed Data
INSERT INTO products_inventory (sku, name, quantity_on_hand, bin_location)
VALUES 
  ('WH-001', 'Wireless Headphones - Black', 50, 'A-01-01'),
  ('SW-002', 'Smart Watch - Series 5', 30, 'B-02-05'),
  ('USB-C-CABLE', 'USB-C Charging Cable', 100, 'C-05-10')
ON CONFLICT (sku) DO NOTHING;
