-- 1. Create Products Shopify Table
CREATE TABLE IF NOT EXISTS products_shopify (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_product_id TEXT,
  shopify_variant_id TEXT UNIQUE,
  title TEXT,
  sku TEXT,
  price NUMERIC,
  images JSONB DEFAULT '[]',
  inventory_policy TEXT, -- 'deny' or 'continue'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Order Verifications Table
CREATE TABLE IF NOT EXISTS order_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  variant_id TEXT, -- Nullable: If null, it's a "whole order" verification (e.g. box video)
  media_url TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('image', 'video')),
  uploaded_by UUID REFERENCES auth.users(id), -- Tracks who uploaded it
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  old_data JSONB,
  new_data JSONB,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Alter Existing Tables
-- Orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_company_id UUID REFERENCES delivery_companies(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS audit_history JSONB DEFAULT '[]';

-- Delivery Companies
ALTER TABLE delivery_companies ADD COLUMN IF NOT EXISTS rates JSONB DEFAULT '[]';
ALTER TABLE delivery_companies ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Inventory
ALTER TABLE products_inventory ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0;
ALTER TABLE products_inventory ADD COLUMN IF NOT EXISTS selling_price NUMERIC DEFAULT 0;

-- 5. Enable RLS for new tables
ALTER TABLE products_shopify ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies (Public/Permissive for MVP, similar to existing)
-- Products Shopify
DROP POLICY IF EXISTS "Enable read access for all users" ON products_shopify;
CREATE POLICY "Enable read access for all users" ON products_shopify FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable insert access for all users" ON products_shopify;
CREATE POLICY "Enable insert access for all users" ON products_shopify FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enable update access for all users" ON products_shopify;
CREATE POLICY "Enable update access for all users" ON products_shopify FOR UPDATE USING (true);

-- Order Verifications
DROP POLICY IF EXISTS "Enable read access for all users" ON order_verifications;
CREATE POLICY "Enable read access for all users" ON order_verifications FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable insert access for all users" ON order_verifications;
CREATE POLICY "Enable insert access for all users" ON order_verifications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enable update access for all users" ON order_verifications;
CREATE POLICY "Enable update access for all users" ON order_verifications FOR UPDATE USING (true);

-- Audit Logs
DROP POLICY IF EXISTS "Enable read access for all users" ON audit_logs;
CREATE POLICY "Enable read access for all users" ON audit_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable insert access for all users" ON audit_logs;
CREATE POLICY "Enable insert access for all users" ON audit_logs FOR INSERT WITH CHECK (true);
