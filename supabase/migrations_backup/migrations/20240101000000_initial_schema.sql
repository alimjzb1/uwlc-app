-- Drop tables if they exist to start fresh (Optional, be careful in production)
-- DROP TABLE IF EXISTS order_items;
-- DROP TABLE IF EXISTS orders;
-- DROP TABLE IF EXISTS customers;

-- 1. Create Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_customer_id TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_order_id TEXT,
  shopify_order_number TEXT,
  customer_id UUID REFERENCES customers(id),
  email TEXT,
  currency TEXT,
  total_price NUMERIC,
  subtotal_price NUMERIC,
  total_tax NUMERIC,
  fulfillment_status TEXT,
  financial_status TEXT,
  internal_status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  note TEXT,
  shipping_address JSONB,
  billing_address JSONB
);

-- 3. Create Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  shopify_line_item_id TEXT,
  product_id TEXT,
  name TEXT,
  sku TEXT,
  quantity INTEGER,
  price NUMERIC
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;


-- 5. Create Policies (Allow public access for now to ensure app works, lock down later)

-- Customers Policies
DROP POLICY IF EXISTS "Enable read access for all users" ON customers;
CREATE POLICY "Enable read access for all users" ON customers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all users" ON customers;
CREATE POLICY "Enable insert access for all users" ON customers FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON customers;
CREATE POLICY "Enable update access for all users" ON customers FOR UPDATE USING (true);

-- Orders Policies
DROP POLICY IF EXISTS "Enable read access for all users" ON orders;
CREATE POLICY "Enable read access for all users" ON orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all users" ON orders;
CREATE POLICY "Enable insert access for all users" ON orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON orders;
CREATE POLICY "Enable update access for all users" ON orders FOR UPDATE USING (true);

-- Order Items Policies
DROP POLICY IF EXISTS "Enable read access for all users" ON order_items;
CREATE POLICY "Enable read access for all users" ON order_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all users" ON order_items;
CREATE POLICY "Enable insert access for all users" ON order_items FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON order_items;
CREATE POLICY "Enable update access for all users" ON order_items FOR UPDATE USING (true);

-- 6. Insert Seed Data
-- Customer
INSERT INTO customers (id, first_name, last_name, email, phone)
VALUES 
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'John', 'Doe', 'john@example.com', '555-0100'),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Jane', 'Smith', 'jane@example.com', '555-0101')
ON CONFLICT (id) DO NOTHING;

-- Orders
INSERT INTO orders (id, shopify_order_id, shopify_order_number, customer_id, email, currency, total_price, subtotal_price, total_tax, fulfillment_status, financial_status, internal_status, created_at)
VALUES 
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', '1001', 'ORD-1001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'john@example.com', 'USD', 150.00, 140.00, 10.00, NULL, 'paid', 'new', NOW()),
  ('d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', '1002', 'ORD-1002', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'jane@example.com', 'USD', 250.50, 230.00, 20.50, 'partial', 'paid', 'packaging', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- Order Items
INSERT INTO order_items (order_id, name, sku, quantity, price)
VALUES 
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Wireless Headphones', 'WH-001', 1, 140.00),
  ('d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'Smart Watch', 'SW-002', 1, 230.00)
ON CONFLICT DO NOTHING;
