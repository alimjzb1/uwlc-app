-- Create inventory bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('inventory', 'inventory', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to inventory bucket
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'inventory' );

DROP POLICY IF EXISTS "Authenticated Insert" ON storage.objects;
CREATE POLICY "Authenticated Insert"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'inventory' AND auth.role() = 'authenticated' );

-- Ensure product_images table exists (idempotent)
CREATE TABLE IF NOT EXISTS product_images (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES products_inventory(id) ON DELETE CASCADE,
  url text NOT NULL,
  position int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS for product_images if not already enabled
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Policies for product_images (Drop first to be safe)
DROP POLICY IF EXISTS "Public view" ON product_images;
CREATE POLICY "Public view" ON product_images FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated insert" ON product_images;
CREATE POLICY "Authenticated insert" ON product_images FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated update" ON product_images;
CREATE POLICY "Authenticated update" ON product_images FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated delete" ON product_images;
CREATE POLICY "Authenticated delete" ON product_images FOR DELETE USING (auth.role() = 'authenticated');


-- Fix Deletion: Add ON DELETE CASCADE to foreign keys
-- Note: existing foreign key names might vary, so we try to drop standard names. 
ALTER TABLE product_images
DROP CONSTRAINT IF EXISTS product_images_product_id_fkey,
ADD CONSTRAINT product_images_product_id_fkey
FOREIGN KEY (product_id)
REFERENCES products_inventory(id)
ON DELETE CASCADE;

ALTER TABLE inventory_levels
DROP CONSTRAINT IF EXISTS inventory_levels_product_id_fkey,
ADD CONSTRAINT inventory_levels_product_id_fkey
FOREIGN KEY (product_id)
REFERENCES products_inventory(id)
ON DELETE CASCADE;

ALTER TABLE product_links
DROP CONSTRAINT IF EXISTS product_links_inventory_product_id_fkey,
ADD CONSTRAINT product_links_inventory_product_id_fkey
FOREIGN KEY (inventory_product_id)
REFERENCES products_inventory(id)
ON DELETE CASCADE;

-- Trigger to update parent stock when variants change
CREATE OR REPLACE FUNCTION update_parent_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    UPDATE products_inventory
    SET quantity_on_hand = (
      SELECT COALESCE(SUM(quantity_on_hand), 0)
      FROM products_inventory
      WHERE parent_id = NEW.parent_id
    )
    WHERE id = NEW.parent_id;
  END IF;
  
  IF OLD.parent_id IS NOT NULL THEN
     UPDATE products_inventory
    SET quantity_on_hand = (
      SELECT COALESCE(SUM(quantity_on_hand), 0)
      FROM products_inventory
      WHERE parent_id = OLD.parent_id
    )
    WHERE id = OLD.parent_id;
  END IF;
  
  RETURN NULL; -- After trigger, return is ignored
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_parent_stock ON products_inventory;
CREATE TRIGGER trg_update_parent_stock
AFTER INSERT OR UPDATE OF quantity_on_hand OR DELETE ON products_inventory
FOR EACH ROW
EXECUTE FUNCTION update_parent_stock();
