-- Create columns for tracking localized inventory on Shopify Products
ALTER TABLE products_shopify
ADD COLUMN IF NOT EXISTS local_inventory_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS local_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS selling_price NUMERIC DEFAULT 0;
