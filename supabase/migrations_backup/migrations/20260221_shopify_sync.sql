-- Shopify Sync Infrastructure

-- 1. Sync Logs Table - Tracks every sync operation and data change
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration TEXT NOT NULL DEFAULT 'shopify',
  entity_type TEXT NOT NULL,          -- 'order', 'customer', 'product'
  entity_id TEXT NOT NULL,             -- Shopify ID of the entity
  action TEXT NOT NULL,                -- 'created', 'updated', 'removed'
  changes JSONB,                       -- { field: { old, new } } for updates
  synced_at TIMESTAMPTZ DEFAULT now(),
  synced_by UUID REFERENCES auth.users(id)
);

ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON sync_logs;
CREATE POLICY "Enable read access for all users" ON sync_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable insert access for all users" ON sync_logs;
CREATE POLICY "Enable insert access for all users" ON sync_logs FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sync_logs_entity ON sync_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_synced_at ON sync_logs(synced_at DESC);

-- 2. App Settings Table - Key-value store for app-wide settings
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON app_settings;
CREATE POLICY "Enable read access for all users" ON app_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can insert app settings" ON app_settings;
CREATE POLICY "Admins can insert app settings" ON app_settings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);
DROP POLICY IF EXISTS "Admins can update app settings" ON app_settings;
CREATE POLICY "Admins can update app settings" ON app_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Insert default page size
INSERT INTO app_settings (key, value) VALUES ('default_page_size', '50') ON CONFLICT (key) DO NOTHING;

-- 3. Ensure tracking columns exist on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';

-- 4. Add delete policy for tables that may need record removal during sync
DROP POLICY IF EXISTS "Enable delete access for all users" ON customers;
CREATE POLICY "Enable delete access for all users" ON customers FOR DELETE USING (true);
DROP POLICY IF EXISTS "Enable delete access for all users" ON orders;
CREATE POLICY "Enable delete access for all users" ON orders FOR DELETE USING (true);
DROP POLICY IF EXISTS "Enable delete access for all users" ON order_items;
CREATE POLICY "Enable delete access for all users" ON order_items FOR DELETE USING (true);
DROP POLICY IF EXISTS "Enable delete access for all users" ON products_shopify;
CREATE POLICY "Enable delete access for all users" ON products_shopify FOR DELETE USING (true);
