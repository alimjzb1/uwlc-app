-- Migration: Add quantity_per_unit to product_links
ALTER TABLE product_links ADD COLUMN IF NOT EXISTS quantity_per_unit INTEGER DEFAULT 1;

-- Add reasoning/details to audit logs indexing if needed
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_product_links_shopify_variant_id ON product_links(shopify_variant_id);
