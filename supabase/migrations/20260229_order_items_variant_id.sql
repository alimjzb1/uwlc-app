-- Add shopify_variant_id to order_items so linking to product_links bridge works
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS shopify_variant_id TEXT;

-- Backfill: The variant_id cannot be inferred from existing data.
-- A re-sync of orders from Shopify will populate this field.
